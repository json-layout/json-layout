// import Debug from 'debug'
import { normalizeLayoutFragment, isSwitchStruct, isGetItemsExpression, isGetItemsFetch, isItemsLayout } from '@json-layout/vocabulary'
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
 * @param {Record<string, string[]>} validationErrors
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
  validationErrors,
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
  if (!normalizedLayouts[pointer]) {
    const normalizationResult = normalizeLayoutFragment(/** @type {import('@json-layout/vocabulary').SchemaFragment} */(schema), pointer, options.markdown)
    normalizedLayouts[pointer] = normalizationResult.layout
    if (normalizationResult.errors.length) {
      validationErrors[pointer.replace('_jl#', '/')] = normalizationResult.errors
    }
  }
  const normalizedLayout = normalizedLayouts[pointer]

  let defaultData
  if ('default' in schema) defaultData = schema.default
  else if (required) {
    if (schema.type === 'object') defaultData = {}
    if (schema.type === 'array') defaultData = []
  }

  const compObjects = isSwitchStruct(normalizedLayout) ? normalizedLayout.switch : [normalizedLayout]
  for (const compObject of compObjects) {
    if (schema.description && !compObject.help) compObject.help = schema.description
    if (compObject.if) pushExpression(expressions, compObject.if)

    if ('const' in schema) compObject.constData = { type: 'js-eval', expr: JSON.stringify(schema.const) }
    if (compObject.constData) pushExpression(expressions, compObject.constData)

    if (defaultData && !compObject.defaultData) compObject.defaultData = { type: 'js-eval', expr: JSON.stringify(defaultData) }
    if (compObject.defaultData) pushExpression(expressions, compObject.defaultData)

    if (isItemsLayout(compObject) && compObject.getItems) {
      if (isGetItemsExpression(compObject.getItems)) pushExpression(expressions, compObject.getItems)
      if (isGetItemsFetch(compObject.getItems)) pushExpression(expressions, compObject.getItems.url)
      if (compObject.getItems.itemTitle) pushExpression(expressions, compObject.getItems.itemTitle)
      if (compObject.getItems.itemKey) pushExpression(expressions, compObject.getItems.itemKey)
      if (compObject.getItems.itemValue) pushExpression(expressions, compObject.getItems.itemValue)
      if (compObject.getItems.itemIcon) pushExpression(expressions, compObject.getItems.itemIcon)
      if (compObject.getItems.itemsResults) pushExpression(expressions, compObject.getItems.itemsResults)
    }
  }

  /** @type {import('./types.js').SkeletonNode} */
  const node = { key: key ?? '', pointer, parentPointer }
  if (schema.type === 'object') {
    if (schema.properties) {
      node.children = node.children ?? []
      for (const propertyKey of Object.keys(schema.properties)) {
        node.children.push(makeSkeletonNode(
          schema.properties[propertyKey],
          options,
          validates,
          validationErrors,
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
          validationErrors,
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
      if (!normalizedLayouts[oneOfPointer]) {
        const normalizationResult = normalizeLayoutFragment(schema, oneOfPointer, options.markdown, 'oneOf')
        normalizedLayouts[oneOfPointer] = normalizationResult.layout
        if (normalizationResult.errors.length) {
          validationErrors[oneOfPointer.replace('_jl#', '/')] = normalizationResult.errors
        }
      }
      /** @type {import('./types.js').SkeletonTree[]} */
      const childrenTrees = []
      for (let i = 0; i < schema.oneOf.length; i++) {
        if (!schema.oneOf[i].type) schema.oneOf[i].type = schema.type
        const title = schema.oneOf[i].title ?? `option ${i}`
        delete schema.oneOf[i].title
        childrenTrees.push(makeSkeletonTree(
          schema.oneOf[i],
          options,
          validates,
          validationErrors,
          normalizedLayouts,
          expressions,
          `${oneOfPointer}/${i}`,
          title
        ))
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
          validationErrors,
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
          validationErrors,
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
