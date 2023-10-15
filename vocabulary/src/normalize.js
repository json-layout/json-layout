import { validateLayoutKeyword, isComponentName, isPartialCompObject, isPartialChildren, isPartialSwitch, isPartialGetItemsExpr, isPartialGetItemsObj, isPartialSlotMarkdown, isPartialGetItemsFetch } from './layout-keyword/index.js'
import { validateNormalizedLayout, compositeCompNames } from './normalized-layout/index.js'

/**
 * @typedef {import('./index.js').Child} Child
 * @typedef {import('./index.js').Children} Children
 * @typedef {import('./index.js').CompObject} CompObject
 * @typedef {import('./index.js').Expression} Expression
 * @typedef {import('./index.js').NormalizedLayout} NormalizedLayout
 * @typedef {import('./index.js').LayoutKeyword} LayoutKeyword
 * @typedef {import('./index.js').PartialChildren} PartialChildren
 * @typedef {import('./index.js').PartialCompObject} PartialCompObject
 * @typedef {import("./types.js").SchemaFragment} SchemaFragment
 */

/**
 * @param {import('./types.js').SchemaFragment} schemaFragment
 * @returns {Children}
 */
function getDefaultChildren (schemaFragment) {
  /** @type {Children} */
  const children = []
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

/**
 * @param {Children} defaultChildren
 * @param {PartialChildren} [partialChildren]
 * @returns {Children}
 */
function getChildren (defaultChildren, partialChildren) {
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
        return /** @type {Child} */ (partialChild)
      } else { // a composite component definition, not directly related to a known child
        const child = partialChild
        if (partialChild.children) {
          if (!partialChild.comp) child.comp = 'section'
          child.children = getChildren(defaultChildren, partialChild.children)
        }
        if (!('key' in partialChild)) {
          child.key = `$comp-${compI}`
          compI++
        }
        return /** @type {Child} */ (child)
      }
    }
  })
}

/**
 * @param {PartialCompObject} partial
 * @param {SchemaFragment} schemaFragment
 * @param {'oneOf'} [arrayChild]
 * @returns {import('./index.js').ComponentName}
 */
function getDefaultComp (partial, schemaFragment, arrayChild) {
  const hasSimpleType = ['string', 'integer', 'number'].includes(schemaFragment.type)
  if (arrayChild === 'oneOf') return 'one-of-select'
  if (hasSimpleType && (schemaFragment.enum || schemaFragment.oneOf)) return 'select'
  if (partial.items || partial.getItems) return 'select'
  if (schemaFragment.type === 'array' && schemaFragment.items) {
    if (['string', 'integer', 'number'].includes(schemaFragment.items.type) && (schemaFragment.items.enum || schemaFragment.items.oneOf)) {
      return 'select'
    }
    if (schemaFragment.items.type === 'string' && !schemaFragment.items.layout && !['date', 'date-time', 'time'].includes(schemaFragment.items.format)) {
      return 'combobox'
    }
  }
  if (schemaFragment.type === 'object') return 'section'
  if (schemaFragment.type === 'array') {
    if (Array.isArray(schemaFragment.items)) return 'section'
    else return 'list'
  }
  if (schemaFragment.type === 'string') {
    if (schemaFragment.format === 'date') return 'date-picker'
    if (schemaFragment.format === 'date-time') return 'date-time-picker'
    if (schemaFragment.format === 'time') return 'time-picker'
    return 'text-field'
  }
  if (schemaFragment.type === 'integer' || schemaFragment.type === 'number') return 'number-field'
  if (schemaFragment.type === 'boolean') return 'checkbox'
  console.warn('failed to calculate default component for schema fragment', schemaFragment)
  return 'none'
}

/**
 * @param {LayoutKeyword} layoutKeyword
 * @returns {PartialCompObject}
 */
function getPartialCompObject (layoutKeyword) {
  if (isPartialCompObject(layoutKeyword)) return { ...layoutKeyword }
  else if (isComponentName(layoutKeyword)) return { comp: layoutKeyword }
  else if (isPartialChildren(layoutKeyword)) return { children: layoutKeyword }
  return {}
}

/**
 * @param {import("./index.js").PartialExpression} expression
 * @param {Expression['type']} defaultType
 * @returns {Expression}
 */
function normalizeExpression (expression, defaultType = 'js-eval') {
  if (typeof expression === 'string') return { type: defaultType, expr: expression }
  else return { ...expression, type: expression.type ?? defaultType }
}

/**
 * @param {SchemaFragment} schemaFragment
 * @returns {import('./index.js').PartialSelectItem[] | null}
 */
function getItemsFromSchema (schemaFragment) {
  if (!schemaFragment) return null
  const hasSimpleType = ['string', 'integer', 'number'].includes(schemaFragment.type)
  if (schemaFragment.enum && hasSimpleType) {
    return schemaFragment.enum.map((/** @type {string} */ value) => ({ key: value + '', title: value + '', value }))
  }
  if (schemaFragment.oneOf && hasSimpleType && !(schemaFragment.oneOf.find((/** @type {any} */ oneOfItem) => !('const' in oneOfItem)))) {
    return schemaFragment.oneOf.map((/** @type {{ const: string; title: any; }} */ oneOfItem) => ({ key: oneOfItem.const + '', title: (oneOfItem.title ?? oneOfItem.const) + '', value: oneOfItem.const }))
  }
  return null
}

/**
 * @param {LayoutKeyword} layoutKeyword
 * @param {SchemaFragment} schemaFragment
 * @param {string} schemaPath
 * @param {(text: string) => string} markdown
 * @param {'oneOf'} [arrayChild]
 * @returns {CompObject}
 */
function getCompObject (layoutKeyword, schemaFragment, schemaPath, markdown, arrayChild) {
  const key = schemaPath.slice(schemaPath.lastIndexOf('/') + 1)

  if ('const' in schemaFragment) return { comp: 'none' }
  if (!schemaFragment.type) return { comp: 'none' }
  if (schemaFragment.type === 'array' && !schemaFragment.items) return { comp: 'none' }

  const partial = getPartialCompObject(layoutKeyword)

  // chose the default component for a schema fragment
  if (!partial.comp) partial.comp = getDefaultComp(partial, schemaFragment, arrayChild)
  if (partial.comp === 'none') return { comp: 'none' }

  // @ts-ignore
  if (compositeCompNames.includes(partial.comp)) {
    partial.title = partial.title ?? schemaFragment.title ?? null
    partial.children = getChildren(getDefaultChildren(schemaFragment), partial.children)
  } else if (partial.comp === 'list') {
    partial.title = partial.title ?? schemaFragment.title ?? key
    partial.listEditMode = partial.listEditMode ?? (schemaFragment.items.type === 'object' ? 'inline-single' : 'inline')
    partial.listActions = partial.listActions ?? ['add', 'edit', 'delete', 'duplicate', 'sort']
  } else {
    partial.label = partial.label ?? schemaFragment.title ?? key
  }

  if (partial.comp === 'select' && !partial.items) {
    let items
    if (schemaFragment.type === 'array') {
      items = getItemsFromSchema(schemaFragment.items)
      partial.multiple = true
    } else {
      items = getItemsFromSchema(schemaFragment)
    }
    if (items) partial.items = items
  }

  if (partial.comp === 'combobox') {
    if (schemaFragment.type === 'array') {
      partial.multiple = true
    }
  }

  if (partial.comp === 'date-picker') {
    if (schemaFragment.format === 'date') partial.format = 'date'
    if (schemaFragment.format === 'date-time') partial.format = 'date-time'
  }

  if (['date-picker', 'date-time-picker', 'time-picker'].includes(partial.comp)) {
    if ('formatMinimum' in schemaFragment) partial.min = partial.min ?? schemaFragment.formatMinimum
    if ('formatMaximum' in schemaFragment) partial.max = partial.max ?? schemaFragment.formatMaximum
  }

  if (['number-field', 'slider'].includes(partial.comp)) {
    if (schemaFragment.type === 'integer') partial.step = partial.step ?? 1
    if ('minimum' in schemaFragment) partial.min = partial.min ?? schemaFragment.minimum
    if ('maximum' in schemaFragment) partial.max = partial.max ?? schemaFragment.maximum
  }

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
    partial.items = partial.items.map((/** @type {import('./index.js').PartialSelectItem} */ item) => {
      if (['string', 'integer', 'number'].includes(typeof item)) {
        return { title: item + '', key: item + '', value: item }
      } else if (typeof item === 'object') {
        return {
          key: (item.key ?? item.value) + '',
          title: (item.title ?? item.key ?? item.value) + '',
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

  if (partial.comp === 'date-picker' && schemaFragment.format === 'date-time') {
    partial.format = 'date-time'
  }

  if (partial.slots) {
    for (const [name, slot] of Object.entries(partial.slots)) {
      if (typeof slot === 'string') {
        if (['before', 'after'].includes(name)) {
          partial.slots[name] = { markdown: slot }
        } else {
          partial.slots[name] = { name: slot }
        }
      }
      const slotObj = partial.slots[name]
      if (isPartialSlotMarkdown(slotObj)) {
        slotObj.markdown = markdown(slotObj.markdown).trim()
      }
    }
  }

  if (schemaFragment.description && !partial.help) partial.help = schemaFragment.description
  if (partial.help) partial.help = markdown(partial.help).trim()

  if (typeof partial.cols === 'number') partial.cols = { xs: partial.cols }
  if (typeof partial.cols === 'object' && partial.cols.xs === undefined) partial.cols.xs = 12

  return /** @type {CompObject} */(partial)
}

/**
 * @param {LayoutKeyword} layoutKeyword
 * @param {SchemaFragment} schemaFragment
 * @param {string} schemaPath
 * @param {(text: string) => string} markdown
 * @param {'oneOf'} [arrayChild]
 * @returns {NormalizedLayout}
 */
function getNormalizedLayout (layoutKeyword, schemaFragment, schemaPath, markdown, arrayChild) {
  if (isPartialSwitch(layoutKeyword)) {
    const switchCases = layoutKeyword.switch.map(layout => getCompObject(layout, schemaFragment, schemaPath, markdown, arrayChild))
    if (!switchCases.find(switchCase => !switchCase.if)) switchCases.push(getCompObject({}, schemaFragment, schemaPath, markdown, arrayChild))
    return { switch: switchCases }
  } else {
    return getCompObject(layoutKeyword, schemaFragment, schemaPath, markdown, arrayChild)
  }
}

/**
 * @param {SchemaFragment} schemaFragment
 * @param {string} schemaPath
 * @param {(text: string) => string} markdown
 * @param {'oneOf'} [arrayChild]
 * @returns {NormalizedLayout}
 */
export function normalizeLayoutFragment (schemaFragment, schemaPath, markdown = (src) => src, arrayChild) {
  let layoutKeyword
  if (arrayChild === 'oneOf') {
    layoutKeyword = schemaFragment.oneOfLayout ?? {}
  } else {
    layoutKeyword = schemaFragment.layout ?? {}
  }
  if (!validateLayoutKeyword(layoutKeyword)) {
    console.error(`layout keyword validation errors at path ${schemaPath}`, layoutKeyword, validateLayoutKeyword.errors)
    return getNormalizedLayout({}, schemaFragment, schemaPath, markdown, arrayChild)
    // throw new Error(`invalid layout keyword at path ${schemaPath}`, { cause: validateLayoutKeyword.errors })
  }
  const normalizedLayout = getNormalizedLayout(layoutKeyword, schemaFragment, schemaPath, markdown, arrayChild)
  if (!validateNormalizedLayout(normalizedLayout)) {
    console.error(`normalized layout validation errors at path ${schemaPath}`, normalizedLayout, validateNormalizedLayout.errors)
    return getNormalizedLayout({}, schemaFragment, schemaPath, markdown, arrayChild)
    // throw new Error(`invalid layout at path ${schemaPath}`, { cause: validateNormalizedLayout.errors })
  }
  return normalizedLayout
}
