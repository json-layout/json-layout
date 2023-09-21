import validate from './validate.js'
import schema from './schema.js'

/**
 * @typedef {import('./types.js').LayoutKeyword} LayoutKeyword
 * @typedef {import('./types.js').ComponentName} ComponentName
 * @typedef {import('./types.js').PartialChildren} PartialChildren
 * @typedef {import('./types.js').PartialSwitch} PartialSwitch
 * @typedef {import('./types.js').PartialCompObject} PartialCompObject
 * @typedef {import('./types.js').PartialGetItems} PartialGetItems
 * @typedef {import('./types.js').PartialGetItemsFetch} PartialGetItemsFetch
 * @typedef {import('./types.js').PartialExpression} PartialExpression
 * @typedef {import('./types.js').PartialGetItemsObj} PartialGetItemsObj
 * @typedef {import('./types.js').PartialSlotMarkdown} PartialSlotMarkdown
 * @typedef {import('./types.js').PartialSlot} PartialSlot
 * @typedef {import('./types.js').PartialSelectItem} PartialSelectItem
 * @typedef {{ errors: any, (layoutKeyword: any): layoutKeyword is LayoutKeyword }} ValidateLayoutKeyword
 */

export const /** @type {ValidateLayoutKeyword} */ validateLayoutKeyword = /** @type {any} */ (validate)

export const layoutKeywordSchema = /** @type {any} */ (schema)

/** @type {(layoutKeyword: LayoutKeyword) => layoutKeyword is ComponentName} */
export function isComponentName (layoutKeyword) {
  return typeof layoutKeyword === 'string'
}

/** @type {(layoutKeyword: LayoutKeyword) => layoutKeyword is PartialSwitch} */
export function isPartialSwitch (layoutKeyword) {
  return typeof layoutKeyword === 'object' && 'switch' in layoutKeyword
}

/** @type {(layoutKeyword: LayoutKeyword) => layoutKeyword is PartialChildren} */
export function isPartialChildren (layoutKeyword) {
  return Array.isArray(layoutKeyword)
}

/** @type {(layoutKeyword: LayoutKeyword) => layoutKeyword is PartialCompObject} */
export function isPartialCompObject (layoutKeyword) {
  return typeof layoutKeyword === 'object' && !Array.isArray(layoutKeyword)
}

/** @type {(getItems: PartialGetItems) => getItems is PartialExpression} */
export function isPartialGetItemsExpr (getItems) {
  return typeof getItems === 'string' || !!getItems.expr
}

/** @type {(getItems: PartialGetItems) => getItems is PartialGetItemsObj} */
export function isPartialGetItemsObj (getItems) {
  return typeof getItems === 'object'
}

/** @type {(getItems: PartialGetItems) => getItems is PartialGetItemsFetch} */
export function isPartialGetItemsFetch (getItems) {
  return typeof getItems === 'object' && !!getItems.url
}

/** @type {(partialSlot: PartialSlot) => partialSlot is PartialSlotMarkdown} */
export function isPartialSlotMarkdown (partialSlot) {
  return typeof partialSlot == 'object' && !!/** @type {PartialSlotMarkdown} */(partialSlot).markdown
}