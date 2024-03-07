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
  const { type } = getType(schemaFragment)
  /** @type {Children} */
  const children = []
  if (type === 'object') {
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
  if (type === 'array' && Array.isArray(schemaFragment.items)) {
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
  const { type } = getType(schemaFragment)
  const hasSimpleType = ['string', 'integer', 'number'].includes(type)
  if (arrayChild === 'oneOf') return 'one-of-select'
  if (hasSimpleType && schemaFragment.enum) return schemaFragment.enum.length > 20 ? 'autocomplete' : 'select'
  if (hasSimpleType && schemaFragment.oneOf) return schemaFragment.oneOf.length > 20 ? 'autocomplete' : 'select'
  if (hasSimpleType && schemaFragment.examples) return type === 'string' ? 'combobox' : 'number-combobox'
  if (hasSimpleType && schemaFragment.anyOf && schemaFragment.anyOf.length && Object.keys(schemaFragment.anyOf[schemaFragment.anyOf.length - 1]).length === 0) {
    return type === 'string' ? 'combobox' : 'number-combobox'
  }
  if (partial.items) return partial.items.length > 20 ? 'autocomplete' : 'select'
  if (partial.getItems) {
    if (isPartialGetItemsFetch(partial.getItems)) {
      if (partial.getItems.qSearchParam) return 'autocomplete'
      if (typeof partial.getItems.url === 'string' && partial.getItems.url.includes('{q}')) return 'autocomplete'
    }
    return 'select'
  }
  if (type === 'array' && schemaFragment.items) {
    const hasSimpleTypeItems = ['string', 'integer', 'number'].includes(schemaFragment.items.type)
    if (hasSimpleTypeItems && (schemaFragment.items.enum || schemaFragment.items.oneOf)) {
      return (schemaFragment.items.enum || schemaFragment.items.oneOf).length > 20 ? 'autocomplete' : 'select'
    }
    if (hasSimpleTypeItems && schemaFragment.items.examples) {
      return schemaFragment.items.type === 'string' ? 'combobox' : 'number-combobox'
    }
    if (hasSimpleTypeItems && schemaFragment.items.anyOf && schemaFragment.items.anyOf.length && Object.keys(schemaFragment.items.anyOf[schemaFragment.items.anyOf.length - 1]).length === 0) {
      return schemaFragment.items.type === 'string' ? 'combobox' : 'number-combobox'
    }
    if (hasSimpleTypeItems && !schemaFragment.items.layout && !['date', 'date-time', 'time'].includes(schemaFragment.items.format)) {
      return schemaFragment.items.type === 'string' ? 'combobox' : 'number-combobox'
    }
  }
  if (type === 'object') return 'section'
  if (type === 'array') {
    if (Array.isArray(schemaFragment.items)) return 'section'
    else return 'list'
  }
  if (type === 'string') {
    if (schemaFragment.format === 'date') return 'date-picker'
    if (schemaFragment.format === 'date-time') return 'date-time-picker'
    if (schemaFragment.format === 'time') return 'time-picker'
    return 'text-field'
  }
  if (type === 'integer' || type === 'number') return 'number-field'
  if (type === 'boolean') return 'checkbox'
  throw new Error('failed to calculate default component for schema fragment')
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
  if (typeof expression === 'string') return { type: defaultType, expr: expression, pure: true }
  else return { pure: true, type: defaultType, ...expression }
}

/**
 * @param {SchemaFragment} schemaFragment
 * @returns {import('./index.js').PartialSelectItem[] | null}
 */
function getItemsFromSchema (schemaFragment) {
  if (!schemaFragment) return null
  const { type } = getType(schemaFragment)
  const hasSimpleType = ['string', 'integer', 'number'].includes(type)
  if (schemaFragment.enum && hasSimpleType) {
    return schemaFragment.enum.map((/** @type {string} */ value) => ({ key: value + '', title: value + '', value }))
  }
  if (schemaFragment.examples && hasSimpleType) {
    return schemaFragment.examples.map((/** @type {string} */ value) => ({ key: value + '', title: value + '', value }))
  }
  if (schemaFragment.anyOf && hasSimpleType && schemaFragment.anyOf.length && Object.keys(schemaFragment.anyOf[schemaFragment.anyOf.length - 1]).length === 0) {
    const nonEmptyAnyOf = schemaFragment.anyOf.slice(0, -1)
    if (!(nonEmptyAnyOf.find((/** @type {any} */ oneOfItem) => !('const' in oneOfItem)))) {
      return nonEmptyAnyOf.map((/** @type {{ const: string; title: any; }} */ anyOfItem) => ({
        ...anyOfItem,
        key: anyOfItem.const + '',
        title: (anyOfItem.title ?? anyOfItem.const) + '',
        value: anyOfItem.const
      }))
    }
  }
  if (schemaFragment.oneOf && hasSimpleType && !(schemaFragment.oneOf.find((/** @type {any} */ oneOfItem) => !('const' in oneOfItem)))) {
    return schemaFragment.oneOf.map((/** @type {{ const: string; title: any; }} */ oneOfItem) => ({
      ...oneOfItem,
      key: oneOfItem.const + '',
      title: (oneOfItem.title ?? oneOfItem.const) + '',
      value: oneOfItem.const
    }))
  }
  return null
}

/**
 * @param {SchemaFragment} schemaFragment
 * @returns {{type: string, nullable: boolean}}
 */
const getType = (schemaFragment) => {
  if (Array.isArray(schemaFragment.type) && schemaFragment.type.length === 2 && schemaFragment.type.includes('null')) {
    const type = schemaFragment.type.find(t => t !== 'null')
    return { type, nullable: true }
  }
  return { type: schemaFragment.type, nullable: false }
}

/**
 * @param {LayoutKeyword} layoutKeyword
 * @param {SchemaFragment} schemaFragment
 * @param {string} schemaPath
 * @param {(text: string) => string} markdown
 * @param {'oneOf'} [arrayChild]
 * @returns {{normalized: CompObject, errors: string[]}}
 */
function getCompObject (layoutKeyword, schemaFragment, schemaPath, markdown, arrayChild) {
  /** @type {string[]} */
  const errors = []
  const key = schemaPath.slice(schemaPath.lastIndexOf('/') + 1)

  const { type, nullable } = getType(schemaFragment)

  if ('const' in schemaFragment) return { normalized: { comp: 'none' }, errors }
  if (!type) return { normalized: { comp: 'none' }, errors }

  const partial = getPartialCompObject(layoutKeyword)

  if (type === 'array' && !schemaFragment.items && partial.comp !== 'file-input') {
    return { normalized: { comp: 'none' }, errors }
  }

  // chose the default component for a schema fragment
  if (!partial.comp) {
    try {
      partial.comp = getDefaultComp(partial, schemaFragment, arrayChild)
    } catch (/** @type {any} */err) {
      errors.push(err.message)
      partial.comp = 'none'
    }
  }
  if (partial.comp === 'none') return { normalized: { comp: 'none' }, errors }

  if (nullable) partial.nullable = nullable

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

  if (['select', 'autocomplete', 'combobox'].includes(partial.comp) && !partial.items) {
    let items
    if (type === 'array') {
      items = getItemsFromSchema(schemaFragment.items)
      partial.multiple = true
    } else {
      items = getItemsFromSchema(schemaFragment)
    }
    if (items) {
      if (partial.getItems && isPartialGetItemsObj(partial.getItems)) {
        partial.getItems.expr = JSON.stringify(items)
      } else {
        partial.getItems = JSON.stringify(items)
      }
    }
  }

  if (['combobox', 'number-combobox', 'file-input'].includes(partial.comp)) {
    if (type === 'array') {
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
    if (type === 'integer') partial.step = partial.step ?? 1
    if ('minimum' in schemaFragment) partial.min = partial.min ?? schemaFragment.minimum
    if ('maximum' in schemaFragment) partial.max = partial.max ?? schemaFragment.maximum
  }

  if (partial.if) partial.if = normalizeExpression(partial.if)

  if (!partial.defaultData && schemaFragment.type === 'string' && schemaPath.split('#').pop() === '') {
    partial.defaultData = ''
  }

  if (schemaFragment.readOnly) {
    partial.options = partial.options ?? {}
    partial.options.readOnly = true
  }

  if (partial.getOptions !== undefined) partial.getOptions = normalizeExpression(partial.getOptions)
  if (partial.getDefaultData !== undefined) partial.getDefaultData = normalizeExpression(partial.getDefaultData)
  if (partial.getConstData !== undefined) partial.getConstData = normalizeExpression(partial.getConstData)
  if (partial.transformData !== undefined) partial.transformData = normalizeExpression(partial.transformData)
  if (partial.getProps !== undefined) partial.getProps = normalizeExpression(partial.getProps)

  if (partial.getItems && isPartialGetItemsExpr(partial.getItems)) partial.getItems = normalizeExpression(partial.getItems)
  if (partial.getItems && isPartialGetItemsObj(partial.getItems)) {
    if (type === 'object') partial.getItems.returnObjects = true
    if (partial.getItems.itemTitle) partial.getItems.itemTitle = normalizeExpression(partial.getItems.itemTitle)
    if (partial.getItems.itemKey) partial.getItems.itemKey = normalizeExpression(partial.getItems.itemKey)
    if (partial.getItems.itemValue) partial.getItems.itemValue = normalizeExpression(partial.getItems.itemValue)
    if (partial.getItems.itemIcon) partial.getItems.itemIcon = normalizeExpression(partial.getItems.itemIcon)
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

  return { normalized: /** @type {CompObject} */(partial), errors }
}

/**
 * @param {LayoutKeyword} layoutKeyword
 * @param {SchemaFragment} schemaFragment
 * @param {string} schemaPath
 * @param {(text: string) => string} markdown
 * @param {'oneOf'} [arrayChild]
 * @returns {{normalized: NormalizedLayout, errors: string[]}}
 */
function getNormalizedLayout (layoutKeyword, schemaFragment, schemaPath, markdown, arrayChild) {
  if (isPartialSwitch(layoutKeyword)) {
    /** @type {CompObject[]} */
    const normalizedSwitchCases = []
    const errors = []
    const switchCases = [...layoutKeyword.switch]
    if (!switchCases.find(s => !s.if)) {
      switchCases.push({})
    }
    for (let i = 0; i < switchCases.length; i++) {
      const switchCase = switchCases[i]
      const compObjectResult = getCompObject(switchCase, schemaFragment, schemaPath, markdown, arrayChild)
      normalizedSwitchCases.push(compObjectResult.normalized)
      for (const error of compObjectResult.errors) errors.push(`switch ${i} - ${error}`)
    }
    return { normalized: { switch: normalizedSwitchCases }, errors: [] }
  } else {
    return getCompObject(layoutKeyword, schemaFragment, schemaPath, markdown, arrayChild)
  }
}

/**
 * @param {import('ajv').ErrorObject} error
 * @param {(error: import('ajv').ErrorObject) => boolean} fn
 * @returns {boolean}
 */
function matchValidationError (error, fn) {
  if (error.keyword === 'errorMessage') {
    error = error.params.errors[0]
  }
  return fn(error)
}

/**
 * @param {import('ajv').ErrorObject[]} errors
 * @returns {string[]}
 */
function lighterValidationErrors (errors) {
  const compositeErrors = errors.filter(e => matchValidationError(e, (e) => e.keyword === 'anyOf' || e.keyword === 'oneOf'))
  // in case of a anyOf/oneOf error there are some subschemas errors that mostly prevent readability
  for (const compositeError of compositeErrors) {
    const explicitError = errors.find(e => matchValidationError(e, (e) => e.instancePath === compositeError.instancePath && e.keyword !== 'type'))
    if (explicitError) {
      errors = errors.filter(e => matchValidationError(e, (e) => e.instancePath !== compositeError.instancePath || e.keyword !== 'type'))
    }
  }
  return errors.map(e => e.message ?? e.keyword)
}

/**
 * @param {SchemaFragment} schemaFragment
 * @param {string} schemaPath
 * @param {(text: string) => string} markdown
 * @param {'oneOf'} [arrayChild]
 * @returns {{layout: NormalizedLayout, errors: string[]}}
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
    return {
      layout: getNormalizedLayout({}, schemaFragment, schemaPath, markdown, arrayChild).normalized,
      errors: lighterValidationErrors(validateLayoutKeyword.errors)
    }
  }
  const normalizedLayout = getNormalizedLayout(layoutKeyword, schemaFragment, schemaPath, markdown, arrayChild)
  if (!validateNormalizedLayout(normalizedLayout.normalized)) {
    console.error(`normalized layout validation errors at path ${schemaPath}`, normalizedLayout, validateNormalizedLayout.errors)
    return {
      layout: getNormalizedLayout({}, schemaFragment, schemaPath, markdown, arrayChild).normalized,
      errors: lighterValidationErrors(validateNormalizedLayout.errors)
    }
    // throw new Error(`invalid layout at path ${schemaPath}`, { cause: validateNormalizedLayout.errors })
  }
  return { layout: normalizedLayout.normalized, errors: [] }
}
