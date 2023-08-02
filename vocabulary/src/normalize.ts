import { validateLayoutKeyword, isComponentName, isPartialCompObject, isChildren, isPartialSwitch, type LayoutKeyword, type PartialCompObject } from './layout-keyword'
import { validateNormalizedLayout, normalizedLayoutKeywordSchema, type NormalizedLayout, type CompObject } from '.'

export interface SchemaFragment {
  layout?: LayoutKeyword
  type: string
  title?: string
  properties?: Record<string, any>
  oneOf?: any[]
  anyOf?: any[]
  allOf?: any[]
}

function getDefaultCompObject (schemaFragment: SchemaFragment, schemaPath: string): CompObject {
  const key = schemaPath.slice(schemaPath.lastIndexOf('/') + 1)
  if (schemaFragment.type === 'object') return { comp: 'section' }
  if (schemaFragment.type === 'string') return { comp: 'text-field', label: schemaFragment.title ?? key }
  if (schemaFragment.type === 'integer') return { comp: 'number-field', label: schemaFragment.title ?? key, step: 1 }
  if (schemaFragment.type === 'number') return { comp: 'number-field', label: schemaFragment.title ?? key }
  if (schemaFragment.type === 'boolean') return { comp: 'checkbox', label: schemaFragment.title ?? key }
  throw new Error(`failed to calculate default layout for schema ${schemaPath}`)
}

function getPartialCompObject (layoutKeyword: LayoutKeyword): PartialCompObject | null {
  if (isPartialCompObject(layoutKeyword)) return { ...layoutKeyword }
  else if (isComponentName(layoutKeyword)) return { comp: layoutKeyword }
  else if (isChildren(layoutKeyword)) return { children: layoutKeyword }
  return null
}

function getCompObject (layoutKeyword: LayoutKeyword, defaultCompObject: CompObject): CompObject {
  const partial = getPartialCompObject(layoutKeyword)
  if (!partial) return defaultCompObject

  if (partial.if && typeof partial.if === 'string') {
    partial.if = { type: 'expr-eval', expr: partial.if }
  }

  if (partial.comp && defaultCompObject.comp !== partial.comp) {
    const compProperties = normalizedLayoutKeywordSchema.$defs[partial.comp]?.properties
    const mergedCompObject: Record<string, any> = {}
    if (typeof compProperties === 'object') {
      for (const key of Object.keys(compProperties)) {
        if (key in defaultCompObject) mergedCompObject[key] = defaultCompObject[key as keyof CompObject]
      }
    }
    return Object.assign(mergedCompObject, partial) as CompObject
  }
  return Object.assign({}, defaultCompObject, partial) as CompObject
}

function getNormalizedLayout (layoutKeyword: LayoutKeyword, defaultCompObject: CompObject): NormalizedLayout {
  if (isPartialSwitch(layoutKeyword)) {
    return layoutKeyword.map(layout => getCompObject(layout, defaultCompObject))
  } else {
    return getCompObject(layoutKeyword, defaultCompObject)
  }
}

export function normalizeLayoutFragment (schemaFragment: SchemaFragment, schemaPath: string): NormalizedLayout {
  const layoutKeyword = schemaFragment.layout ?? {}
  if (!validateLayoutKeyword(layoutKeyword)) {
    console.log(`layout keyword validation errors at path ${schemaPath}`, validateNormalizedLayout.errors)
    throw new Error(`invalid layout keyword at path ${schemaPath}`, { cause: validateLayoutKeyword.errors })
  }
  const defaultCompObject = getDefaultCompObject(schemaFragment, schemaPath)
  const normalizedLayout = getNormalizedLayout(layoutKeyword, defaultCompObject)
  if (!validateNormalizedLayout(normalizedLayout)) {
    console.log(`normalized layout validation errors at path ${schemaPath}`, validateNormalizedLayout.errors)
    throw new Error(`invalid layout at path ${schemaPath}`, { cause: validateNormalizedLayout.errors })
  }
  return normalizedLayout
}
