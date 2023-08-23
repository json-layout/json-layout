import { validateLayoutKeyword, isComponentName, isPartialCompObject, isPartialChildren, isPartialSwitch, type LayoutKeyword, type PartialCompObject, type PartialChildren } from './layout-keyword'
import { validateNormalizedLayout, normalizedLayoutKeywordSchema, type NormalizedLayout, type CompObject, type Children, isSectionLayout, type Child } from '.'

export interface SchemaFragment {
  layout?: LayoutKeyword
  oneOfLayout?: LayoutKeyword
  type: string
  title?: string
  properties?: Record<string, any>
  oneOf?: any[]
  anyOf?: any[]
  allOf?: any[]
  items?: any
}

function getDefaultChildren (schemaFragment: SchemaFragment): Children {
  const children: Children = []
  if (schemaFragment.type === 'object') {
    if (schemaFragment.properties) {
      for (const key of Object.keys(schemaFragment.properties)) {
        children.push({ key })
      }
    }
    if (schemaFragment.allOf?.length) {
      for (let i = 0; i < schemaFragment.allOf.length; i++) {
        children.push({ key: `$allOf-${i}` })
      }
    }
    if (schemaFragment.oneOf) {
      children.push({ key: '$oneOf' })
    }
  }
  if (schemaFragment.type === 'array' && Array.isArray(schemaFragment.items)) {
    for (let i = 0; i < schemaFragment.items.length; i++) {
      children.push({ key: i })
    }
  }
  return children
}

function getChildren (defaultChildren: Children, partialChildren?: PartialChildren): Children {
  if (!partialChildren) return defaultChildren
  let compI = 0
  return partialChildren.map(partialChild => {
    if (typeof partialChild === 'string') {
      const matchingDefaultChild = defaultChildren.find(c => c.key === partialChild)
      if (!matchingDefaultChild) throw new Error(`child unknown ${partialChild}`)
      return matchingDefaultChild
    } else {
      if (partialChild.key) {
        const matchingDefaultChild = defaultChildren.find(c => c.key === partialChild.key)
        if (!matchingDefaultChild) throw new Error(`child unknown ${partialChild.key}`)
      }
      const child = partialChild as Child
      if (partialChild.children) {
        child.children = getChildren(defaultChildren, partialChild.children)
      }
      if (!('key' in partialChild)) {
        child.key = `$comp-${compI}`
        compI++
      }
      return child
    }
  })
}

function getDefaultCompObject (schemaFragment: SchemaFragment, schemaPath: string): CompObject {
  const key = schemaPath.slice(schemaPath.lastIndexOf('/') + 1)
  if ('const' in schemaFragment) return { comp: 'none' }
  if (!schemaFragment.type) return { comp: 'none' }
  if (schemaFragment.type === 'object') {
    return { comp: 'section', title: schemaFragment.title ?? null, children: getDefaultChildren(schemaFragment) }
  }
  if (schemaFragment.type === 'array') {
    if (!schemaFragment.items) return { comp: 'none' }
    if (Array.isArray(schemaFragment.items)) {
      return { comp: 'section', title: schemaFragment.title ?? null, children: getDefaultChildren(schemaFragment) } // tuples
    }
    return { comp: 'list', title: schemaFragment.title ?? key }
  }
  if (schemaFragment.type === 'string') return { comp: 'text-field', label: schemaFragment.title ?? key }
  if (schemaFragment.type === 'integer') return { comp: 'number-field', label: schemaFragment.title ?? key, step: 1 }
  if (schemaFragment.type === 'number') return { comp: 'number-field', label: schemaFragment.title ?? key }
  if (schemaFragment.type === 'boolean') return { comp: 'checkbox', label: schemaFragment.title ?? key }
  throw new Error(`failed to calculate default layout for schema ${schemaPath}`)
}

function getPartialCompObject (layoutKeyword: LayoutKeyword): PartialCompObject | null {
  if (isPartialCompObject(layoutKeyword)) return { ...layoutKeyword }
  else if (isComponentName(layoutKeyword)) return { comp: layoutKeyword }
  else if (isPartialChildren(layoutKeyword)) return { children: layoutKeyword }
  return null
}

function getCompObject (layoutKeyword: LayoutKeyword, defaultCompObject: CompObject): CompObject {
  const partial = getPartialCompObject(layoutKeyword)
  if (!partial) return defaultCompObject

  if (partial.if && typeof partial.if === 'string') {
    partial.if = { type: 'expr-eval', expr: partial.if }
  }

  const compObject: any = {}
  if (partial.comp && defaultCompObject.comp !== partial.comp) {
    const compProperties = normalizedLayoutKeywordSchema.$defs[partial.comp]?.properties
    const adaptedDefaultCompObject: Record<string, any> = {}
    if (typeof compProperties === 'object') {
      for (const key of Object.keys(compProperties)) {
        if (key in defaultCompObject) adaptedDefaultCompObject[key] = defaultCompObject[key as keyof CompObject]
      }
    }
    Object.assign(compObject, adaptedDefaultCompObject, partial) as CompObject
  } else {
    Object.assign(compObject, defaultCompObject, partial) as CompObject
  }

  if (isSectionLayout(defaultCompObject) && isSectionLayout(compObject)) {
    compObject.children = getChildren((defaultCompObject).children, partial.children)
  }

  return compObject
}

function getNormalizedLayout (layoutKeyword: LayoutKeyword, defaultCompObject: CompObject): NormalizedLayout {
  if (isPartialSwitch(layoutKeyword)) {
    return {
      switch: layoutKeyword.switch.map(layout => getCompObject(layout, defaultCompObject))
    }
  } else {
    return getCompObject(layoutKeyword, defaultCompObject)
  }
}

export function normalizeLayoutFragment (schemaFragment: SchemaFragment, schemaPath: string, arrayChild?: 'oneOf'): NormalizedLayout {
  let layoutKeyword, defaultCompObject: CompObject
  if (arrayChild === 'oneOf') {
    layoutKeyword = schemaFragment.oneOfLayout ?? {}
    defaultCompObject = { comp: 'one-of-select' } // TODO: default label ?
  } else {
    layoutKeyword = schemaFragment.layout ?? {}
    defaultCompObject = getDefaultCompObject(schemaFragment, schemaPath)
  }
  if (!validateLayoutKeyword(layoutKeyword)) {
    console.log(`layout keyword validation errors at path ${schemaPath}`, validateLayoutKeyword.errors)
    throw new Error(`invalid layout keyword at path ${schemaPath}`, { cause: validateLayoutKeyword.errors })
  }
  const normalizedLayout = getNormalizedLayout(layoutKeyword, defaultCompObject)
  if (!validateNormalizedLayout(normalizedLayout)) {
    console.log(`normalized layout validation errors at path ${schemaPath}`, JSON.stringify(normalizedLayout, null, 2), validateNormalizedLayout.errors)
    throw new Error(`invalid layout at path ${schemaPath}`, { cause: validateNormalizedLayout.errors })
  }
  return normalizedLayout
}
