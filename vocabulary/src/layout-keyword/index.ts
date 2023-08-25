import {LayoutKeyword, ComponentName, PartialChildren, PartialSwitch, PartialCompObject, PartialGetItems, PartialGetItemsFetch, PartialExpression, PartialGetItemsObj} from './types'
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

export function isPartialGetItemsExpr (getItems: PartialGetItems): getItems is PartialExpression {
  return typeof getItems === 'string' || !!getItems.expr
}

export function isPartialGetItemsObj (getItems: PartialGetItems): getItems is PartialGetItemsObj {
  return typeof getItems === 'object'
}

export function isPartialGetItemsFetch (getItems: PartialGetItems): getItems is PartialGetItemsFetch {
  return typeof getItems === 'object' && !!getItems.url
}