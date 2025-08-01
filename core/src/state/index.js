import debug from 'debug'
import { produce } from 'immer'
import { evalExpression, produceListData, producePatchedData, useDefaultData } from './state-node.js'
import { createStateTree } from './state-tree.js'
import { Display } from './utils/display.js'
import { isGetItemsExpression, isGetItemsFetch, isItemsLayout } from '@json-layout/vocabulary'
import { shallowProduceArray } from './utils/immutable.js'
import { fillOptions } from './options.js'

export { Display } from './utils/display.js'
export { getRegexp } from './utils/regexps.js'

/**
 * @typedef {import('./types.js').StateNode} StateNode
 * @typedef {import('./types.js').StateTree} StateTree
 * @typedef {import('./types.js').StatefulLayoutOptions} StatefulLayoutOptions
 * @typedef {import('./types.js').CreateStateTreeContext} CreateStateTreeContext
 * @typedef {import('./types.js').TextFieldNode} TextFieldNode
 * @typedef {import('./types.js').TextareaNode} TextareaNode
 * @typedef {import('./types.js').NumberFieldNode} NumberFieldNode
 * @typedef {import('./types.js').SliderNode} SliderNode
 * @typedef {import('./types.js').SectionNode} SectionNode
 * @typedef {import('./types.js').SelectNode} SelectNode
 * @typedef {import('./types.js').AutocompleteNode} AutocompleteNode
 * @typedef {import('./types.js').RadioGroupNode} RadioGroupNode
 * @typedef {import('./types.js').CheckboxGroupNode} CheckboxGroupNode
 * @typedef {import('./types.js').SwitchGroupNode} SwitchGroupNode
 * @typedef {import('./types.js').ComboboxNode} ComboboxNode
 * @typedef {import('./types.js').CheckboxNode} CheckboxNode
 * @typedef {import('./types.js').SwitchNode} SwitchNode
 * @typedef {import('./types.js').ColorPickerNode} ColorPickerNode
 * @typedef {import('./types.js').DatePickerNode} DatePickerNode
 * @typedef {import('./types.js').DateTimePickerNode} DateTimePickerNode
 * @typedef {import('./types.js').TimePickerNode} TimePickerNode
 * @typedef {import('./types.js').ExpansionPanelsNode} ExpansionPanelsNode
 * @typedef {import('./types.js').TabsNode} TabsNode
 * @typedef {import('./types.js').VerticalTabsNode} VerticalTabsNode
 * @typedef {import('./types.js').StepperNode} StepperNode
 * @typedef {import('./types.js').OneOfSelectNode} OneOfSelectNode
 * @typedef {import('./types.js').ListNode} ListNode
 * @typedef {import('./types.js').FileInputNode} FileInputNode
 * @typedef {import('./types.js').CardNode} CardNode
 * @typedef {import('./types.js').FileRef} FileRef
 */

/** @type {(node: StateNode | undefined) => node is SectionNode} */
export const isSection = (node) => !!node && node.layout.comp === 'section'

/** @type {(node: StateNode | undefined, components: Record<string, import('@json-layout/vocabulary').ComponentInfo>) => node is SelectNode | ComboboxNode | AutocompleteNode} */
export const isItemsNode = (node, components) => !!node && isItemsLayout(node.layout, components)

const logDataBinding = debug('jl:data-binding')
const logSelectItems = debug('jl:select-items')
const logGetItems = debug('jl:get-items')
const logActivatedItems = debug('jl:activated-items')

export class StatefulLayout {
  /**
   * @private
   * @readonly
   * @type {import('../index.js').CompiledLayout}
   */
  _compiledLayout
  get compiledLayout () { return this._compiledLayout }

  /**
   * @private
   * @type {StateTree}
   */
  // @ts-ignore
  _stateTree
  get stateTree () { return this._stateTree }

  /**
   * @readonly
   * @type {import('../index.js').SkeletonTree}
   */
  skeletonTree

  /**
   * @private
   * @type {Display}
   */
  // @ts-ignore
  _display
  get display () { return this._display }

  /**
   * @private
   * @type {import('./types.js').ValidationState}
   */
  // @ts-ignore
  _validationState
  /**
   * @returns {import('./types.js').ValidationState}
   */
  get validationState () {
    return this._validationState
  }

  /**
   * @private
   * @param {Partial<import('./types.js').ValidationState>} validationState
   */
  set validationState (validationState) {
    logDataBinding('set validationState', validationState)
    this._validationState = {
      initialized: validationState.initialized ?? this._validationState.initialized ?? false,
      validatedForm: validationState.validatedForm ?? this._validationState.validatedForm ?? false,
      validatedChildren: validationState.validatedChildren ?? this._validationState.validatedChildren ?? []
    }
  }

  /**
   * @private
   * @type {StatefulLayoutOptions}
   */
  // @ts-ignore
  _options
  /**
   * @returns {StatefulLayoutOptions}
   */
  get options () { return this._options }
  /**
   * @param {Partial<StatefulLayoutOptions>} options
   */
  set options (options) {
    logDataBinding('apply main options setter', options)
    this.prepareOptions(options)
    this.updateState()
  }

  /**
   * @private
   * @type {unknown}
   */
  _data
  get data () { return this._data }
  set data (data) {
    logDataBinding('apply main data setter', data)
    this._data = data
    this.updateState()
  }

  /**
   * @private
   * @type {unknown}
   */
  _previousData

  /**
   * @private
   * @type {boolean}
   */
  _dataWaitingForBlur = false

  /**
   * @private
   * @type {string | null}
   */
  _currentInput = null

  /**
   * @private
   * @type {CreateStateTreeContext}
   */
  // @ts-ignore
  _lastCreateStateTreeContext

  /**
   * @private
   * @type {string | null}
   */
  _autofocusTarget
  /**
   * @private
   * @type {string | null}
   */
  _previousAutofocusTarget

  /**
   * @type {FileRef[]}
   */
  files = []

  /**
   * @param {import("../index.js").CompiledLayout} compiledLayout
   * @param {import("../index.js").SkeletonTree} skeletonTree
   * @param {Partial<StatefulLayoutOptions>} options
   * @param {unknown} [data]
   */
  constructor (compiledLayout, skeletonTree, options, data) {
    logDataBinding('create stateful layout', compiledLayout, skeletonTree, options, data)
    this._compiledLayout = compiledLayout
    this.skeletonTree = skeletonTree
    this.prepareOptions(options)
    this._autofocusTarget = this.options.autofocus ? '' : null
    this._previousAutofocusTarget = null
    this._data = data
    this._previousData = data
    this.initValidationState()
    this.activatedItems = {}
    this.updateState()
    this.handleAutofocus()
  }

  /**
   * @private
   * @param {Partial<StatefulLayoutOptions>} options
   */
  prepareOptions (options) {
    this._options = fillOptions(options, this.compiledLayout)
    this._display = this._display && this._display.width === this._options.width ? this._display : new Display(this._options.width)
  }

  /**
   * @private
   */
  initValidationState () {
    const initialValidation = this.options.initialValidation === 'always'
    this._validationState = {
      initialized: initialValidation,
      validatedForm: initialValidation,
      validatedChildren: []
    }
  }

  /**
   * @private
   */
  updateState () {
    this.createStateTree()
    let nbIter = 0
    while (
      this._data !== (this._stateTree.root.data ?? null) ||
      this._autofocusTarget !== this._lastCreateStateTreeContext.autofocusTarget ||
      (nbIter === 0 && this._lastCreateStateTreeContext.errors?.length)
    ) {
      nbIter += 1
      if (nbIter > 100) {
        console.error('too many iterations in updateState, the data is probably not stable', this._data, this._stateTree.root.data)
        throw new Error('too many iterations in updateState, the data is probably not stable')
      }
      logDataBinding('hydrating state tree changed the data, do it again', this._data, this._stateTree.root.data)
      // this is necessary because a first hydration can add default values and change validity, etc
      this._data = this._stateTree.root.data ?? null
      this._autofocusTarget = this._lastCreateStateTreeContext.autofocusTarget
      this.createStateTree(true)
    }

    if (!this._stateTree.valid && !this._stateTree.root.error && !this._stateTree.root.childError) {
      console.error('JSON layout failed to assign validation error to a node', this._lastCreateStateTreeContext.errors)
    }

    logDataBinding('emit update event', this._data, this._stateTree)
    this.options.onUpdate(this)
    this.emitData()
  }

  /**
   * @private
   */
  emitData () {
    // emit data event only if the data has changed, as it is immutable this simple comparison should suffice
    if (!this._dataWaitingForBlur && this._data !== this._previousData) {
      logDataBinding('emit data event', this._data)
      this.options.onData(this._data)
      this._previousData = this._data
    }
  }

  /**
   * @private
   * @param {boolean} rehydrate
   */
  createStateTree (rehydrate = false) {
    /** @type {CreateStateTreeContext} */
    const createStateTreeContext = {
      activatedItems: this.activatedItems,
      autoActivatedItems: {},
      autofocusTarget: this._autofocusTarget,
      currentInput: this._currentInput,
      initial: !this._lastCreateStateTreeContext,
      rehydrate,
      cacheKeys: this._lastCreateStateTreeContext?.cacheKeys ?? {},
      rootData: this._data,
      files: [],
      nodes: [],
      getItemsDataRequests: [],
      rehydrateErrors: rehydrate ? this._lastCreateStateTreeContext?.errors : undefined
    }

    // @ts-ignore
    if (this._options._debugCache) createStateTreeContext._debugCache = this._lastCreateStateTreeContext?._debugCache ?? {}

    this._stateTree = createStateTree(
      createStateTreeContext,
      this._options,
      this._compiledLayout,
      this.skeletonTree,
      this._display,
      this._data,
      this._validationState,
      this._stateTree
    )
    this._lastCreateStateTreeContext = createStateTreeContext
    if (!this.validationState.initialized) {
      this.validationState = {
        initialized: true,
        validatedChildren: createStateTreeContext.nodes.filter(n => n.validated).map(n => n.fullKey)
      }
    }
    this.files = shallowProduceArray(this.files, createStateTreeContext.files)
    for (const activatedKey in createStateTreeContext.autoActivatedItems) {
      logActivatedItems('auto-activated item', activatedKey, createStateTreeContext.autoActivatedItems[activatedKey])
      this.activatedItems = produce(this.activatedItems, draft => { draft[activatedKey] = createStateTreeContext.autoActivatedItems[activatedKey] })
    }
    for (const node of createStateTreeContext.getItemsDataRequests) {
      logGetItems(node.fullKey, 'automatic get items triggered')
      this.getItems(node).then(items => {
        logGetItems(node.fullKey, 'automatic get items, fetched results', items)
        const rawData = /** @type {any[]} */(node.data ?? [])
        const existingItems = rawData.map(item => this.prepareSelectItem(node, item))
        const data = produceListData(rawData, existingItems, items)
        logGetItems(node.fullKey, 'automatic get items, input produced data', data)
        this.input(node, data)
      }, err => console.error('error fetching items', node.fullKey, err))
    }
  }

  validate () {
    if (this.validationState.validatedForm) return
    this.validationState = { validatedForm: true }
    this.updateState()
  }

  resetValidation () {
    logDataBinding('resetValidation')
    this.initValidationState()
    this.updateState()
  }

  /**
   * @returns {boolean}
   */
  get valid () {
    return this.stateTree.valid
  }

  /**
   * @returns {string[]}
   */
  get errors () {
    return this._lastCreateStateTreeContext.nodes.filter(n => !!n.error).map(n => /** @type {string} */(n.error))
  }

  /**
   * @returns {boolean}
   */
  get hasHiddenError () {
    return this._lastCreateStateTreeContext.nodes.findIndex(node => node.error && !node.validated) !== -1
  }

  /**
   * @private
   * @param {StateNode} node
   * @returns {import('../compile/types.js').ParentContextExpression | null}
   */
  getParentContextExpression (node) {
    const parentNode = this._lastCreateStateTreeContext.nodes.find(n => n.fullKey === node.parentFullKey)
    if (!parentNode) return null
    return {
      parent: this.getParentContextExpression(parentNode),
      data: parentNode.data
    }
  }

  /**
   * @param {StateNode} node
   * @param {import('@json-layout/vocabulary').Expression} expression
   * @param {any} data
   * @returns {any}
   */
  evalNodeExpression (node, expression, data) {
    return evalExpression(this.compiledLayout.expressions, expression, data, node.options, new Display(node.width), node.layout, this.compiledLayout.validates, this._data, this.getParentContextExpression(node))
  }

  /**
   * @private
   * @param {StateNode} node
   * @param {unknown} data
   * @param {boolean} [validated]
   * @param {number} [activateKey]
   */
  applyInput (node, data, validated, activateKey) {
    logDataBinding('apply input event from node', node, data)

    const transformedData = node.layout.transformData && this.evalNodeExpression(node, node.layout.transformData, data)

    if (this.compiledLayout.components[node.layout.comp]?.isFileInput) {
      if (transformedData) {
        // @ts-ignore
        data.toJSON = () => transformedData
      } else if (data instanceof File) {
        const fileJSON = { name: data.name, size: data.size, type: data.type }
        // @ts-ignore
        data.toJSON = () => fileJSON
      } else if (Array.isArray(data)) {
        for (const file of data) {
          const fileJSON = { name: file.name, size: file.size, type: file.type }
          // @ts-ignore
          file.toJSON = () => fileJSON
        }
      }
    } else if (transformedData) {
      data = transformedData
    }

    if (validated && !this.validationState.validatedChildren.includes(node.fullKey)) {
      this.validationState = { validatedChildren: this.validationState.validatedChildren.concat([node.fullKey]) }
    }

    if (activateKey !== undefined) {
      logActivatedItems(node.fullKey, 'activated item on input', activateKey)
      this.activatedItems = produce(this.activatedItems, draft => { draft[node.fullKey] = activateKey })
      this._autofocusTarget = node.fullKey + '/' + activateKey
    }
    if (node.parentFullKey === null) {
      logDataBinding('update root state after input')
      this._data = data
      this.updateState()
      return
    }
    const parentNode = this._lastCreateStateTreeContext.nodes.find(p => p.fullKey === node.parentFullKey)
    if (!parentNode) throw new Error(`parent with key "${node.parentFullKey}" not found`)
    const newParentValue = producePatchedData(
      parentNode.data ?? (typeof node.key === 'number' ? [] : {}),
      node,
      (data === null || data === undefined) ? (node.skeleton.nullable ? null : undefined) : data
    )
    this.applyInput(parentNode, newParentValue, validated)

    if (activateKey !== undefined) {
      this.handleAutofocus()
    }
  }

  /**
   * @private
   * @type {null | [StateNode, unknown, boolean, number | undefined, ReturnType<typeof setTimeout>]}
   */
  debouncedInput = null

  applyDebouncedInput () {
    if (this.debouncedInput) {
      clearTimeout(this.debouncedInput[4])
      this.applyInput(this.debouncedInput[0], this.debouncedInput[1], this.debouncedInput[2], this.debouncedInput[3])
      this.debouncedInput = null
    }
  }

  /**
   * @param {StateNode} node
   * @param {unknown} data
   * @param {number} [activateKey]
   */
  input (node, data, activateKey) {
    logDataBinding('received input event from node', node, data, activateKey)

    if (node.layout.comp === 'list') {
      // a input of the whole list signals potential reordering, deactivate all items otherwise the keys might be mixed up
      this.deactivateItem(node, true)
    }

    // debounced data from the same node is cancelled if a new input is received
    // debounced data from another node is applied immediately
    if (this.debouncedInput) {
      if (this.debouncedInput[0] === node) clearTimeout(this.debouncedInput[4])
      else this.applyDebouncedInput()
    }

    const emitsBlur = this.compiledLayout.components[node.layout.comp]?.emitsBlur

    if (emitsBlur) {
      this._currentInput = node.fullKey
    }
    if (node.options.updateOn === 'blur' && emitsBlur) {
      this._dataWaitingForBlur = true
    }

    const validated = node.options.validateOn === 'input' || (node.options.validateOn === 'blur' && !emitsBlur)

    const shouldDebounce = this.compiledLayout.components[node.layout.comp]?.shouldDebounce
    if (shouldDebounce && node.options.debounceInputMs) {
      this.debouncedInput = [node, data, validated, activateKey, setTimeout(() => this.applyDebouncedInput(), node.options.debounceInputMs)]
    } else {
      this.applyInput(node, data, validated, activateKey)
    }
  }

  /**
   * @param {StateNode} node
   */
  blur (node) {
    if (this._currentInput === node.fullKey) this._currentInput = null

    // debounced data is applied immediately on blur
    if (this.debouncedInput) {
      this.applyDebouncedInput()
    } else {
      // re-apply once now that _currentInput was emptied to add default data
      if (node.layout.getDefaultData && useDefaultData(node.data, node.layout, node.options)) {
        this.applyInput(node, node.data, true)
      }
    }

    logDataBinding('received blur event from node', node)
    if (
      (node.options.validateOn === 'input' || node.options.validateOn === 'blur') &&
      !this.validationState.validatedChildren.includes(node.fullKey)
    ) {
      this.validationState = { validatedChildren: this.validationState.validatedChildren.concat([node.fullKey]) }
      this.updateState()
    }

    // in case of updateOn=blur option
    if (this._dataWaitingForBlur) {
      this._dataWaitingForBlur = false
      this.emitData()
    }
  }

  /**
   * @param {StateNode} node
   */
  validateNodeRecurse (node) {
    this.validationState = { validatedChildren: this.validationState.validatedChildren.concat([node.fullKey]) }
    if (node.children) {
      for (const child of node.children) {
        this.validateNodeRecurse(child)
      }
    }
    this.updateState()
  }

  /**
   * @private
   * @type {Record<string, {key: any, appliedQ: boolean, items: import('@json-layout/vocabulary').SelectItems}>}
   */
  _itemsCache = {}

  /**
   * @private
   * @param {StateNode} node
   * @param {string} q
   * @returns {Promise<{appliedQ: boolean, items: import('@json-layout/vocabulary').SelectItems}>}
   */
  async getItemsWithoutCache (node, q = '') {
    if (!isItemsNode(node, this._compiledLayout.components)) {
      throw new Error('node is not a component with an items list')
    }

    if (node.itemsCacheKey === null) return { appliedQ: false, items: [] }

    let appliedQ = false
    let rawItems
    if (node.layout.items || (node.layout.getItems && isGetItemsExpression(node.layout.getItems))) {
      rawItems = node.itemsCacheKey
      logGetItems(node.fullKey, 'raw items from context or schema or getItems expression', rawItems)
    }
    if (node.layout.getItems && isGetItemsFetch(node.layout.getItems)) {
      logGetItems(node.fullKey, 'will fetch raw items from URL', node.itemsCacheKey)
      const url = new URL(node.itemsCacheKey)
      /** @type {Record<string, string> | null} */
      let headers = null
      for (const [key, val] of [...url.searchParams.entries()]) {
        if (key.startsWith('__jl__header__')) {
          headers = headers ?? {}
          headers[key.replace('__jl__header__', '')] = val
          url.searchParams.delete(key)
        }
      }
      let qSearchParam = node.layout.getItems.qSearchParam
      if (!qSearchParam) {
        for (const searchParam of url.searchParams.entries()) {
          if (searchParam[1] === '{q}') qSearchParam = searchParam[0]
        }
      }
      if (qSearchParam) {
        logGetItems(node.fullKey, 'apply search params', qSearchParam)
        appliedQ = true
        if (q) url.searchParams.set(qSearchParam, q)
        else url.searchParams.delete(qSearchParam)
      }
      let fetchOptions = typeof node.options.fetchOptions === 'function' ? node.options.fetchOptions(url) : node.options.fetchOptions
      if (headers) fetchOptions = { ...fetchOptions, headers }
      rawItems = await node.options.fetch(url.href, fetchOptions)
      logGetItems(node.fullKey, 'raw items fetched from URL', rawItems)
    }

    if (!rawItems) {
      throw new Error(`node ${node.fullKey} is missing items or getItems parameters`)
    }
    if (node.layout.getItems?.itemsResults) {
      rawItems = this.evalNodeExpression(node, node.layout.getItems.itemsResults, rawItems)
      logGetItems(node.fullKey, 'items passed through the getItems.itemsResults expression', rawItems)
    }

    if (!Array.isArray(rawItems)) throw new Error(`getItems didn't return an array for node ${node.fullKey}, you can define itemsResults to extract the array`)

    /** @type {import('@json-layout/vocabulary').SelectItems} */
    const items = rawItems.map((/** @type {any} */ rawItem) => {
      return this.prepareSelectItem(node, rawItem)
    })

    return { appliedQ, items }
  }

  /**
   * @param {StateNode} node
   * @param {string} q
   * @returns {Promise<import('@json-layout/vocabulary').SelectItems>}
   */
  async getItems (node, q = '') {
    /** @type {{appliedQ: boolean, items: import('@json-layout/vocabulary').SelectItems}} */
    let itemsResult
    if (
      this._itemsCache[node.fullKey] &&
      this._itemsCache[node.fullKey].key === node.itemsCacheKey &&
      (!q || !this._itemsCache[node.fullKey].appliedQ)
    ) {
      itemsResult = this._itemsCache[node.fullKey]
    } else {
      itemsResult = await this.getItemsWithoutCache(node, q)
      if (!q || !itemsResult.appliedQ) {
        this._itemsCache[node.fullKey] = { key: node.itemsCacheKey, ...itemsResult }
      }
    }

    if (q && !itemsResult.appliedQ) return itemsResult.items.filter(item => item.title.toLowerCase().includes(q.toLowerCase()))
    return itemsResult.items
  }

  /**
   * @param {StateNode} node
   * @param {any} rawItem
   * @returns {import('@json-layout/vocabulary').SelectItem}
   */
  prepareSelectItem (node, rawItem) {
    /** @type {Partial<import('@json-layout/vocabulary').SelectItem>} */
    const item = {}
    /** @type {import('@json-layout/vocabulary').ItemsBasedCompObject} */
    const layout = node.layout
    if (typeof rawItem === 'object') {
      item.value = layout.getItems?.itemValue ? this.evalNodeExpression(node, layout.getItems.itemValue, rawItem) : (layout.getItems?.returnObjects ? rawItem : rawItem.value)
      item.key = layout.getItems?.itemKey ? this.evalNodeExpression(node, layout.getItems.itemKey, rawItem) : rawItem.key
      item.title = layout.getItems?.itemTitle ? this.evalNodeExpression(node, layout.getItems.itemTitle, rawItem) : rawItem.title
      item.value = item.value ?? item.key
      item.key = item.key ?? item.value + ''
      item.title = item.title ?? item.key
      if (!item.icon && rawItem.icon) item.icon = rawItem.icon
    } else {
      item.value = layout.getItems?.itemValue ? this.evalNodeExpression(node, layout.getItems.itemValue, rawItem) : rawItem
      item.key = layout.getItems?.itemKey ? this.evalNodeExpression(node, layout.getItems.itemKey, rawItem) : item.value
      item.title = layout.getItems?.itemTitle ? this.evalNodeExpression(node, layout.getItems.itemTitle, rawItem) : item.value
    }
    if (layout.getItems?.itemIcon) item.icon = this.evalNodeExpression(node, layout.getItems?.itemIcon, rawItem)

    logSelectItems('select item after applying itemValue/itemKey/itemTitle/itemIcon expressions', node.fullKey, item)
    return /** @type {import('@json-layout/vocabulary').SelectItem} */(item)
  }

  /**
   * @type {Record<string, number>}
   */
  activatedItems

  /**
   * @param {StateNode} node
   * @param {number} key
   */
  activateItem (node, key) {
    logActivatedItems(node.fullKey, 'activate item explicitly', key)
    this.activatedItems = produce(this.activatedItems, draft => { draft[node.fullKey] = key })
    this._autofocusTarget = node.fullKey + '/' + key
    if (node.key === '$oneOf') {
      if (node.layout.emptyData && node.data && typeof node.data === 'object' && node.children?.[0]) {
        const parentNode = this._lastCreateStateTreeContext.nodes.find(p => p.fullKey === node.parentFullKey)
        if (!parentNode) throw new Error(`parent with key "${node.parentFullKey}" not found`)
        if (!parentNode.data || typeof parentNode.data !== 'object') throw new Error(`parent with key "${node.parentFullKey}" is missing data object`)
        /** @type {Record<string, any>} */
        const newParentData = { ...parentNode.data }
        logActivatedItems(node.fullKey, 'remove properties of previous oneOf activated item', node.children?.[0].fullKey)
        for (const propertyKey of node.children?.[0].skeleton.propertyKeys) {
          delete newParentData[propertyKey]
        }
        this.input(parentNode, newParentData)
      } else {
        this.input(node, undefined)
      }
    } else {
      this.updateState()
    }
    this.handleAutofocus()
  }

  /**
   * @param {StateNode} node
   * @param {boolean} skipUpdateState
   */
  deactivateItem (node, skipUpdateState = false) {
    logActivatedItems(node.fullKey, 'deactivate item explicitly')
    // also deactivate children oneOf for example
    this.activatedItems = produce(this.activatedItems, draft => {
      for (const key in draft) {
        if (key.startsWith(node.fullKey)) {
          logActivatedItems(node.fullKey, 'item deactivation deletes a key', key)
          delete draft[key]
        }
      }
    })
    if (!skipUpdateState) this.updateState()
  }

  handleAutofocus () {
    const autofocusTarget = this._autofocusTarget
    if (autofocusTarget !== null && this._autofocusTarget !== this._previousAutofocusTarget) {
      this._previousAutofocusTarget = autofocusTarget
      setTimeout(() => {
        logDataBinding('emit autofocus event', autofocusTarget)
        this.options.onAutofocus(autofocusTarget)
      })
    }
  }
}
