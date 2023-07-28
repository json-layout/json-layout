import {LayoutKeyword, ComponentName, Children, ReadWrite, Responsive, PartialCompObject} from './types'
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

export function isChildren (layoutKeyword: LayoutKeyword): layoutKeyword is Children {
  return Array.isArray(layoutKeyword)
}

export function isReadWrite (layoutKeyword: LayoutKeyword): layoutKeyword is ReadWrite {
  return typeof layoutKeyword === 'object' && (!!(layoutKeyword as ReadWrite).read || !!(layoutKeyword as ReadWrite).write)
}

export function isResponsive (layoutKeyword: LayoutKeyword): layoutKeyword is Responsive {
  return typeof layoutKeyword === 'object' && (
    !!(layoutKeyword as Responsive).xs ||
    !!(layoutKeyword as Responsive).sm || 
    !!(layoutKeyword as Responsive).md || 
    !!(layoutKeyword as Responsive).lg ||
    !!(layoutKeyword as Responsive).xl
  )
}

export function isPartialCompObject (layoutKeyword: LayoutKeyword): layoutKeyword is PartialCompObject {
  return typeof layoutKeyword === 'object' && !isReadWrite(layoutKeyword) && !isResponsive(layoutKeyword)
}