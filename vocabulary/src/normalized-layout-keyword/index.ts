import { type NormalizedLayout, Switch, CompObject, Section } from './types'
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

export function isSectionLayout (layout: CompObject): layout is Section {
  return layout.comp === 'section'
}