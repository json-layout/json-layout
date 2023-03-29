/*
TODO:
  - traverse json schema
  - create a normalized layout keyword for each level based on schema and optional layout annotation
  - validate the normalized layout (json schema + custom assertion like the fact the the children keys match reality)
  - compile all partial schemas necessary for the stateful layout
  - optionally suggest serializing the result to js, serialization would include (serialization could also include types compiled from the schema)
*/

import type traverse from 'json-schema-traverse'
import type Ajv from 'ajv'
// import Debug from 'debug'
import { normalizeLayoutFragment, type NormalizedLayout, type SchemaFragment } from '@json-layout/vocabulary'

// const debug = Debug('json-layout:compile-raw')

export interface CompileRawOptions {
  ajv: Ajv
}

export interface CompiledRaw {
  tree: LayoutTree
  validates: string[]
  normalizedLayouts: Record<string, NormalizedLayout>
}

// a tree is a root node and a validation function
// it will be used to instantiate a StatefulLayoutTree with 1 validation context
export interface LayoutTree {
  root: LayoutNode
  validate: string // reference to a validate function in the validates store
}

// a node is a light recursive structure
// each one will be instantiated as a StatefulLayoutNode with a value and an associated component instance
export interface LayoutNode {
  key: string
  layout: string // reference to a layout object in the normalizedLayouts store
  children?: LayoutNode[] // optional children in the case of arrays and object nodes
  item?: LayoutTree // another tree that can be instantiated with separate validation (for example in the case of new array items)
}

export function compileRaw (schema: object, options: CompileRawOptions): CompiledRaw {
  const validates: string[] = []
  const normalizedLayouts: Record<string, NormalizedLayout> = {}

  schema = schema as traverse.SchemaObject
  const tree = makeTree(schema, options.ajv, validates, normalizedLayouts, '#')

  return { tree, validates, normalizedLayouts }
}

function makeTree (schema: any,
  ajv: Ajv,
  validates: string[],
  normalizedLayouts: Record<string, NormalizedLayout>,
  schemaPointer: string
): LayoutTree {
  const root = makeNode(schema, ajv, normalizedLayouts, schemaPointer, '')
  return { root, validate: schemaPointer }
}

function makeNode (
  schema: any,
  ajv: Ajv,
  normalizedLayouts: Record<string, NormalizedLayout>,
  schemaPointer: string,
  key: string
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
  normalizedLayouts[schemaPointer] = normalizedLayouts[schemaPointer] || normalizeLayoutFragment(schema as SchemaFragment, schemaPointer)
  const node: LayoutNode = { key: `${key ?? ''}`, layout: schemaPointer }
  const childrenCandidates: Array<{ key: string, schemaPointer: string, schema: any }> = []
  if (schema.properties) {
    for (const propertyKey of Object.keys(schema.properties)) {
      childrenCandidates.push({ key: propertyKey, schemaPointer: `${schemaPointer}/properties/${propertyKey}`, schema: schema.properties[propertyKey] })
    }
  }
  if (childrenCandidates.length) {
    node.children = childrenCandidates.map(cc => makeNode(cc.schema, ajv, normalizedLayouts, cc.schemaPointer, cc.key))
  }
  return node
}
