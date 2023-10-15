// eslint-disable-next-line import/no-named-default
import mittModule from 'mitt'
import debug from 'debug'
import { evalExpression, producePatchedData } from './state-node.js'
import { createStateTree } from './state-tree.js'
import { Display } from './utils/display.js'
import { isGetItemsExpression, isGetItemsFetch, isItemsLayout } from '@json-layout/vocabulary'

export { Display } from './utils/display.js'

/**
 * @typedef {import('./types.js').StateNode} StateNode
 * @typedef {import('./types.js').StateTree} StateTree
 * @typedef {import('./types.js').StatefulLayoutOptions} StatefulLayoutOptions
 * @typedef {import('./types.js').StatefulLayoutEvents} StatefulLayoutEvents
 * @typedef {import('./types.js').CreateStateTreeContext} CreateStateTreeContext
 * @typedef {import('./types.js').TextFieldNode} TextFieldNode
 * @typedef {import('./types.js').TextareaNode} TextareaNode
 * @typedef {import('./types.js').NumberFieldNode} NumberFieldNode
 * @typedef {import('./types.js').SliderNode} SliderNode
 * @typedef {import('./types.js').SectionNode} SectionNode
 * @typedef {import('./types.js').SelectNode} SelectNode
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
 * @typedef {import('./types.js').OneOfSelectNode} OneOfSelectNode
 * @typedef {import('./types.js').ListNode} ListNode
 */

/** @type {(node: StateNode | undefined) => node is SectionNode} */
export const isSection = (node) => !!node && node.layout.comp === 'section'

/** @type {(node: StateNode | undefined) => node is SelectNode | ComboboxNode} */
export const isItemsNode = (node) => !!node && isItemsLayout(node.layout)

const logDataBinding = debug('jl:data-binding')

// ugly fix of modules whose default export were wrongly declared
// @ts-ignore
const mitt = /** @type {typeof mittModule.default} */ (mittModule)

/**
 * @param {Partial<StatefulLayoutOptions>} partialOptions
 * @param {import('../index.js').CompiledLayout} compiledLayout
 * @returns {StatefulLayoutOptions}
 */
function fillOptions (partialOptions, compiledLayout) {
  const messages = { ...compiledLayout.messages }
  if (partialOptions.messages) Object.assign(messages, partialOptions.messages)
  return {
    context: {},
    width: 1000,
    readOnly: false,
    summary: false,
    titleDepth: 2,
    validateOn: 'input',
    initialValidation: 'withData',
    ...partialOptions,
    messages
  }
}

export class StatefulLayout {
  /**
   * @readonly
   * @type {import('mitt').Emitter<StatefulLayoutEvents>}
   */
  events

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
    this._validationState = {
      initialized: validationState.initialized ?? this._validationState.initialized ?? false,
      validatedForm: validationState.validatedForm ?? this._validationState.validatedForm ?? false,
      validatedChildren: validationState.validatedChildren ?? this._validationState.validatedChildren ?? []
    }
    this.updateState()
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
   * @type {CreateStateTreeContext}
   */
  // @ts-ignore
  _lastCreateStateTreeContext

  /**
   * @param {import("../index.js").CompiledLayout} compiledLayout
   * @param {import("../index.js").SkeletonTree} skeletonTree
   * @param {Partial<StatefulLayoutOptions>} options
   * @param {unknown} data
   */
  constructor (compiledLayout, skeletonTree, options, data = {}) {
    this._compiledLayout = compiledLayout
    this.skeletonTree = skeletonTree
    /** @type {import('mitt').Emitter<StatefulLayoutEvents>} */
    this.events = mitt()
    this.prepareOptions(options)
    this._data = data
    this.initValidationState()
    this.activeItems = {}
    this.updateState()
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
    if (this._data !== this._stateTree.root.data) {
      logDataBinding('hydrating state tree changed the data, do it again', this._data, this._stateTree.root.data)
      // this is necessary because a first hydration can add default values and change validity, etc
      this._data = this._stateTree.root.data
      this.createStateTree()
    }
    logDataBinding('emit update event', this._data, this._stateTree)
    this.events.emit('update', this)
  }

  /**
   * @private
   */
  createStateTree () {
    /** @type {CreateStateTreeContext} */
    const createStateTreeContext = { nodes: [], activeItems: this.activeItems }
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
      this.validationState = { initialized: true, validatedChildren: createStateTreeContext.nodes.filter(n => n.validated).map(n => n.fullKey) }
    }
  }

  validate () {
    this.validationState = { validatedForm: true }
  }

  resetValidation () {
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
   * @returns {boolean}
   */
  get hasHiddenError () {
    return this._lastCreateStateTreeContext.nodes.findIndex(node => node.error && !node.validated) !== -1
  }

  /**
   * @param {StateNode} node
   * @param {unknown} data
   * @param {number} [activateKey]
   */
  input (node, data, activateKey) {
    logDataBinding('received input event from node', node, data)
    if (node.options.validateOn === 'input' && !this.validationState.validatedChildren.includes(node.fullKey)) {
      this.validationState = { validatedChildren: this.validationState.validatedChildren.concat([node.fullKey]) }
    }
    if (activateKey !== undefined) {
      this.activeItems[node.fullKey] = activateKey
    }
    if (node.parentFullKey === null) {
      this.data = data
      this.events.emit('input', this.data)
      return
    }
    const parentNode = this._lastCreateStateTreeContext.nodes.find(p => p.fullKey === node.parentFullKey)
    if (!parentNode) throw new Error(`parent with key "${node.parentFullKey}" not found`)
    const newParentValue = producePatchedData(parentNode.data ?? {}, node, data)
    this.input(parentNode, newParentValue)
  }

  /**
   * @param {StateNode} node
   */
  blur (node) {
    logDataBinding('received blur event from node', node)
    if (
      (node.options.validateOn === 'input' || node.options.validateOn === 'blur') &&
      !this.validationState.validatedChildren.includes(node.fullKey)
    ) {
      this.validationState = { validatedChildren: this.validationState.validatedChildren.concat([node.fullKey]) }
    }
  }

  /**
   * @param {StateNode} node
   * @returns {Promise<import('@json-layout/vocabulary').SelectItems>}
   */
  async getSelectItems (node) {
    if (!isItemsNode(node)) throw new Error('node is not a select component')
    if (node.layout.items) return node.layout.items

    /** @type {(expression: import('@json-layout/vocabulary').Expression, data: any) => any} */
    const evalSelectExpression = (expression, data) => {
      return evalExpression(this.compiledLayout.expressions, expression, data, node.options, new Display(node.options.width))
    }

    let rawItems
    if (node.layout.getItems && isGetItemsExpression(node.layout.getItems)) {
      rawItems = evalSelectExpression(node.layout.getItems, null)
      if (!Array.isArray(rawItems)) throw new Error('getItems expression didn\'t return an array')
    }
    if (node.layout.getItems && isGetItemsFetch(node.layout.getItems)) {
      const url = evalSelectExpression(node.layout.getItems.url, null)
      rawItems = await (await fetch(url)).json()
    }

    if (rawItems) {
      if (node.layout.getItems?.itemsResults) {
        rawItems = evalSelectExpression(node.layout.getItems.itemsResults, rawItems)
      }
      return rawItems.map((/** @type {any} */ rawItem) => {
        if (typeof rawItem === 'object') {
          /** @type {Partial<import('@json-layout/vocabulary').SelectItem>} */
          const item = {}
          item.value = node.layout.getItems?.itemValue ? evalSelectExpression(node.layout.getItems.itemValue, rawItem) : (node.layout.getItems?.returnObjects ? rawItem : rawItem.value)
          item.key = node.layout.getItems?.itemKey ? evalSelectExpression(node.layout.getItems.itemKey, rawItem) : rawItem.key
          item.title = node.layout.getItems?.itemTitle ? evalSelectExpression(node.layout.getItems.itemTitle, rawItem) : rawItem.title
          item.value = item.value ?? item.key
          item.key = item.key ?? item.value + ''
          item.title = item.title ?? item.key
          return item
        } else {
          /** @type {Partial<import('@json-layout/vocabulary').SelectItem>} */
          const item = {}
          item.value = node.layout.getItems?.itemValue ? evalSelectExpression(node.layout.getItems.itemValue, rawItem) : rawItem
          item.key = node.layout.getItems?.itemKey ? evalSelectExpression(node.layout.getItems.itemKey, rawItem) : item.value
          item.title = node.layout.getItems?.itemTitle ? evalSelectExpression(node.layout.getItems.itemTitle, rawItem) : item.value
          return item
        }
      })
    }
    throw new Error('node is missing items or getItems parameters')
  }

  /**
   * @type {Record<string, number>}
   */
  activeItems

  /**
   * @param {StateNode} node
   * @param {number} key
   */
  activateItem (node, key) {
    this.activeItems[node.fullKey] = key
    if (node.key === '$oneOf') {
      this.input(node, node.skeleton.childrenTrees?.[key].root.defaultData)
    } else {
      this.updateState()
    }
  }

  /**
   * @param {StateNode} node
   */
  deactivateItem (node) {
    delete this.activeItems[node.fullKey]
    this.updateState()
  }
}
