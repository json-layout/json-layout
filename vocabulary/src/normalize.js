import { validateLayoutKeyword, isComponentName, isPartialCompObject, isPartialChildren, isPartialSwitch, isPartialGetItemsExpr, isPartialGetItemsObj, isPartialSlotMarkdown, isPartialGetItemsFetch } from './layout-keyword/index.js'
import { validateNormalizedLayout, normalizedLayoutSchema, isSectionLayout, isCompositeLayout } from './index.js'

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

// export type Markdown = (src: string) => string

// this navice implementation is sufficient here, not used very often
const clone = (/** @type {any} */ obj) => JSON.parse(JSON.stringify(obj))

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
 * @param {SchemaFragment} schemaFragment
 * @param {string} schemaPath
 * @returns {import('./index.js').CompObject}
 */
function getDefaultCompObject (schemaFragment, schemaPath) {
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
    return {
      comp: 'select',
      label: schemaFragment.title ?? key,
      items: schemaFragment.enum.map((/** @type {string} */ value) => ({ key: value + '', title: value + '', value }))
    }
  }
  if (schemaFragment.oneOf && !(schemaFragment.oneOf.find((/** @type {any} */ oneOfItem) => !('const' in oneOfItem))) && hasSimpleType) {
    return {
      comp: 'select',
      label: schemaFragment.title ?? key,
      items: schemaFragment.oneOf.map((/** @type {{ const: string; title: any; }} */ oneOfItem) => ({ key: oneOfItem.const + '', title: (oneOfItem.title ?? oneOfItem.const) + '', value: oneOfItem.const }))
    }
  }
  if (schemaFragment.type === 'string') {
    if (schemaFragment.format) {
      /** @type {CompObject | null} */
      let formatCompObject = null
      if (schemaFragment.format === 'date') formatCompObject = { comp: 'date-picker', label: schemaFragment.title ?? key, format: 'date' }
      if (schemaFragment.format === 'date-time') formatCompObject = { comp: 'date-time-picker', label: schemaFragment.title ?? key }
      if (schemaFragment.format === 'time') formatCompObject = { comp: 'time-picker', label: schemaFragment.title ?? key }
      if (formatCompObject) {
        if ('formatMinimum' in schemaFragment) formatCompObject.min = schemaFragment.formatMinimum
        if ('formatMaximum' in schemaFragment) formatCompObject.max = schemaFragment.formatMaximum
        return formatCompObject
      }
    }
    return { comp: 'text-field', label: schemaFragment.title ?? key }
  }
  if (schemaFragment.type === 'integer' || schemaFragment.type === 'number') {
    /** @type {import('./index.js').NumberField} */
    const compObject = { comp: 'number-field', label: schemaFragment.title ?? key }
    if (schemaFragment.type === 'integer') compObject.step = 1
    if ('minimum' in schemaFragment) compObject.min = schemaFragment.minimum
    if ('maximum' in schemaFragment) compObject.max = schemaFragment.maximum
    return compObject
  }
  if (schemaFragment.type === 'boolean') return { comp: 'checkbox', label: schemaFragment.title ?? key }
  console.warn(`failed to calculate default layout for schema ${schemaPath}`, schemaFragment)
  return { comp: 'none' }
}

/**
 * @param {LayoutKeyword} layoutKeyword
 * @returns {PartialCompObject | null}
 */
function getPartialCompObject (layoutKeyword) {
  if (isPartialCompObject(layoutKeyword)) return { ...layoutKeyword }
  else if (isComponentName(layoutKeyword)) return { comp: layoutKeyword }
  else if (isPartialChildren(layoutKeyword)) return { children: layoutKeyword }
  return null
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
 * @param {LayoutKeyword} layoutKeyword
 * @param {CompObject} defaultCompObject
 * @param {SchemaFragment} schemaFragment
 * @param {(text: string) => string} markdown
 * @returns {CompObject}
 */
function getCompObject (layoutKeyword, defaultCompObject, schemaFragment, markdown) {
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

  /** @type {any} */
  const compObject = {}
  if (partial.comp && defaultCompObject.comp !== partial.comp) {
    const compProperties = normalizedLayoutSchema.$defs[partial.comp]?.properties
    if (typeof compProperties === 'object') {
      for (const key of Object.keys(compProperties).concat(['if', 'help', 'cols', 'props', 'slots', 'options'])) {
        if (key in defaultCompObject) compObject[key] = defaultCompObject[key]
        if (key in partial) compObject[key] = partial[key]
      }
    }
  } else {
    Object.assign(compObject, defaultCompObject, partial)
  }

  if (isSectionLayout(defaultCompObject) && isCompositeLayout(compObject)) {
    compObject.children = getChildren((defaultCompObject).children, partial.children)
  }

  if (compObject.description && !compObject.help) compObject.help = compObject.description
  if (compObject.help) compObject.help = markdown(compObject.help).trim()

  if (typeof compObject.cols === 'number') compObject.cols = { xs: compObject.cols }
  if (typeof compObject.cols === 'object' && compObject.cols.xs === undefined) compObject.cols.xs = 12

  return compObject
}

/**
 * @param {LayoutKeyword} layoutKeyword
 * @param {CompObject} defaultCompObject
 * @param {SchemaFragment} schemaFragment
 * @param {(text: string) => string} markdown
 * @returns {NormalizedLayout}
 */
function getNormalizedLayout (layoutKeyword, defaultCompObject, schemaFragment, markdown) {
  if (isPartialSwitch(layoutKeyword)) {
    const switchCases = layoutKeyword.switch.map(layout => getCompObject(layout, clone(defaultCompObject), schemaFragment, markdown))
    if (!switchCases.find(switchCase => !switchCase.if)) switchCases.push(clone(defaultCompObject))
    return { switch: switchCases }
  } else {
    return getCompObject(layoutKeyword, defaultCompObject, schemaFragment, markdown)
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
  /** @type {CompObject} */
  let defaultCompObject
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
