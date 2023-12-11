import validate from './validate.js'
import schema from './schema.js'

/**
 * @typedef {import('./types.js').NormalizedLayout} NormalizedLayout
 * @typedef {import('./types.js').SwitchStruct} SwitchStruct
 * @typedef {import('./types.js').CompObject} CompObject
 * @typedef {import('./types.js').Section} Section
 * @typedef {import('./types.js').GetItems} GetItems
 * @typedef {import('./types.js').Expression} Expression
 * @typedef {import('./types.js').Select} Select
 * @typedef {import('./types.js').Autocomplete} Autocomplete
 * @typedef {import('./types.js').SelectItem} SelectItem
 * @typedef {import('./types.js').SelectItems} SelectItems
 * @typedef {import('./types.js').GetItemsFetch} GetItemsFetch
 * @typedef {import('./types.js').TextField} TextField
 * @typedef {import('./types.js').Textarea} Textarea
 * @typedef {import('./types.js').NumberField} NumberField
 * @typedef {import('./types.js').Slider} Slider
 * @typedef {import('./types.js').Checkbox} Checkbox
 * @typedef {import('./types.js').Switch} Switch
 * @typedef {import('./types.js').DatePicker} DatePicker
 * @typedef {import('./types.js').TimePicker} TimePicker
 * @typedef {import('./types.js').DateTimePicker} DateTimePicker
 * @typedef {import('./types.js').ColorPicker} ColorPicker
 * @typedef {import('./types.js').OneOfSelect} OneOfSelect
 * @typedef {import('./types.js').Child} Child
 * @typedef {import('./types.js').Children} Children
 * @typedef {import('./types.js').CompositeCompObject} CompositeCompObject
 * @typedef {import('./types.js').Tabs} Tabs
 * @typedef {import('./types.js').VerticalTabs} VerticalTabs
 * @typedef {import('./types.js').ExpansionPanels} ExpansionPanels
 * @typedef {import('./types.js').Stepper} Stepper
 * @typedef {import('./types.js').List} List
 * @typedef {import('./types.js').Combobox} Combobox
 * @typedef {import('./types.js').Cols} Cols
 * @typedef {import('./types.js').ColsObj} ColsObj
 * @typedef {import('./types.js').StateNodeOptionsBase} StateNodeOptionsBase
 * @typedef {import('./types.js').Slot} Slot
 * @typedef {{ errors: any, (layoutKeyword: any): layoutKeyword is NormalizedLayout }} ValidateNormalizedLayout
 */

export const /** @type {ValidateNormalizedLayout} */ validateNormalizedLayout = /** @type {any} */ (validate)

export const normalizedLayoutSchema = /** @type {any} */ (schema)

/** @type {(layout: NormalizedLayout) => layout is SwitchStruct} */
export function isSwitchStruct (layout) {
  return typeof layout === 'object' && 'switch' in layout
}

/** @type {(layout: NormalizedLayout) => layout is CompObject} */
export function isCompObject (layout) {
  return !isSwitchStruct(layout)
}

/** @type {(child: Child) => child is Child & CompositeCompObject} */
export function childIsCompObject (child) {
  return !!child.comp
}

/** @type {(layout: CompObject) => layout is Section} */
export function isSectionLayout (layout) {
  return layout.comp === 'section'
}

export const compositeCompNames = ['section', 'tabs', 'vertical-tabs', 'expansion-panels', 'stepper']

/** @type {(layout: CompObject) => layout is CompositeCompObject} */
export function isCompositeLayout (layout) {
  return compositeCompNames.includes(layout.comp)
}

/** @type {(layout: CompObject) => layout is TextField} */
export function isTextFieldLayout (layout) {
  return layout.comp === 'text-field'
}

/** @type {(layout: CompObject) => layout is Select} */
export function isSelectLayout (layout) {
  return layout.comp === 'select'
}

/** @type {(layout: CompObject) => layout is CompObject & {autofocus: boolean}} */
export function isFocusableLayout (layout) {
  return ['text-field', 'number-field', 'textarea', 'select', 'combobox', 'number-combobox', 'autocomplete', 'markdown'].includes(layout.comp)
}

/** @type {(layout: CompObject) => layout is Select | Combobox | Autocomplete} */
export function isItemsLayout (layout) {
  return layout.comp === 'select' || layout.comp === 'combobox' || layout.comp === 'autocomplete'
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