import { validateLayoutKeyword, isComponentName, isPartialCompObject, isPartialChildren, isPartialSwitch, isPartialGetItemsExpr, isPartialGetItemsObj, isPartialSlotMarkdown, isPartialGetItemsFetch, isPartialChildComposite } from './layout-keyword/index.js'
import { validateNormalizedLayout } from './normalized-layout/index.js'
import { getComponentValidate } from './validate.js'

/**
 * @typedef {import('./index.js').Child} Child
 * @typedef {import('./index.js').Children} Children
 * @typedef {import('./index.js').BaseCompObject} BaseCompObject
 * @typedef {import('./index.js').Expression} Expression
 * @typedef {import('./index.js').NormalizedLayout} NormalizedLayout
 * @typedef {import('./index.js').LayoutKeyword} LayoutKeyword
 * @typedef {import('./index.js').PartialChildren} PartialChildren
 * @typedef {import('./index.js').PartialCompObject} PartialCompObject
 * @typedef {import("./types.js").SchemaFragment} SchemaFragment
 */

/**
 * @param {import('./types.js').SchemaFragment} schemaFragment
 * @param {string} type
 * @returns {Children}
 */
function getDefaultChildren (schemaFragment, type) {
  /** @type {Children} */
  const children = []
  if (type === 'object') {
    for (const key of Object.keys(schemaFragment)) {
      if (key === 'properties') {
        for (const key of Object.keys(schemaFragment.properties ?? {})) {
          children.push({ key })
          if (schemaFragment.dependencies?.[key] && !Array.isArray(schemaFragment.dependencies[key])) {
            children.push({ key: `$deps-${key}` })
          }
          if (schemaFragment.dependentSchemas && schemaFragment.dependentSchemas[key]) {
            children.push({ key: `$deps-${key}` })
          }
        }
      }
      if (key === 'allOf') {
        if (schemaFragment.allOf?.length) {
          for (let i = 0; i < schemaFragment.allOf.length; i++) {
            children.push({ key: `$allOf-${i}` })
          }
        }
      }
      if (key === 'oneOf') {
        children.push({ key: '$oneOf' })
      }
      if (key === 'then' && schemaFragment.if) {
        children.push({ key: '$then' })
      }
      if (key === 'else' && schemaFragment.if) {
        children.push({ key: '$else' })
      }
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
      if (!matchingDefaultChild) throw new Error(`unknown child "${partialChild}"`)
      return matchingDefaultChild
    } else {
      if (typeof partialChild.cols === 'number') partialChild.cols = { sm: partialChild.cols }
      if (typeof partialChild.cols === 'object' && partialChild.cols.xs === undefined) partialChild.cols.xs = 12
      if (partialChild.key) { // object referencing known child and overwriting cols
        const matchingDefaultChild = defaultChildren.find(c => c.key === partialChild.key)
        if (!matchingDefaultChild) throw new Error(`unknown child "${partialChild.key}"`)
        return /** @type {Child} */ (partialChild)
      } else { // a composite component definition, not directly related to a known child
        const child = partialChild
        if (isPartialChildComposite(child)) {
          if (!child.comp) child.comp = 'section'
          child.children = getChildren(defaultChildren, child.children)
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
 * @param {string | undefined} type
 * @param {'oneOf'} [arrayChild]
 * @returns {import('./index.js').ComponentName}
 */
function getDefaultComp (partial, schemaFragment, type, arrayChild) {
  const hasSimpleType = type && ['string', 'integer', 'number'].includes(type)
  if (arrayChild === 'oneOf') return 'one-of-select'
  if (hasSimpleType && schemaFragment.enum) return schemaFragment.enum.length > 20 ? 'autocomplete' : 'select'
  if (hasSimpleType && schemaFragment.oneOf) return schemaFragment.oneOf.length > 20 ? 'autocomplete' : 'select'
  if (hasSimpleType && schemaFragment.examples) return type === 'string' ? 'combobox' : 'number-combobox'
  if (hasSimpleType && schemaFragment.anyOf && schemaFragment.anyOf.length && Object.keys(schemaFragment.anyOf[schemaFragment.anyOf.length - 1]).length === 0) {
    return type === 'string' ? 'combobox' : 'number-combobox'
  }
  if (type === 'string' && partial.separator) return 'combobox'
  if (partial.items) return partial.items.length > 20 ? 'autocomplete' : 'select'
  if (partial.getItems) {
    if (isPartialGetItemsFetch(partial.getItems)) {
      if (partial.getItems.qSearchParam) return 'autocomplete'
      if (typeof partial.getItems.url === 'string' && partial.getItems.url.includes('{q}')) return 'autocomplete'
      if (typeof partial.getItems.url === 'object' && typeof partial.getItems.url.expr === 'string' && partial.getItems.url.expr.includes('{q}')) return 'autocomplete'
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
 * @returns {boolean}
 */
function looksPure (expression) {
  const expr = typeof expression === 'string' ? expression : expression.expr
  return !expr.includes('rootData.') && !expr.includes('rootData[') && !expr.includes('parent.data') && !expr.includes('parent.parent')
}

/**
 * @param {import("./index.js").PartialExpression} expression
 * @param {Expression['type']} defaultType
 * @param {string} defaultDataAlias
 * @returns {Expression}
 */
function normalizeExpression (expression, defaultType = 'js-eval', defaultDataAlias = 'value') {
  const defaultPure = looksPure(expression)
  if (typeof expression === 'string') return { type: defaultType, expr: expression, pure: defaultPure, dataAlias: defaultDataAlias }
  else return { pure: defaultPure, type: defaultType, dataAlias: defaultDataAlias, ...expression }
}

/**
 * @param {SchemaFragment} schemaFragment
 * @returns {import('./index.js').PartialSelectItem[] | null}
 */
function getItemsFromSchema (schemaFragment) {
  if (!schemaFragment) return null
  const { type } = getSchemaFragmentType(schemaFragment)
  const hasSimpleType = type && ['string', 'integer', 'number'].includes(type)
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
 * @returns {{type: string | undefined, nullable: boolean}}
 */
export const getSchemaFragmentType = (schemaFragment) => {
  if (Array.isArray(schemaFragment.type) && schemaFragment.type.length === 2 && schemaFragment.type.includes('null')) {
    const type = schemaFragment.type.find(t => t !== 'null')
    return { type, nullable: true }
  }

  if (!schemaFragment.type && schemaFragment.properties) {
    return { type: 'object', nullable: false }
  }

  // case where type is not defined but can be deduced from children oneOf/allOf/anyOf
  /** @type {any[]} */
  if (!schemaFragment.type) {
    /** @type {string[]} */
    const combinationTypes = []
    for (const combinationKey of ['allOf', 'anyOf', 'oneOf']) {
      // @ts-ignore
      if (schemaFragment[combinationKey]) {
        // @ts-ignore
        for (const subSchema of schemaFragment[combinationKey]) {
          const { type: subType } = getSchemaFragmentType(subSchema)
          if (subType && !combinationTypes.includes(subType)) combinationTypes.push(subType)
        }
      }
    }
    if (combinationTypes.length === 1) return { type: combinationTypes[0], nullable: false }
  }

  return { type: schemaFragment.type, nullable: false }
}

/**
 * @param {LayoutKeyword} layoutKeyword
 * @param {SchemaFragment} schemaFragment
 * @param {string | undefined} type
 * @param {boolean} nullable
 * @param {string} schemaPath
 * @param {Record<string, import('./types.js').ComponentInfo>} components
 * @param {(text: string) => string} markdown
 * @param {string[]} optionsKeys
 * @param {'oneOf'} [arrayChild]
 * @returns {BaseCompObject}
 */
function getCompObject (layoutKeyword, schemaFragment, type, nullable, schemaPath, components, markdown, optionsKeys, arrayChild) {
  const key = schemaPath.slice(schemaPath.lastIndexOf('/') + 1)

  if ('const' in schemaFragment) return { comp: 'none' }
  if (!type) return { comp: 'none' }

  const partial = getPartialCompObject(layoutKeyword)

  if (type === 'array' && !schemaFragment.items && partial.comp !== 'file-input') {
    return { comp: 'none' }
  }

  // chose the default component for a schema fragment
  if (!partial.comp) {
    partial.comp = getDefaultComp(partial, schemaFragment, type, arrayChild)
  }
  const component = components[partial.comp]
  if (!component) {
    throw new Error(`unknown component "${partial.comp}"`)
  }
  if (partial.comp === 'none') return { comp: 'none' }

  if (nullable) partial.nullable = nullable

  if (component.composite) {
    if (!('title' in partial)) partial.title = schemaFragment.title ?? null
    partial.children = getChildren(getDefaultChildren(schemaFragment, type), partial.children)
  } else if (partial.comp === 'list') {
    if (!('title' in partial)) partial.title = schemaFragment.title ?? key
    partial.listEditMode = partial.listEditMode ?? (schemaFragment.items.type === 'object' ? 'inline-single' : 'inline')
    partial.listActions = partial.listActions ?? ['add', 'edit', 'delete', 'duplicate', 'sort']
  } else {
    if (!('label' in partial) && partial.comp !== 'one-of-select') {
      partial.label = schemaFragment.title ?? key
    }
  }

  if (component.itemsBased && !partial.items) {
    let items
    if (type === 'array') {
      items = getItemsFromSchema(schemaFragment.items)
    } else {
      items = getItemsFromSchema(schemaFragment)
    }
    if (items) {
      if (partial.getItems && isPartialGetItemsObj(partial.getItems)) {
        partial.getItems.expr = JSON.stringify(items)
        partial.getItems.immutable = true
      } else {
        partial.getItems = { expr: JSON.stringify(items), immutable: true }
      }
    }
  }

  if (component.multipleCompat) {
    if (type === 'array' || partial.separator) {
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

  // options can be set directly in layout and normalized in layout.options
  // TODO: fetch this list from the schema ?
  for (const optionKey of optionsKeys) {
    if (optionKey in partial) {
      partial.options = partial.options ?? {}
      partial.options[optionKey] = partial[optionKey]
      delete partial[optionKey]
    }
  }
  if (schemaFragment.readOnly) {
    partial.options = partial.options ?? {}
    if (!('readOnly' in partial.options)) partial.options.readOnly = true
  }

  if (partial.getOptions !== undefined) partial.getOptions = normalizeExpression(partial.getOptions)
  if (partial.getDefaultData !== undefined) partial.getDefaultData = normalizeExpression(partial.getDefaultData)
  if (partial.getConstData !== undefined) partial.getConstData = normalizeExpression(partial.getConstData)
  if (partial.transformData !== undefined) partial.transformData = normalizeExpression(partial.transformData)
  if (partial.getProps !== undefined) partial.getProps = normalizeExpression(partial.getProps)

  if (partial.getItems && isPartialGetItemsExpr(partial.getItems)) partial.getItems = normalizeExpression(partial.getItems)
  if (partial.getItems && isPartialGetItemsObj(partial.getItems)) {
    if (type === 'object') partial.getItems.returnObjects = true
    if (type === 'array') {
      const { type: itemsType } = getSchemaFragmentType(schemaFragment.items)
      if (itemsType === 'object') partial.getItems.returnObjects = true
    }
    if (partial.getItems.itemTitle) partial.getItems.itemTitle = normalizeExpression(partial.getItems.itemTitle, 'js-eval', 'item')
    if (partial.getItems.itemKey) partial.getItems.itemKey = normalizeExpression(partial.getItems.itemKey, 'js-eval', 'item')
    if (partial.getItems.itemValue) partial.getItems.itemValue = normalizeExpression(partial.getItems.itemValue, 'js-eval', 'item')
    if (partial.getItems.itemIcon) partial.getItems.itemIcon = normalizeExpression(partial.getItems.itemIcon, 'js-eval', 'item')
    if (partial.getItems.itemsResults) partial.getItems.itemsResults = normalizeExpression(partial.getItems.itemsResults, 'js-eval', 'body')
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

  if (schemaFragment.description) {
    if (component.composite && !!partial.title) {
      if (partial.subtitle === undefined) {
        partial.subtitle = schemaFragment.description
      }
    } else if (partial.help === undefined && arrayChild !== 'oneOf') {
      partial.help = schemaFragment.description
    }
  }
  if (partial.help) partial.help = markdown(partial.help).trim()
  if (partial.subtitle) partial.subtitle = markdown(partial.subtitle).trim()

  if (typeof partial.cols === 'number') partial.cols = { xs: partial.cols }
  if (typeof partial.cols === 'object' && partial.cols.xs === undefined) partial.cols.xs = 12

  const validateComponent = getComponentValidate(component)
  if (!validateComponent(partial)) {
    const error = new Error(`component "${component.name}" validation errors`)
    error.cause = lighterValidationErrors(validateComponent.errors)
    throw error
  }

  return /** @type {BaseCompObject} */(partial)
}

/**
 * @param {LayoutKeyword} layoutKeyword
 * @param {SchemaFragment} schemaFragment
 * @param {string | undefined} type
 * @param {boolean} nullable
 * @param {string} schemaPath
 * @param {Record<string, import('./types.js').ComponentInfo>} components
 * @param {(text: string) => string} markdown
 * @param {string[]} optionsKeys
 * @param {'oneOf'} [arrayChild]
 * @returns {NormalizedLayout}}
 */
function getNormalizedLayout (layoutKeyword, schemaFragment, type, nullable, schemaPath, components, markdown, optionsKeys, arrayChild) {
  if (isPartialSwitch(layoutKeyword)) {
    /** @type {BaseCompObject[]} */
    const normalizedSwitchCases = []
    const switchCases = [...layoutKeyword.switch]
    if (!switchCases.find(s => !s.if)) {
      switchCases.push({})
    }
    for (let i = 0; i < switchCases.length; i++) {
      const switchCase = switchCases[i]
      const compObjectResult = getCompObject(switchCase, schemaFragment, type, nullable, schemaPath, components, markdown, optionsKeys, arrayChild)
      normalizedSwitchCases.push(compObjectResult)
    }
    return { switch: normalizedSwitchCases }
  } else {
    return getCompObject(layoutKeyword, schemaFragment, type, nullable, schemaPath, components, markdown, optionsKeys, arrayChild)
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
 * @param {import('ajv').ErrorObject[] | null | undefined} errors
 * @returns {string[]}
 */
function lighterValidationErrors (errors) {
  if (!errors) return []
  const compositeErrors = errors.filter(e => matchValidationError(e, (e) => e.keyword === 'anyOf' || e.keyword === 'oneOf'))
  // in case of a anyOf/oneOf error there are some subschemas errors that mostly prevent readability
  for (const compositeError of compositeErrors) {
    const explicitError = errors.find(e => matchValidationError(e, (e) => e.instancePath === compositeError.instancePath && e.keyword !== 'type'))
    if (explicitError) {
      errors = errors.filter(e => matchValidationError(e, (e) => e.instancePath !== compositeError.instancePath || e.keyword !== 'type'))
    }
  }
  const messages = []
  for (const error of errors) {
    let message = error.message ?? error.keyword
    if (error.params) message += ' ' + JSON.stringify(error.params)
    messages.push(message)
  }
  return messages
}

const defaultOptionsKeys = ['readOnly', 'summary', 'titleDepth', 'density', 'removeAdditional', 'validateOn', 'updateOne', 'debounceInputMs', 'initialValidation', 'defaultOn', 'readOnlyPropertiesMode']

/**
 * @param {SchemaFragment} schemaFragment
 * @param {string | undefined} type
 * @param {boolean} nullable
 * @param {string} schemaPath
 * @param {Record<string, import('./types.js').ComponentInfo>} components
 * @param {(text: string) => string} markdown
 * @param {string[]} [optionsKeys]
 * @param {'oneOf'} [arrayChild]
 * @returns {NormalizedLayout}
 */
function normalizeValidLayoutFragment (schemaFragment, type, nullable, schemaPath, components, markdown, optionsKeys, arrayChild) {
  optionsKeys = optionsKeys ? optionsKeys.concat(defaultOptionsKeys) : defaultOptionsKeys
  let layoutKeyword
  if (arrayChild === 'oneOf') {
    layoutKeyword = schemaFragment.oneOfLayout ?? {}
  } else {
    layoutKeyword = schemaFragment.layout ?? {}
  }
  if (!validateLayoutKeyword(layoutKeyword)) {
    const error = new Error('layout keyword validation errors at path')
    error.cause = lighterValidationErrors(validateLayoutKeyword.errors)
    throw error
  }
  const normalizedLayout = getNormalizedLayout(layoutKeyword, schemaFragment, type, nullable, schemaPath, components, markdown, optionsKeys, arrayChild)

  if (!validateNormalizedLayout(normalizedLayout)) {
    const error = new Error('normalized layout validation errors at path')
    error.cause = lighterValidationErrors(validateNormalizedLayout.errors)
    throw error
  }
  return normalizedLayout
}

/**
 * @param {SchemaFragment} schemaFragment
 * @param {string} schemaPath
 * @param {Record<string, import('./types.js').ComponentInfo>} components
 * @param {(text: string) => string} markdown
 * @param {string[]} [optionsKeys]
 * @param {'oneOf'} [arrayChild]
 * @param {string | undefined} [knownType]
 * @param {boolean} [knownNullable]
 * @returns {{layout: NormalizedLayout, errors: string[]}}
 */
export function normalizeLayoutFragment (schemaFragment, schemaPath, components, markdown = (src) => src, optionsKeys, arrayChild, knownType, knownNullable) {
  const { type, nullable } = knownType ? { type: knownType, nullable: knownNullable ?? false } : getSchemaFragmentType(schemaFragment)
  /** @type {string[]} */
  const errors = []
  try {
    const layout = normalizeValidLayoutFragment(schemaFragment, type, nullable, schemaPath, components, markdown, optionsKeys, arrayChild)
    return { layout, errors }
  } catch (/** @type {any} */err) {
    try {
      errors.push(err.message)
      if (err.cause && Array.isArray(err.cause)) errors.push(...err.cause)
      errors.push('failed to normalize layout, use default component')
      const layout = normalizeValidLayoutFragment({ ...schemaFragment, layout: {} }, type, nullable, schemaPath, components, markdown, optionsKeys, arrayChild)
      return { layout, errors }
    } catch (/** @type {any} */err) {
      errors.push(err.message)
      if (err.cause && Array.isArray(err.cause)) errors.push(...err.cause)
      errors.push('failed to produce default layout, hide this fragment')
      return { layout: { comp: 'none' }, errors }
    }
  }
}
