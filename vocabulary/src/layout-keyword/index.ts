import {LayoutKeyword, ComponentName, PartialChildren, PartialSwitch, PartialCompObject} from './types'
import validate from './validate'

export * from './types'

type ValidateLayoutKeyword = {
  errors: any,
  (layoutKeyword: any): layoutKeyword is LayoutKeyword
}
export const validateLayoutKeyword = validate as unknown as ValidateLayoutKeyword

export function isComponentName (layoutKeyword: LayoutKeyword): layoutKeyword is ComponentName {
  return typeof layoutKeyword === 'string'
}

export function isPartialSwitch (layoutKeyword: LayoutKeyword): layoutKeyword is PartialSwitch {
  return typeof layoutKeyword === 'object' && 'switch' in layoutKeyword
}

export function isPartialChildren (layoutKeyword: LayoutKeyword): layoutKeyword is PartialChildren {
  return Array.isArray(layoutKeyword)
}

export function isPartialCompObject (layoutKeyword: LayoutKeyword): layoutKeyword is PartialCompObject {
  return typeof layoutKeyword === 'object' && !Array.isArray(layoutKeyword)
}