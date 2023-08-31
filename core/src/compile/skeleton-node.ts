// import Debug from 'debug'
import { normalizeLayoutFragment, type NormalizedLayout, type SchemaFragment, type Expression, isSwitch, isGetItemsExpression, isSelectLayout } from '@json-layout/vocabulary'
import { type SkeletonTree, makeSkeletonTree } from './skeleton-tree'
import { isGetItemsFetch } from '@json-layout/vocabulary'
import { type CompileOptions } from '.'

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

const pushExpression = (expressions: Expression[], expression: Expression) => {
  const index = expressions.findIndex(e => e.type === expression.type && e.expr === expression.expr)
  if (index !== -1) {
    expression.ref = index
  } else {
    expression.ref = expressions.length
    expressions.push(expression)
  }
}

export function makeSkeletonNode (
  schema: any,
  options: CompileOptions,
  validates: string[],
  normalizedLayouts: Record<string, NormalizedLayout>,
  expressions: Expression[],
  key: string | number,
  pointer: string,
  parentPointer: string | null,
  required: boolean
): SkeletonNode {
  // consolidate schema
  if (!schema.type && schema.properties) schema.type = 'object'

  // improve on ajv error messages based on ajv-errors (https://ajv.js.org/packages/ajv-errors.html)
  schema.errorMessage = schema.errorMessage ?? {}
  const normalizedLayout: NormalizedLayout = normalizedLayouts[pointer] ?? normalizeLayoutFragment(schema as SchemaFragment, pointer, options.markdown)
  normalizedLayouts[pointer] = normalizedLayout

  const compObjects = isSwitch(normalizedLayout) ? normalizedLayout.switch : [normalizedLayout]
  for (const compObject of compObjects) {
    if (schema.description && !compObject.help) compObject.help = schema.description
    if (compObject.if) pushExpression(expressions, compObject.if)
    if (isSelectLayout(compObject) && compObject.getItems) {
      if (isGetItemsExpression(compObject.getItems)) pushExpression(expressions, compObject.getItems)
      if (isGetItemsFetch(compObject.getItems)) pushExpression(expressions, compObject.getItems.url)
      if (compObject.getItems.itemTitle) pushExpression(expressions, compObject.getItems.itemTitle)
      if (compObject.getItems.itemKey) pushExpression(expressions, compObject.getItems.itemKey)
      if (compObject.getItems.itemValue) pushExpression(expressions, compObject.getItems.itemValue)
      if (compObject.getItems.itemsResults) pushExpression(expressions, compObject.getItems.itemsResults)
    }
  }

  let defaultData
  if (schema.const) defaultData = schema.const
  else if (schema.default) defaultData = schema.default
  if (required) {
    if (schema.type === 'object') defaultData = {} // TODO: this is only true if property is required ?
    if (schema.type === 'array') defaultData = []
    if (schema.type === 'string' && !schema.format) defaultData = ''
  }

  const node: SkeletonNode = { key: key ?? '', pointer, parentPointer, defaultData }
  if (schema.type === 'object') {
    if (schema.properties) {
      node.children = node.children ?? []
      for (const propertyKey of Object.keys(schema.properties)) {
        node.children.push(makeSkeletonNode(
          schema.properties[propertyKey],
          options,
          validates,
          normalizedLayouts,
          expressions,
          propertyKey,
          `${pointer}/properties/${propertyKey}`,
          pointer,
          schema.required?.includes(propertyKey)
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
          options,
          validates,
          normalizedLayouts,
          expressions,
          `$allOf-${i}`,
          `${pointer}/allOf/${i}`,
          pointer,
          false
        ))
      }
    }
    if (schema.oneOf) {
      const oneOfPointer = `${pointer}/oneOf`
      normalizedLayouts[oneOfPointer] = normalizedLayouts[oneOfPointer] ?? normalizeLayoutFragment(schema as SchemaFragment, oneOfPointer, options.markdown, 'oneOf')
      const childrenTrees: SkeletonTree[] = []
      for (let i = 0; i < schema.oneOf.length; i++) {
        if (!schema.oneOf[i].type) schema.oneOf[i].type = schema.type
        const title = schema.oneOf[i].title ?? `option ${i}`
        delete schema.oneOf[i].title
        childrenTrees.push(makeSkeletonTree(schema.oneOf[i], options, validates, normalizedLayouts, expressions, `${oneOfPointer}/${i}`, title))
      }
      node.children = node.children ?? []
      node.children.push({ key: '$oneOf', pointer: `${pointer}/oneOf`, parentPointer: pointer, childrenTrees })

      schema.errorMessage.oneOf = 'chose one'
    }
  }

  if (schema.type === 'array' && schema.items) {
    if (Array.isArray(schema.items)) {
      node.children = schema.items.map((itemSchema: any, i: number) => {
        return makeSkeletonNode(
          itemSchema,
          options,
          validates,
          normalizedLayouts,
          expressions,
          i,
          `${pointer}/items/${i}`,
          pointer,
          true
        )
      })
    } else {
      node.childrenTrees = [
        makeSkeletonTree(schema.items, options, validates, normalizedLayouts, expressions, `${pointer}/items`, schema.items.title)
      ]
    }
  }
  return node
}
