/*
TODO:
  - traverse json schema
  - create a normalized layout keyword for each level based on schema and optional layout annotation
  - validate the normalized layout (json schema + custom assertion like the fact the the children keys match reality)
  - compile all partial schemas necessary for the stateful layout
  - optionally suggest serializing the result to js, serialization would include (serialization could also include types compiled from the schema)
*/

import type Ajv from 'ajv'
// import Debug from 'debug'
import { normalizeLayoutFragment, type NormalizedLayout, type SchemaFragment, type Expression, isSwitch } from '@json-layout/vocabulary'

// const debug = Debug('json-layout:compile-raw')

export interface CompileRawOptions {
  ajv: Ajv
}

export interface CompiledRaw {
  tree: LayoutTree
  validates: string[]
  normalizedLayouts: Record<string, NormalizedLayout>
  expressions: Expression[]
}

// a tree is a root node and a validation function
// it will be used to instantiate a StateLayoutTree with 1 validation context
export interface LayoutTree {
  root: LayoutNode
  validate: string // reference to a validate function in the validates store
}

// a node is a light recursive structure
// each one will be instantiated as a StateLayoutNode with a value and an associated component instance
export interface LayoutNode {
  key: string
  pointer: string
  parentPointer: string | null
  dataPath: string
  parentDataPath: string | null
  children?: LayoutNode[] // optional children in the case of arrays and object nodes
  childrenTrees?: Array<{ title: string, tree: LayoutTree }> // other trees that can be instantiated with separate validation (for example in the case of new array items of oneOfs, etc)
}

export function compileRaw (schema: any, options: CompileRawOptions): CompiledRaw {
  const validates: string[] = []
  const normalizedLayouts: Record<string, NormalizedLayout> = {}
  const expressions: Expression[] = []

  // TODO: produce a resolved/normalized version of the schema
  // useful to get predictable schemaPath properties in errors and to have proper handling of default values
  const tree = makeTree(schema, options.ajv, validates, normalizedLayouts, expressions, `${schema.$id}#`)

  return { tree, validates, normalizedLayouts, expressions }
}

function makeTree (schema: any,
  ajv: Ajv,
  validates: string[],
  normalizedLayouts: Record<string, NormalizedLayout>,
  expressions: Expression[],
  pointer: string
): LayoutTree {
  const root = makeNode(schema, ajv, validates, normalizedLayouts, expressions, '', pointer, '', null, null)
  validates.push(pointer)
  return { root, validate: pointer }
}

function makeNode (
  schema: any,
  ajv: Ajv,
  validates: string[],
  normalizedLayouts: Record<string, NormalizedLayout>,
  expressions: Expression[],
  key: string,
  pointer: string,
  dataPath: string,
  parentPointer: string | null,
  parentDataPath: string | null
): LayoutNode {
  /*
  // const uriResolver = ajv.opts.uriResolver
  const skeletonsStack: StatefulLayoutSkeleton[] = []
  let skeleton: StatefulLayoutSkeleton = { key: '', layout: '' }
  traverse(schema, {
    cb: {
      // pre is called before the children are traversed
      pre: (fragment, pointer, rootSchema, parentPointer, parentKeyword, parentFragment, key) => {
        // TODO: fragment might be missing type here ?
        normalizedLayouts[pointer] = normalizedLayouts[pointer] || normalizeLayoutFragment(fragment as SchemaFragment, pointer)
        validates.push(pointer)
        const skeleton: StatefulLayoutSkeleton = { key: `${key ?? ''}`, layout: pointer, validate: pointer }
        skeletonsStack.push(skeleton)
      },
      // post is called after the children are traversed
      post: (fragment, pointer, rootSchema, parentPointer, parentKeyword, parentFragment, key) => {
        skeleton = skeletonsStack.pop() as StatefulLayoutSkeleton
        const parent = skeletonsStack[skeletonsStack.length - 1]
        if (parent) {
          parent.children = parent.children ?? []
          parent.children.push(skeleton)
        }
        debug('skeleton finished for schema fragment', key)
      }
    }
  }) */

  // consolidate schema
  if (!schema.type && schema.properties) schema.type = 'object'

  // improve on ajv error messages based on ajv-errors (https://ajv.js.org/packages/ajv-errors.html)
  schema.errorMessage = schema.errorMessage ?? {}
  const normalizedLayout: NormalizedLayout = normalizedLayouts[pointer] ?? normalizeLayoutFragment(schema as SchemaFragment, pointer)
  normalizedLayouts[pointer] = normalizedLayout

  const compObjects = isSwitch(normalizedLayout) ? normalizedLayout : [normalizedLayout]
  for (const compObject of compObjects) {
    if (compObject.if) expressions.push(compObject.if)
  }

  const node: LayoutNode = { key: `${key ?? ''}`, pointer, parentPointer, dataPath, parentDataPath }
  const childrenCandidates: Array<{ key: string, pointer: string, dataPath: string, schema: any }> = []
  if (schema.properties) {
    for (const propertyKey of Object.keys(schema.properties)) {
      childrenCandidates.push({
        key: propertyKey,
        pointer: `${pointer}/properties/${propertyKey}`,
        dataPath: `${dataPath}/${propertyKey}`,
        schema: schema.properties[propertyKey]
      })
      if (schema?.required?.includes(propertyKey)) {
        schema.errorMessage.required = schema.errorMessage.required ?? {}
        schema.errorMessage.required[propertyKey] = 'required'
      }
    }
  }
  if (childrenCandidates.length) {
    node.children = childrenCandidates.map(cc => makeNode(cc.schema, ajv, validates, normalizedLayouts, expressions, cc.key, cc.pointer, cc.dataPath, pointer, dataPath))
  }
  if (schema.oneOf) {
    const oneOfPointer = `${pointer}/oneOf`
    normalizedLayouts[oneOfPointer] = normalizedLayouts[oneOfPointer] ?? normalizeLayoutFragment(schema as SchemaFragment, oneOfPointer, 'oneOf')
    const childrenTrees: Array<{ title: string, tree: LayoutTree }> = []
    for (let i = 0; i < schema.oneOf.length; i++) {
      if (!schema.oneOf[i].type) schema.oneOf[i].type = schema.type
      const title = schema.oneOf[i].title ?? `option ${i}`
      delete schema.oneOf[i].title
      childrenTrees.push({
        title,
        tree: makeTree(schema.oneOf[i], ajv, validates, normalizedLayouts, expressions, `${oneOfPointer}/${i}`)
      })
    }
    node.children = node.children ?? []
    node.children.push({ key: '$oneOf', pointer: `${pointer}/oneOf`, parentPointer: pointer, dataPath, parentDataPath, childrenTrees })

    schema.errorMessage.oneOf = 'chose one'
  }
  return node
}
