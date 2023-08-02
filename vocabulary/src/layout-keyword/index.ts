import {LayoutKeyword, ComponentName, Children, PartialSwitch, PartialCompObject} from './types'
import validate from './validate'

export * from './types'

type ValidateLayoutKeyword = {
  errors: any,
  (layoutKeyword: any): layoutKeyword is LayoutKeyword
}
export const validateLayoutKeyword = validate as ValidateLayoutKeyword

export function isComponentName (layoutKeyword: LayoutKeyword): layoutKeyword is ComponentName {
  return typeof layoutKeyword === 'string'
}

export function isPartialSwitch (layoutKeyword: LayoutKeyword): layoutKeyword is PartialSwitch {
  return Array.isArray(layoutKeyword) && layoutKeyword.length > 0 && typeof layoutKeyword[0] === 'object'
}

export function isChildren (layoutKeyword: LayoutKeyword): layoutKeyword is Children {
  return Array.isArray(layoutKeyword) && (layoutKeyword.length === 0 || typeof layoutKeyword[0] === 'string')
}

export function isPartialCompObject (layoutKeyword: LayoutKeyword): layoutKeyword is PartialCompObject {
  return typeof layoutKeyword === 'object'
}