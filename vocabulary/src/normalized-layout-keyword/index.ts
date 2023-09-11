import { type NormalizedLayout, Switch, CompObject, Section, GetItems, Expression, Select, GetItemsFetch, TextField, Child, CompositeCompObject } from './types'
import validate from './validate'

export * from './types'

interface ValidateNormalizedLayout {
  errors: any
  (layoutKeyword: any): layoutKeyword is NormalizedLayout
}
export const validateNormalizedLayout = validate as unknown as ValidateNormalizedLayout

export function isSwitch (layout: NormalizedLayout): layout is Switch {
  return typeof layout === 'object' && 'switch' in layout
}

export function isCompObject (layout: NormalizedLayout): layout is CompObject {
  return !isSwitch(layout)
}

export function childIsCompObject (child: Child): child is Child & CompositeCompObject {
  return !!child.comp
}

export function isSectionLayout (layout: CompObject): layout is Section {
  return layout.comp === 'section'
}

export function isCompositeLayout (layout: CompObject): layout is CompositeCompObject {
  return ['section', 'tabs', 'vertical-tabs', 'expansion-panels'].includes(layout.comp)
}

export function isTextFieldLayout (layout: CompObject): layout is TextField {
  return layout.comp === 'text-field'
}

export function isSelectLayout (layout: CompObject): layout is Select {
  return layout.comp === 'select'
}

export function isGetItemsExpression (getItems: GetItems): getItems is Expression {
  return !!getItems.expr
}

export function isGetItemsFetch (getItems: GetItems): getItems is GetItemsFetch {
  return !!getItems.url
}