import { type NormalizedLayout, Switch, CompObject } from './types'
import validate from './validate'

export * from './types'

interface ValidateNormalizedLayout {
  errors: any
  (layoutKeyword: any): layoutKeyword is NormalizedLayout
}
export const validateNormalizedLayout = validate as ValidateNormalizedLayout

export function isSwitch (layout: NormalizedLayout): layout is Switch {
  return Array.isArray(layout)
}

export function isCompObject (layout: NormalizedLayout): layout is CompObject {
  return typeof layout === 'object'
}
