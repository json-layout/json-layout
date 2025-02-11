import schema from './schema.js'
import { ajv } from '../validate.js'

/**
 * @typedef {import('./types.js').LayoutKeyword} LayoutKeyword
 * @typedef {import('./types.js').ComponentName} ComponentName
 * @typedef {import('./types.js').PartialChildren} PartialChildren
 * @typedef {import('./types.js').PartialChild} PartialChild
 * @typedef {import('./types.js').PartialChildComposite} PartialChildComposite
 * @typedef {import('./types.js').PartialChildSlot} PartialChildSlot
 * @typedef {import('./types.js').PartialSwitch} PartialSwitch
 * @typedef {import('./types.js').PartialCompObject} PartialCompObject
 * @typedef {import('./types.js').PartialGetItems} PartialGetItems
 * @typedef {import('./types.js').PartialGetItemsFetch} PartialGetItemsFetch
 * @typedef {import('./types.js').PartialExpression} PartialExpression
 * @typedef {import('./types.js').PartialGetItemsObj} PartialGetItemsObj
 * @typedef {import('./types.js').PartialSlotMarkdown} PartialSlotMarkdown
 * @typedef {import('./types.js').PartialSlotText} PartialSlotText
 * @typedef {import('./types.js').PartialSlotName} PartialSlotName
 * @typedef {import('./types.js').PartialSlot} PartialSlot
 * @typedef {import('./types.js').PartialSelectItem} PartialSelectItem
 */

export const /** @type {import('../types.js').ValidateLayoutKeyword} */ validateLayoutKeyword = /** @type {any} */ (ajv.getSchema(schema.$id))

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

/** @type {(partialChild: PartialChild) => partialChild is PartialChildComposite} */
export function isPartialChildComposite (partialChild) {
  return typeof partialChild !== 'string' && 'children' in partialChild
}

/** @type {(partialChild: PartialChild) => partialChild is PartialChildSlot} */
export function isPartialChildSlot (partialChild) {
  return typeof partialChild !== 'string' && ('text' in partialChild || 'markdown' in partialChild || 'name' in partialChild)
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
  return typeof partialSlot === 'object' && !!(/** @type {any} */(partialSlot)).markdown
}

/** @type {(partialSlot: PartialSlot) => partialSlot is PartialSlotText} */
export function isPartialSlotText (partialSlot) {
  return typeof partialSlot === 'object' && !!(/** @type {any} */(partialSlot)).text
}

/** @type {(partialSlot: PartialSlot) => partialSlot is PartialSlotName} */
export function isPartialSlotName (partialSlot) {
  return typeof partialSlot === 'object' && !!(/** @type {any} */(partialSlot)).name
}
