import type Ajv from 'ajv'
// import Debug from 'debug'
import { normalizeLayoutFragment, type NormalizedLayout, type SchemaFragment, type Expression, isSwitch } from '@json-layout/vocabulary'
import { type SkeletonTree, makeSkeletonTree } from './skeleton-tree'

// a skeleton node is a light recursive structure
// at runtime each one will be instantiated as a StateNode with a value and an associated component instance
export interface SkeletonNode {
  key: string
  pointer: string
  parentPointer: string | null
  dataPath: string
  parentDataPath: string | null
  children?: SkeletonNode[] // optional children in the case of arrays and object nodes
  childrenTrees?: SkeletonTree[] // other trees that can be instantiated with separate validation (for example in the case of new array items of oneOfs, etc)
}

export function makeSkeletonNode (
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
): SkeletonNode {
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

  const node: SkeletonNode = { key: `${key ?? ''}`, pointer, parentPointer, dataPath, parentDataPath }
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
    node.children = childrenCandidates.map(cc => makeSkeletonNode(cc.schema, ajv, validates, normalizedLayouts, expressions, cc.key, cc.pointer, cc.dataPath, pointer, dataPath))
  }
  if (schema.oneOf) {
    const oneOfPointer = `${pointer}/oneOf`
    normalizedLayouts[oneOfPointer] = normalizedLayouts[oneOfPointer] ?? normalizeLayoutFragment(schema as SchemaFragment, oneOfPointer, 'oneOf')
    const childrenTrees: SkeletonTree[] = []
    for (let i = 0; i < schema.oneOf.length; i++) {
      if (!schema.oneOf[i].type) schema.oneOf[i].type = schema.type
      const title = schema.oneOf[i].title ?? `option ${i}`
      delete schema.oneOf[i].title
      childrenTrees.push(makeSkeletonTree(schema.oneOf[i], ajv, validates, normalizedLayouts, expressions, `${oneOfPointer}/${i}`, title))
    }
    node.children = node.children ?? []
    node.children.push({ key: '$oneOf', pointer: `${pointer}/oneOf`, parentPointer: pointer, dataPath, parentDataPath, childrenTrees })

    schema.errorMessage.oneOf = 'chose one'
  }
  return node
}
