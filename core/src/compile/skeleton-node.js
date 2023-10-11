// import Debug from 'debug'
import { normalizeLayoutFragment, isSwitchStruct, isGetItemsExpression, isSelectLayout, isGetItemsFetch } from '@json-layout/vocabulary'
import { makeSkeletonTree } from './skeleton-tree.js'

/**
 * @param {import('@json-layout/vocabulary').Expression[]} expressions
 * @param {import('@json-layout/vocabulary').Expression} expression
 */
const pushExpression = (expressions, expression) => {
  const index = expressions.findIndex(e => e.type === expression.type && e.expr === expression.expr)
  if (index !== -1) {
    expression.ref = index
  } else {
    expression.ref = expressions.length
    expressions.push(expression)
  }
}

/**
 * @param {any} schema
 * @param {import('./index.js').CompileOptions} options
 * @param {string[]} validates
 * @param {Record<string, import('@json-layout/vocabulary').NormalizedLayout>} normalizedLayouts
 * @param {import('@json-layout/vocabulary').Expression[]} expressions
 * @param {string | number} key
 * @param {string} pointer
 * @param {string | null} parentPointer
 * @param {boolean} required
 * @returns {import('./types.js').SkeletonNode}
 */
export function makeSkeletonNode (
  schema,
  options,
  validates,
  normalizedLayouts,
  expressions,
  key,
  pointer,
  parentPointer,
  required
) {
  // consolidate schema
  if (!schema.type && schema.properties) schema.type = 'object'

  // improve on ajv error messages based on ajv-errors (https://ajv.js.org/packages/ajv-errors.html)
  schema.errorMessage = schema.errorMessage ?? {}
  /** @type {import('@json-layout/vocabulary').NormalizedLayout} */
  const normalizedLayout = normalizedLayouts[pointer] ?? normalizeLayoutFragment(/** @type {import('@json-layout/vocabulary').SchemaFragment} */(schema), pointer, options.markdown)
  normalizedLayouts[pointer] = normalizedLayout

  const compObjects = isSwitchStruct(normalizedLayout) ? normalizedLayout.switch : [normalizedLayout]
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

  /** @type {import('./types.js').SkeletonNode} */
  const node = { key: key ?? '', pointer, parentPointer, defaultData }
  if (schema.const) node.const = schema.const
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
          schema.errorMessage.required[propertyKey] = options.messages.errorRequired
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
      normalizedLayouts[oneOfPointer] = normalizedLayouts[oneOfPointer] ?? normalizeLayoutFragment(schema, oneOfPointer, options.markdown, 'oneOf')
      /** @type {import('./types.js').SkeletonTree[]} */
      const childrenTrees = []
      for (let i = 0; i < schema.oneOf.length; i++) {
        if (!schema.oneOf[i].type) schema.oneOf[i].type = schema.type
        const title = schema.oneOf[i].title ?? `option ${i}`
        delete schema.oneOf[i].title
        childrenTrees.push(makeSkeletonTree(schema.oneOf[i], options, validates, normalizedLayouts, expressions, `${oneOfPointer}/${i}`, title))
      }
      node.children = node.children ?? []
      node.children.push({ key: '$oneOf', pointer: `${pointer}/oneOf`, parentPointer: pointer, childrenTrees })

      schema.errorMessage.oneOf = options.messages.errorOneOf
    }
  }

  if (schema.type === 'array' && schema.items) {
    if (Array.isArray(schema.items)) {
      node.children = schema.items.map((/** @type {any} */ itemSchema, /** @type {number} */ i) => {
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
        makeSkeletonTree(
          schema.items,
          options,
          validates,
          normalizedLayouts,
          expressions,
          `${pointer}/items`,
          schema.items.title
        )
      ]
    }
  }
  return node
}
