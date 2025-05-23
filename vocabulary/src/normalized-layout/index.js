/**
 * @typedef {import('./types.js').NormalizedLayout} NormalizedLayout
 * @typedef {import('./types.js').SwitchStruct} SwitchStruct
 * @typedef {import('./types.js').BaseCompObject} BaseCompObject
 * @typedef {import('./types.js').SelectItem} SelectItem
 * @typedef {import('./types.js').SelectItems} SelectItems
 * @typedef {import('./types.js').GetItemsFetch} GetItemsFetch
 * @typedef {import('./types.js').Child} Child
 * @typedef {import('./types.js').Children} Children
 * @typedef {import('./types.js').ChildSlot} ChildSlot
 * @typedef {import('./types.js').CompositeCompObject} CompositeCompObject
 * @typedef {import('./types.js').SlotCompObject} SlotCompObject
 * @typedef {import('./types.js').ItemsBasedCompObject} ItemsBasedCompObject
 * @typedef {import('./types.js').FocusableCompObject} FocusableCompObject
 * @typedef {import('./types.js').GetItems} GetItems
 * @typedef {import('./types.js').Expression} Expression
 * @typedef {import('./types.js').Cols} Cols
 * @typedef {import('./types.js').ColsObj} ColsObj
 * @typedef {import('./types.js').StateNodeOptionsBase} StateNodeOptionsBase
 * @typedef {import('./types.js').StateNodePropsLib} StateNodePropsLib
 * @typedef {import('./types.js').Slot} Slot
 * @typedef {import('./types.js').Slots} Slots
 */

/** @type {(layout: NormalizedLayout) => layout is SwitchStruct} */
export function isSwitchStruct (layout) {
  return typeof layout === 'object' && 'switch' in layout
}

/** @type {(layout: NormalizedLayout) => layout is BaseCompObject} */
export function isCompObject (layout) {
  return !isSwitchStruct(layout)
}

/** @type {(child: Child) => child is Child & CompositeCompObject} */
export function childIsCompositeCompObject (child) {
  return 'comp' in child && 'children' in child
}

/** @type {(child: Child) => child is Child & SlotCompObject} */
export function childIsSlotCompObject (child) {
  return 'comp' in child && child.comp === 'slot'
}

/** @type {(layout: BaseCompObject, components: Record<string, import('../types.js').ComponentInfo>) => layout is CompositeCompObject} */
export function isCompositeLayout (layout, components) {
  return !!components[layout.comp]?.composite
}

/** @type {(layout: BaseCompObject) => layout is import('../components/types.js').List} */
export function isListLayout (layout) {
  return layout.comp === 'list'
}

/** @type {(layout: BaseCompObject, components: Record<string, import('../types.js').ComponentInfo>) => layout is FocusableCompObject} */
export function isFocusableLayout (layout, components) {
  return !!components[layout.comp]?.focusable
}

/** @type {(layout: BaseCompObject, components: Record<string, import('../types.js').ComponentInfo>) => layout is ItemsBasedCompObject} */
export function isItemsLayout (layout, components) {
  return !!components[layout.comp]?.itemsBased
}

/** @type {(getItems: GetItems) => getItems is Expression} */
export function isGetItemsExpression (getItems) {
  return !!getItems.expr
}

/** @type {(getItems: GetItems) => getItems is GetItemsFetch} */
export function isGetItemsFetch (getItems) {
  return !!getItems.url
}

/** @type {(slot: Slot) => slot is {text: string}} */
export function isTextSlot (slot) {
  // @ts-ignore
  return !!slot.text
}

/** @type {(slot: Slot) => slot is {markdown: string}} */
export function isMarkdownSlot (slot) {
  // @ts-ignore
  return !!slot.markdown
}

/** @type {(slot: Slot) => slot is {name: string}} */
export function isNameSlot (slot) {
  // @ts-ignore
  return !!slot.name
}
