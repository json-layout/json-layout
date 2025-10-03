import { isComponentName, isPartialCompObject, isPartialChildren, isPartialSwitch, isPartialGetItemsExpr, isPartialGetItemsObj, isPartialSlotMarkdown, isPartialGetItemsFetch, isPartialChildComposite, isPartialChildSlot, isPartialSlotText, isPartialSlotName } from './layout-keyword/index.js'
import { validateLayoutKeyword } from './layout-keyword/validation.js'
import { validateNormalizedLayout } from './normalized-layout/validation.js'
import { getComponentValidate } from './validate.js'
import clone from './utils/clone.js'

export * from './layout-keyword/validation.js'
export * from './normalized-layout/validation.js'

/**
 * @typedef {import("./types.js").NormalizeOptions} NormalizeOptions
 * @typedef {import("./types.js").NormalizeMessages} NormalizeMessages
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
      if (key === 'patternProperties') {
        children.push({ key: '$patternProperties' })
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
 * @param {PartialChildren | undefined} partialChildren
 * @param {(text: string) => string} markdown
 * @returns {Children}
 */
function getChildren (defaultChildren, partialChildren, markdown) {
  if (!partialChildren) return defaultChildren
  let compI = 0
  let slotI = 0
  return partialChildren.map(partialChild => {
    if (typeof partialChild === 'string') { // simple string/key referencing a known child
      const matchingDefaultChild = defaultChildren.find(c => c.key === partialChild)
      if (!matchingDefaultChild) throw new Error(`unknown child "${partialChild}"`)
      return matchingDefaultChild
    } else if (Array.isArray(partialChild)) {
      compI++
      return {
        comp: 'section',
        key: `$comp-${compI}`,
        children: getChildren(defaultChildren, partialChild, markdown)
      }
    } else {
      if ('slots' in partialChild && !isPartialChildSlot(partialChild)) {
        partialChild.slots = normalizePartialSlots(partialChild.slots, markdown)
      }
      if ('cols' in partialChild) partialChild.cols = normalizePartialCols(partialChild.cols)
      if (partialChild.if) partialChild.if = normalizeExpression(partialChild.if)
      if (typeof partialChild.cols === 'number') partialChild.cols = { sm: partialChild.cols }
      if (typeof partialChild.cols === 'object' && partialChild.cols.xs === undefined) partialChild.cols.xs = 12
      if (partialChild.key) { // object referencing known child and overwriting cols / if
        const matchingDefaultChild = defaultChildren.find(c => c.key === partialChild.key)
        if (!matchingDefaultChild) throw new Error(`unknown child "${partialChild.key}"`)
        return /** @type {Child} */ (partialChild)
      } else if (isPartialChildSlot(partialChild)) { // a slot defined as a child
        /** @type {Child} */
        slotI++
        return {
          key: `$slot-${slotI}`,
          comp: 'slot',
          cols: normalizePartialCols(partialChild.cols),
          slots: normalizePartialSlots({ component: partialChild }, markdown)
        }
      } else {
        const child = partialChild
        if (isPartialChildComposite(child)) {
          // a composite component definition, not directly related to a known child
          if (!child.comp) child.comp = 'section'
          child.children = getChildren(defaultChildren, child.children, markdown)
          if (!('key' in partialChild)) {
            compI++
            child.key = `$comp-${compI}`
          }
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
 * @param {import('./types.js').NormalizeOptions} options
 * @param {'oneOf' | 'patternProperties'} [schemaChild]
 * @returns {import('./index.js').ComponentName}
 */
function getDefaultComp (partial, schemaFragment, type, options, schemaChild) {
  if (partial.slots?.component) return 'slot'
  if (partial.slots?.compositeComponent) return 'composite-slot'

  const hasSimpleType = type && ['string', 'integer', 'number'].includes(type)
  if (schemaChild === 'oneOf') return 'one-of-select'
  if (schemaChild === 'patternProperties') return 'list'
  if (hasSimpleType && schemaFragment.enum) return schemaFragment.enum.length > 20 ? 'autocomplete' : 'select'
  if (hasSimpleType && schemaFragment.oneOf) return schemaFragment.oneOf.length > 20 ? 'autocomplete' : 'select'
  if (hasSimpleType && schemaFragment.examples && options.useExamples === 'items' && !(schemaFragment.format && ['date', 'date-time', 'time'].includes(schemaFragment.format))) return type === 'string' ? 'combobox' : 'number-combobox'
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
    if (hasSimpleTypeItems && schemaFragment.items.examples && options.useExamples === 'items') {
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
 * @param {PartialCompObject['slots']} partialSlots
 * @param {(text: string) => string} markdown
 * @returns {import('./normalized-layout/types.js').Slots | undefined}
 */
function normalizePartialSlots (partialSlots, markdown) {
  if (!partialSlots) return
  /** @type {import('./normalized-layout/types.js').Slots} */
  const slots = {}
  for (const [name, slot] of Object.entries(partialSlots)) {
    if (typeof slot === 'string') {
      if (['before', 'after'].includes(name)) {
        slots[name] = { markdown: markdown(slot).trim() }
      } else {
        slots[name] = { name: slot }
      }
    } else if (isPartialSlotText(slot)) {
      slots[name] = { text: slot.text }
    } else if (isPartialSlotName(slot)) {
      slots[name] = { name: slot.name, props: slot.props }
    } else if (isPartialSlotMarkdown(slot)) {
      slots[name] = { markdown: markdown(slot.markdown).trim() }
    }
  }
  return slots
}

/**
 * @param {PartialCompObject['cols']} partialCols
 * @returns {import('./normalized-layout/types.js').ColsObj | undefined}
 */
function normalizePartialCols (partialCols) {
  if (typeof partialCols === 'number') {
    return { xs: 12, sm: partialCols }
  }
  if (typeof partialCols === 'object') {
    return { xs: 12, ...partialCols }
  }
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
 * @returns {[SchemaFragment, string] | undefined}
 */
export const mergeNullableSubSchema = (schemaFragment) => {
  /** @type {null | 'oneOf' | 'anyOf'} */
  let subTypesKey = null
  if (schemaFragment.oneOf) subTypesKey = 'oneOf'
  else if (schemaFragment.anyOf) subTypesKey = 'anyOf'
  if (subTypesKey) {
    const subTypes = schemaFragment[subTypesKey]
    /* if (subTypes && subTypes.length === 1) {
      const subType = subTypes[0]
      for (const key of Object.keys(schemaFragment)) delete subType[key]
      Object.assign(schemaFragment, subType)
      delete schemaFragment[subTypesKey]
    } */
    if (subTypes && subTypes.length === 2 && subTypes.some(t => t.type === 'null')) {
      const subTypeIndex = subTypes.findIndex(t => t.type !== 'null')
      if (subTypeIndex !== -1) {
        const subType = subTypes[subTypeIndex]
        const nullableType = clone(schemaFragment)
        for (const key in subType) {
          if (!(key in nullableType)) nullableType[key] = subType[key]
        }
        delete nullableType[subTypesKey]
        nullableType.__pointer = nullableType.__pointer + `/${subTypesKey}/${subTypeIndex}`
        return nullableType
      }
    }
  }
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

  if (!schemaFragment.type && (schemaFragment.properties || schemaFragment.patternProperties)) {
    return { type: 'object', nullable: false }
  }

  // case where type is not defined but can be deduced from children oneOf/allOf/anyOf
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

  if (Array.isArray(schemaFragment.type)) {
    throw new Error('multiple types are not supported')
  }

  return { type: schemaFragment.type, nullable: false }
}

const defaultOptionsKeys = ['readOnly', 'summary', 'titleDepth', 'density', 'removeAdditional', 'validateOn', 'updateOne', 'debounceInputMs', 'initialValidation', 'defaultOn', 'readOnlyPropertiesMode']

/**
 * @param {string | number} key
 * @param {LayoutKeyword} layoutKeyword
 * @param {SchemaFragment} schemaFragment
 * @param {string | undefined} type
 * @param {boolean} nullable
 * @param {string} schemaPath
 * @param { import('./types.js').NormalizeOptions } options
 * @param {'oneOf' | 'patternProperties'} [schemaChild]
 * @returns {BaseCompObject}
 */
function getCompObject (key, layoutKeyword, schemaFragment, type, nullable, schemaPath, options, schemaChild) {
  if ('const' in schemaFragment) return { comp: 'none' }
  if (!type) return { comp: 'none' }

  const partial = getPartialCompObject(layoutKeyword)

  if (type === 'array' && !schemaFragment.items && partial.comp !== 'file-input') {
    return { comp: 'none' }
  }

  // chose the default component for a schema fragment
  if (!partial.comp) {
    partial.comp = getDefaultComp(partial, schemaFragment, type, options, schemaChild)
  }
  const component = options.components[partial.comp]
  if (!component) {
    throw new Error(`unknown component "${partial.comp}"`)
  }
  if (partial.comp === 'none') return { comp: 'none' }

  if (nullable) partial.nullable = nullable

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

  if (component.composite) {
    const children = getChildren(getDefaultChildren(schemaFragment, type), partial.children, options.markdown)
    partial.children = children
    if (!('title' in partial)) {
      if (children.length === 1 && children[0].key === '$patternProperties') {
        // if we only have patternProperties in this object, reserve the title for the sub-component
      } else {
        partial.title = schemaFragment.title ?? null
      }
    }
  } else if (partial.comp === 'list') {
    if (schemaChild === 'patternProperties') {
      if (!('title' in partial)) {
        const children = getChildren(getDefaultChildren(schemaFragment, type), partial.children, options.markdown)
        if (children.length === 1 && children[0].key === '$patternProperties') {
          partial.title = schemaFragment.title ?? null
        }
      }
      let hasObjectChild = false
      for (const patternSchema of Object.values(schemaFragment.patternProperties ?? {})) {
        const { type: patternType } = getSchemaFragmentType(patternSchema)
        if (patternType === 'object') hasObjectChild = true
      }
      partial.listEditMode = partial.listEditMode ?? (hasObjectChild ? 'inline-single' : 'inline')
      partial.listActions = partial.listActions ?? ['add', 'edit', 'delete']
      partial.indexed = Object.keys(schemaFragment.patternProperties ?? {})
    } else {
      if (!('title' in partial)) partial.title = schemaFragment.title ?? ('' + key)
      const { type: itemsType } = getSchemaFragmentType(schemaFragment.items)
      partial.listEditMode = partial.listEditMode ?? (itemsType === 'object' ? 'inline-single' : 'inline')
      if (!partial.listActions) {
        if (partial.getItems) {
          partial.listActions = ['edit']
          if (isPartialGetItemsObj(partial.getItems) && partial.getItems.itemTitle && !partial.itemTitle) {
            partial.itemTitle = partial.getItems.itemTitle
          }
        } else {
          if (partial.clipboardKey) {
            partial.listActions = ['add', 'edit', 'delete', 'sort', 'duplicate', 'copy', 'paste']
          } else {
            partial.listActions = ['add', 'edit', 'delete', 'sort', 'duplicate']
          }
        }
      }
    }
    if (partial.itemTitle) partial.itemTitle = normalizeExpression(partial.itemTitle, 'js-eval', 'item')
    if (partial.itemSubtitle) partial.itemSubtitle = normalizeExpression(partial.itemSubtitle, 'js-eval', 'item')
    if (partial.itemCopy) partial.itemCopy = normalizeExpression(partial.itemCopy ?? 'item', 'js-eval', 'item')
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
  if (partial.comp === 'number-field' && type === 'integer') {
    partial.precision = 0
  }

  if (partial.if) partial.if = normalizeExpression(partial.if)

  if (!partial.defaultData && schemaFragment.type === 'string' && schemaPath.split('#').pop() === '') {
    partial.defaultData = ''
  }

  // options can be set directly in layout and normalized in layout.options
  // TODO: fetch this list from the schema ?
  const optionsKeys = options.optionsKeys ? options.optionsKeys.concat(defaultOptionsKeys) : defaultOptionsKeys
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
    if (partial.getItems.itemHeader) partial.getItems.itemHeader = normalizeExpression(partial.getItems.itemHeader, 'js-eval', 'item')
    if (partial.getItems.itemTitle) partial.getItems.itemTitle = normalizeExpression(partial.getItems.itemTitle, 'js-eval', 'item')
    if (partial.getItems.itemKey) partial.getItems.itemKey = normalizeExpression(partial.getItems.itemKey, 'js-eval', 'item')
    if (partial.getItems.itemValue) partial.getItems.itemValue = normalizeExpression(partial.getItems.itemValue, 'js-eval', 'item')
    if (partial.getItems.itemIcon) partial.getItems.itemIcon = normalizeExpression(partial.getItems.itemIcon, 'js-eval', 'item')
    if (partial.getItems.itemsResults) partial.getItems.itemsResults = normalizeExpression(partial.getItems.itemsResults, 'js-eval', 'body')
  }
  if (partial.getItems && isPartialGetItemsFetch(partial.getItems)) {
    partial.getItems.url = normalizeExpression(partial.getItems.url, 'js-tpl')
    if (partial.getItems.searchParams) {
      for (const [key, expr] of Object.entries(partial.getItems.searchParams)) {
        partial.getItems.searchParams[key] = normalizeExpression(expr, 'js-eval')
      }
    }
    if (partial.getItems.headers) {
      for (const [key, expr] of Object.entries(partial.getItems.headers)) {
        partial.getItems.headers[key] = normalizeExpression(expr, 'js-eval')
      }
    }
  }

  if (partial.items) {
    partial.items = partial.items.map((/** @type {import('./index.js').PartialSelectItem} */ item) => {
      if (['string', 'integer', 'number'].includes(typeof item)) {
        return { title: item + '', key: item + '', value: item }
      } else if (typeof item === 'object') {
        if (item.header) {
          return item
        } else {
          return {
            key: (item.key ?? item.value) + '',
            title: (item.title ?? item.key ?? item.value) + '',
            value: item.value ?? item.key
          }
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

  if (partial.slots) partial.slots = normalizePartialSlots(partial.slots, options.markdown)

  /** @type {string[]} */
  const helpParts = []
  /** @type {string[]} */
  const hintParts = []
  /** @type {string[]} */
  const placeholderParts = []

  if (!component.composite && partial.comp !== 'list' && partial.comp !== 'slot' && !('label' in partial) && !schemaChild) {
    if ((options.useTitle === 'label' || options.useTitle === undefined) && schemaFragment.title) {
      partial.label = schemaFragment.title
    } else {
      partial.label = key + ''
    }
  }
  if (schemaFragment.title) {
    if (options.useTitle === 'hint') hintParts.push(schemaFragment.title)
    if (options.useTitle === 'placeholder') placeholderParts.push(schemaFragment.title)
    if (options.useTitle === 'help') helpParts.push(schemaFragment.title)
  }

  if (schemaFragment.deprecated && options.useDeprecated) {
    partial.warning = options.messages.deprecated
  }

  if (schemaFragment.description) {
    if (component.composite && !!partial.title && options.useDescription.includes('subtitle')) {
      if (partial.subtitle === undefined) {
        partial.subtitle = schemaFragment.description
      }
    } else if (options.useDescription.includes('hint')) {
      hintParts.push(schemaFragment.description)
    } else if (schemaChild !== 'oneOf' && options.useDescription.includes('help')) {
      helpParts.push(schemaFragment.description)
    }
  }

  if (options.useName === 'placeholder') placeholderParts.push(options.messages.name + key)
  if (options.useName === 'hint') hintParts.push(options.messages.name + key)
  if (options.useName === 'help') helpParts.push(options.messages.name + key)

  if ('default' in schemaFragment && typeof schemaFragment.default !== 'object') {
    if (options.useDefault === 'hint') {
      hintParts.push(options.messages.default + schemaFragment.default)
    }
    if (options.useDefault === 'placeholder') {
      placeholderParts.push(options.messages.default + schemaFragment.default)
    }
  }

  if (schemaFragment.examples && !schemaFragment.examples.some(e => typeof e === 'object') && options.useExamples === 'help') {
    helpParts.push(options.messages.examples + schemaFragment.examples.map(e => '\n - ' + e).join(''))
  }

  if (helpParts.length) {
    if (partial.help) helpParts.unshift(partial.help)
    partial.help = helpParts.join('\n\n')
  }
  if (hintParts.length && !component.composite) {
    if (partial.hint) hintParts.unshift(partial.hint)
    partial.hint = hintParts.join(' - ')
  }
  if (placeholderParts.length && component.schema?.properties?.placeholder) {
    if (typeof partial.placeholder === 'string') placeholderParts.unshift(partial.placeholder)
    partial.placeholder = placeholderParts.join(' - ')
  }

  if (partial.help) partial.help = options.markdown(partial.help).trim()
  if (partial.subtitle) partial.subtitle = options.markdown(partial.subtitle).trim()

  if ('cols' in partial) partial.cols = normalizePartialCols(partial.cols)

  const validateComponent = getComponentValidate(component)
  if (!validateComponent(partial)) {
    const error = new Error(`component "${component.name}" validation errors`)
    error.cause = lighterValidationErrors(validateComponent.errors)
    throw error
  }

  return /** @type {BaseCompObject} */(partial)
}

/**
 * @param {string | number} key
 * @param {LayoutKeyword} layoutKeyword
 * @param {SchemaFragment} schemaFragment
 * @param {string | undefined} type
 * @param {boolean} nullable
 * @param {string} schemaPath
 * @param { import('./types.js').NormalizeOptions } options
 * @param {'oneOf' | 'patternProperties'} [schemaChild]
 * @returns {NormalizedLayout}}
 */
function getNormalizedLayout (key, layoutKeyword, schemaFragment, type, nullable, schemaPath, options, schemaChild) {
  if (isPartialSwitch(layoutKeyword)) {
    /** @type {BaseCompObject[]} */
    const normalizedSwitchCases = []
    const switchCases = [...layoutKeyword.switch]
    if (!switchCases.find(s => !s.if)) {
      switchCases.push({})
    }
    /** @type {LayoutKeyword} */
    const extraProps = { ...layoutKeyword }
    delete extraProps.switch
    for (let i = 0; i < switchCases.length; i++) {
      const switchCase = switchCases[i]
      const compObjectResult = getCompObject(key, { ...extraProps, ...getPartialCompObject(switchCase) }, schemaFragment, type, nullable, schemaPath, options, schemaChild)
      normalizedSwitchCases.push(compObjectResult)
    }
    return { switch: normalizedSwitchCases }
  } else {
    return getCompObject(key, layoutKeyword, schemaFragment, type, nullable, schemaPath, options, schemaChild)
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
    let message = error.instancePath + ' ' + (error.message ?? error.keyword)
    if (error.params) message += ' ' + JSON.stringify(error.params)
    messages.push(message)
  }
  return messages
}

/**
 * @param {string | number} key
 * @param {SchemaFragment} schemaFragment
 * @param {string | undefined} type
 * @param {boolean} nullable
 * @param {string} schemaPath
 * @param { import('./types.js').NormalizeOptions } options
 * @param {'oneOf' | 'patternProperties'} [schemaChild]
 * @returns {NormalizedLayout}
 */
function normalizeValidLayoutFragment (key, schemaFragment, type, nullable, schemaPath, options, schemaChild) {
  let layoutKeyword
  if (schemaChild === 'oneOf') {
    layoutKeyword = schemaFragment.oneOfLayout ?? {}
  } else if (schemaChild === 'patternProperties') {
    layoutKeyword = schemaFragment.patternPropertiesLayout ?? {}
  } else {
    layoutKeyword = schemaFragment.layout ?? {}
  }
  if (!validateLayoutKeyword(layoutKeyword)) {
    const error = new Error('layout keyword validation errors at path')
    error.cause = lighterValidationErrors(validateLayoutKeyword.errors)
    throw error
  }
  const normalizedLayout = getNormalizedLayout(key, layoutKeyword, schemaFragment, type, nullable, schemaPath, options, schemaChild)

  if (!validateNormalizedLayout(normalizedLayout)) {
    const error = new Error('normalized layout validation errors at path')
    error.cause = lighterValidationErrors(validateNormalizedLayout.errors)
    throw error
  }
  return normalizedLayout
}

/**
 * @param {string | number} key
 * @param {SchemaFragment} schemaFragment
 * @param {string} schemaPath
 * @param { import('./types.js').NormalizeOptions } options
 * @param {'oneOf' | 'patternProperties'} [schemaChild]
 * @param {string | undefined} [knownType]
 * @param {boolean} [knownNullable]
 * @returns {{layout: NormalizedLayout, errors: string[]}}
 */
export function normalizeLayoutFragment (key, schemaFragment, schemaPath, options, schemaChild, knownType, knownNullable) {
  const { type, nullable } = knownType ? { type: knownType, nullable: knownNullable ?? false } : getSchemaFragmentType(schemaFragment)

  /** @type {string[]} */
  const errors = []
  try {
    const layout = normalizeValidLayoutFragment(key, schemaFragment, type, nullable, schemaPath, options, schemaChild)
    return { layout, errors }
  } catch (/** @type {any} */err) {
    try {
      errors.push(err.message)
      if (err.cause && Array.isArray(err.cause)) errors.push(...err.cause)
      errors.push('failed to normalize layout, use default component')
      const layout = normalizeValidLayoutFragment(key, { ...schemaFragment, layout: {} }, type, nullable, schemaPath, options, schemaChild)
      return { layout, errors }
    } catch (/** @type {any} */err) {
      errors.push(err.message)
      if (err.cause && Array.isArray(err.cause)) errors.push(...err.cause)
      errors.push('failed to produce default layout, hide this fragment')
      return { layout: { comp: 'none' }, errors }
    }
  }
}
