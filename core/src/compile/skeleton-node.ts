import type Ajv from 'ajv'
// import Debug from 'debug'
import { normalizeLayoutFragment, type NormalizedLayout, type SchemaFragment, type Expression, isSwitch, isGetItemsExpression, isSelectLayout } from '@json-layout/vocabulary'
import { type SkeletonTree, makeSkeletonTree } from './skeleton-tree'

// a skeleton node is a light recursive structure
// at runtime each one will be instantiated as a StateNode with a value and an associated component instance
export interface SkeletonNode {
  key: string | number
  pointer: string
  parentPointer: string | null
  defaultData?: unknown
  children?: SkeletonNode[] // optional children in the case of arrays and object nodes
  childrenTrees?: SkeletonTree[] // other trees that can be instantiated with separate validation (for example in the case of new array items of oneOfs, etc)
}

export function makeSkeletonNode (
  schema: any,
  ajv: Ajv,
  validates: string[],
  normalizedLayouts: Record<string, NormalizedLayout>,
  expressions: Expression[],
  key: string | number,
  pointer: string,
  parentPointer: string | null
): SkeletonNode {
  // consolidate schema
  if (!schema.type && schema.properties) schema.type = 'object'

  // improve on ajv error messages based on ajv-errors (https://ajv.js.org/packages/ajv-errors.html)
  schema.errorMessage = schema.errorMessage ?? {}
  const normalizedLayout: NormalizedLayout = normalizedLayouts[pointer] ?? normalizeLayoutFragment(schema as SchemaFragment, pointer)
  normalizedLayouts[pointer] = normalizedLayout

  const compObjects = isSwitch(normalizedLayout) ? normalizedLayout.switch : [normalizedLayout]
  for (const compObject of compObjects) {
    if (compObject.if) expressions.push(compObject.if)
    if (isSelectLayout(compObject) && compObject.getItems && isGetItemsExpression(compObject.getItems)) {
      expressions.push(compObject.getItems)
    }
  }

  let defaultData
  if (schema.const) defaultData = schema.const
  else if (schema.default) defaultData = schema.default
  if (schema.type === 'object') defaultData = {} // TODO: this is only true if property is required ?
  if (schema.type === 'array') defaultData = []

  const node: SkeletonNode = { key: key ?? '', pointer, parentPointer, defaultData }
  if (schema.type === 'object') {
    if (schema.properties) {
      node.children = node.children ?? []
      for (const propertyKey of Object.keys(schema.properties)) {
        node.children.push(makeSkeletonNode(
          schema.properties[propertyKey],
          ajv,
          validates,
          normalizedLayouts,
          expressions,
          propertyKey,
        `${pointer}/properties/${propertyKey}`,
        pointer
        ))
        if (schema?.required?.includes(propertyKey)) {
          schema.errorMessage.required = schema.errorMessage.required ?? {}
          schema.errorMessage.required[propertyKey] = 'required'
        }
      }
    }
    if (schema.allOf) {
      node.children = node.children ?? []
      for (let i = 0; i < schema.allOf.length; i++) {
        node.children.push(makeSkeletonNode(
          schema.allOf[i],
          ajv,
          validates,
          normalizedLayouts,
          expressions,
        `$allOf-${i}`,
        `${pointer}/allOf/${i}`,
        pointer
        ))
      }
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
      node.children.push({ key: '$oneOf', pointer: `${pointer}/oneOf`, parentPointer: pointer, childrenTrees })

      schema.errorMessage.oneOf = 'chose one'
    }
  }

  if (schema.type === 'array' && schema.items) {
    if (Array.isArray(schema.items)) {
      node.children = schema.items.map((itemSchema: any, i: number) => {
        return makeSkeletonNode(itemSchema, ajv, validates, normalizedLayouts, expressions, i, `${pointer}/items/${i}`, pointer)
      })
    } else {
      node.childrenTrees = [
        makeSkeletonTree(schema.items, ajv, validates, normalizedLayouts, expressions, `${pointer}/items`, schema.items.title)
      ]
    }
  }
  return node
}
