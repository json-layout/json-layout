import { validateLayoutKeyword, isComponentName, isPartialCompObject, isPartialChildren, isPartialSwitch, type LayoutKeyword, type PartialCompObject, type PartialChildren, isPartialGetItemsFetch, type PartialExpression, isPartialGetItemsExpr, isPartialGetItemsObj, isPartialSlotMarkdown } from './layout-keyword'
import { validateNormalizedLayout, normalizedLayoutKeywordSchema, type NormalizedLayout, type CompObject, type Children, isSectionLayout, type Child, type Expression, isCompositeLayout } from '.'

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
  enum?: any[]
}

export type Markdown = (src: string) => string

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
    if (typeof partialChild === 'string') { // simple string/key referencing a known child
      const matchingDefaultChild = defaultChildren.find(c => c.key === partialChild)
      if (!matchingDefaultChild) throw new Error(`child unknown ${partialChild}`)
      return matchingDefaultChild
    } else {
      if (typeof partialChild.cols === 'number') partialChild.cols = { sm: partialChild.cols }
      if (typeof partialChild.cols === 'object' && partialChild.cols.xs === undefined) partialChild.cols.xs = 12
      if (partialChild.key) { // object referencing known child and overwriting cols
        const matchingDefaultChild = defaultChildren.find(c => c.key === partialChild.key)
        if (!matchingDefaultChild) throw new Error(`child unknown ${partialChild.key}`)
        return partialChild as Child
      } else { // a composite component definition, not directly related to a known child
        const child = partialChild as Child
        if (partialChild.children) {
          if (!partialChild.comp) child.comp = 'section'
          child.children = getChildren(defaultChildren, partialChild.children)
        }
        if (!('key' in partialChild)) {
          child.key = `$comp-${compI}`
          compI++
        }
        return child
      }
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
  const hasSimpleType = ['string', 'integer', 'number'].includes(schemaFragment.type)
  if (schemaFragment.enum && hasSimpleType) {
    const selectCompObject: CompObject = {
      comp: 'select',
      label: schemaFragment.title ?? key,
      items: schemaFragment.enum.map(value => ({ key: (value as 'string') + '', title: (value as 'string') + '', value }))
    }
    return selectCompObject
  }
  if (schemaFragment.oneOf && !(schemaFragment.oneOf.find(oneOfItem => !('const' in oneOfItem))) && hasSimpleType) {
    return {
      comp: 'select',
      label: schemaFragment.title ?? key,
      items: schemaFragment.oneOf.map(oneOfItem => ({ key: (oneOfItem.const as 'string') + '', title: ((oneOfItem.title ?? oneOfItem.const) as 'string') + '', value: oneOfItem.const }))
    }
  }
  if (schemaFragment.type === 'string') return { comp: 'text-field', label: schemaFragment.title ?? key }
  if (schemaFragment.type === 'integer') return { comp: 'number-field', label: schemaFragment.title ?? key, step: 1 }
  if (schemaFragment.type === 'number') return { comp: 'number-field', label: schemaFragment.title ?? key }
  if (schemaFragment.type === 'boolean') return { comp: 'checkbox', label: schemaFragment.title ?? key }
  console.warn(`failed to calculate default layout for schema ${schemaPath}`, schemaFragment)
  return { comp: 'none' }
}

function getPartialCompObject (layoutKeyword: LayoutKeyword): PartialCompObject | null {
  if (isPartialCompObject(layoutKeyword)) return { ...layoutKeyword }
  else if (isComponentName(layoutKeyword)) return { comp: layoutKeyword }
  else if (isPartialChildren(layoutKeyword)) return { children: layoutKeyword }
  return null
}

const normalizeExpression = (expression: PartialExpression, defaultType: Expression['type'] = 'js-eval'): Expression => {
  if (typeof expression === 'string') return { type: defaultType, expr: expression }
  else return { ...expression, type: expression.type ?? defaultType }
}

function getCompObject (layoutKeyword: LayoutKeyword, defaultCompObject: CompObject, schemaFragment: SchemaFragment, markdown: Markdown): CompObject {
  const partial = getPartialCompObject(layoutKeyword)
  if (!partial) return defaultCompObject

  if (partial.if) partial.if = normalizeExpression(partial.if)
  if (partial.getItems && isPartialGetItemsExpr(partial.getItems)) partial.getItems = normalizeExpression(partial.getItems)
  if (partial.getItems && isPartialGetItemsObj(partial.getItems)) {
    if (schemaFragment.type === 'object') partial.getItems.returnObjects = true
    if (partial.getItems.itemTitle) partial.getItems.itemTitle = normalizeExpression(partial.getItems.itemTitle)
    if (partial.getItems.itemKey) partial.getItems.itemKey = normalizeExpression(partial.getItems.itemKey)
    if (partial.getItems.itemValue) partial.getItems.itemValue = normalizeExpression(partial.getItems.itemValue)
    if (partial.getItems.itemsResults) partial.getItems.itemsResults = normalizeExpression(partial.getItems.itemsResults)
  }
  if (partial.getItems && isPartialGetItemsFetch(partial.getItems)) {
    partial.getItems.url = normalizeExpression(partial.getItems.url, 'js-tpl')
  }

  if (partial.items) {
    partial.items = partial.items.map(item => {
      if (['string', 'integer', 'number'].includes(typeof item)) {
        return { title: (item as string) + '', key: (item as string) + '', value: item }
      } else if (typeof item === 'object') {
        return {
          key: ((item.key ?? item.value) as string) + '',
          title: ((item.title ?? item.key ?? item.value) as string) + '',
          value: item.value ?? item.key
        }
      } else {
        throw new Error(`bad item for select: ${JSON.stringify(item)}`)
      }
    })
  }

  if (!partial.comp && (partial.items ?? partial.getItems)) {
    partial.comp = 'select'
  }

  if (partial.slots) {
    for (const [name, slot] of Object.entries(partial.slots)) {
      if (typeof slot === 'string') {
        if (name === 'component') {
          partial.slots[name] = { name: slot }
        } else {
          partial.slots[name] = { markdown: slot }
        }
      }
      const slotObj = partial.slots[name]
      if (isPartialSlotMarkdown(slotObj)) {
        slotObj.markdown = markdown(slotObj.markdown).trim()
      }
    }
  }

  const compObject: any = {}
  if (partial.comp && defaultCompObject.comp !== partial.comp) {
    const compProperties = normalizedLayoutKeywordSchema.$defs[partial.comp]?.properties
    if (typeof compProperties === 'object') {
      for (const key of Object.keys(compProperties).concat(['if', 'help'])) {
        if (key in defaultCompObject) compObject[key] = defaultCompObject[key as keyof CompObject]
        if (key in partial) compObject[key] = partial[key as keyof PartialCompObject]
      }
    }
  } else {
    Object.assign(compObject, defaultCompObject, partial) as CompObject
  }

  if (isSectionLayout(defaultCompObject) && isCompositeLayout(compObject)) {
    compObject.children = getChildren((defaultCompObject).children, partial.children)
  }

  if (compObject.description && !compObject.help) compObject.help = compObject.description
  if (compObject.help) compObject.help = markdown(compObject.help).trim()

  if (typeof compObject.cols === 'number') compObject.cols = { sm: compObject.cols }
  if (typeof compObject.cols === 'object' && compObject.cols.xs === undefined) compObject.cols.xs = 12

  return compObject
}

function getNormalizedLayout (layoutKeyword: LayoutKeyword, defaultCompObject: CompObject, schemaFragment: SchemaFragment, markdown: Markdown): NormalizedLayout {
  if (isPartialSwitch(layoutKeyword)) {
    const switchCases = layoutKeyword.switch.map(layout => getCompObject(layout, defaultCompObject, schemaFragment, markdown))
    if (!switchCases.find(switchCase => !switchCase.if)) switchCases.push(JSON.parse(JSON.stringify(defaultCompObject)))
    return { switch: switchCases }
  } else {
    return getCompObject(layoutKeyword, defaultCompObject, schemaFragment, markdown)
  }
}

export function normalizeLayoutFragment (schemaFragment: SchemaFragment, schemaPath: string, markdown: Markdown = (src) => src, arrayChild?: 'oneOf'): NormalizedLayout {
  let layoutKeyword, defaultCompObject: CompObject
  if (arrayChild === 'oneOf') {
    layoutKeyword = schemaFragment.oneOfLayout ?? {}
    defaultCompObject = { comp: 'one-of-select' } // TODO: default label ?
  } else {
    layoutKeyword = schemaFragment.layout ?? {}
    defaultCompObject = getDefaultCompObject(schemaFragment, schemaPath)
  }
  if (!validateLayoutKeyword(layoutKeyword)) {
    console.error(`layout keyword validation errors at path ${schemaPath}`, layoutKeyword, validateLayoutKeyword.errors)
    return defaultCompObject
    // throw new Error(`invalid layout keyword at path ${schemaPath}`, { cause: validateLayoutKeyword.errors })
  }
  const normalizedLayout = getNormalizedLayout(layoutKeyword, defaultCompObject, schemaFragment, markdown)
  if (!validateNormalizedLayout(normalizedLayout)) {
    console.error(`normalized layout validation errors at path ${schemaPath}`, normalizedLayout, validateNormalizedLayout.errors)
    return defaultCompObject
    // throw new Error(`invalid layout at path ${schemaPath}`, { cause: validateNormalizedLayout.errors })
  }
  return normalizedLayout
}
