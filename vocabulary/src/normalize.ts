import {
  validateLayoutKeyword, isComponentName, isPartialCompObject, isChildren,
  type LayoutKeyword, type PartialCompObject, isResponsive, isReadWrite
} from './layout-keyword'
import { validateNormalizedLayout, type NormalizedLayout, type NormalizedResponsive, type CompObject } from '.'

export interface SchemaFragment {
  layout?: LayoutKeyword
  type: string
  properties?: Record<string, any>
  oneOf?: any[]
  anyOf?: any[]
  allOf?: any[]
}

function getDefaultCompObject (schemaFragment: SchemaFragment, schemaPath: string): CompObject {
  if (schemaFragment.type === 'object') return { comp: 'section' }
  if (schemaFragment.type === 'string') return { comp: 'text-field' }
  throw new Error(`failed to calculate default layout for schema ${schemaPath}`)
}

function getPartialCompObject (layoutKeyword: LayoutKeyword): PartialCompObject | null {
  if (isPartialCompObject(layoutKeyword)) return layoutKeyword
  else if (isComponentName(layoutKeyword)) return { comp: layoutKeyword }
  else if (isChildren(layoutKeyword)) return { children: layoutKeyword }
  return null
}

function getCompObject (layoutKeyword: LayoutKeyword, defaultCompObject: CompObject): CompObject {
  const partial = getPartialCompObject(layoutKeyword)
  return Object.assign({}, defaultCompObject, partial) as CompObject
}

function getResponsive (layoutKeyword: LayoutKeyword, defaultCompObject: CompObject): NormalizedResponsive {
  if (isResponsive(layoutKeyword)) {
    const xs = getCompObject(layoutKeyword.xs || {}, defaultCompObject)
    const sm = getCompObject(layoutKeyword.sm || {}, xs)
    const md = getCompObject(layoutKeyword.sm || {}, sm)
    const lg = getCompObject(layoutKeyword.sm || {}, md)
    const xl = getCompObject(layoutKeyword.sm || {}, lg)
    return { xs, sm, md, lg, xl }
  } else {
    const compObject = getCompObject(layoutKeyword, defaultCompObject)
    return { xs: compObject, sm: compObject, md: compObject, lg: compObject, xl: compObject }
  }
}

function getNormalizedLayout (layoutKeyword: LayoutKeyword, defaultCompObject: CompObject): NormalizedLayout {
  if (isReadWrite(layoutKeyword)) {
    return {
      read: getResponsive(layoutKeyword.read || {}, defaultCompObject),
      write: getResponsive(layoutKeyword.write || {}, defaultCompObject)
    }
  } else {
    const responsive = getResponsive(layoutKeyword, defaultCompObject)
    return { read: responsive, write: responsive }
  }
}

export function normalizeLayoutFragment (schemaFragment: SchemaFragment, schemaPath: string): NormalizedLayout {
  const layoutKeyword = schemaFragment.layout || {}
  if (!validateLayoutKeyword(layoutKeyword)) {
    throw new Error(`invalid layout keyword at path ${schemaPath}`, { cause: validateLayoutKeyword.errors })
  }
  const defaultCompObject = getDefaultCompObject(schemaFragment, schemaPath)
  const normalizedLayout = getNormalizedLayout(layoutKeyword, defaultCompObject)
  if (!validateNormalizedLayout(normalizedLayout)) {
    throw new Error('invalid layout', { cause: validateNormalizedLayout.errors })
  }
  return normalizedLayout
}
