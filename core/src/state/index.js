// eslint-disable-next-line import/no-named-default
import mittModule from 'mitt'
import debug from 'debug'
import { evalExpression, producePatchedData } from './state-node.js'
import { createStateTree } from './state-tree.js'
import { Display } from './utils/display.js'
import { isGetItemsExpression, isGetItemsFetch } from '@json-layout/vocabulary'

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

/** @type {(node: StateNode | undefined) => node is SelectNode} */
export const isSelect = (node) => !!node && node.layout.comp === 'select'

const logDataBinding = debug('jl:data-binding')

// ugly fix of modules whose default export were wrongly declared
// @ts-ignore
const mitt = /** @type {typeof mittModule.default} */ (mittModule)

/**
 * @param {Partial<StatefulLayoutOptions>} partialOptions
 * @returns {StatefulLayoutOptions}
 */
function fillOptions (partialOptions) {
  return {
    context: {},
    width: 1000,
    readOnly: false,
    summary: false,
    titleDepth: 2,
    ...partialOptions
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
    this.updateState()
  }

  /**
   * @private
   * @param {Partial<StatefulLayoutOptions>} options
   */
  prepareOptions (options) {
    this._options = fillOptions(options)
    this._display = this._display && this._display.width === this._options.width ? this._display : new Display(this._options.width)
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
    const createStateTreeContext = { nodes: [] }
    this._stateTree = createStateTree(
      createStateTreeContext,
      this._options,
      this._compiledLayout,
      this.skeletonTree,
      this._display,
      this._data,
      this._stateTree
    )
    this._lastCreateStateTreeContext = createStateTreeContext
  }

  /**
   * @param {StateNode} node
   * @param {unknown} data
   */
  input (node, data) {
    logDataBinding('received input from node', node, data)
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
   * @returns {Promise<import('@json-layout/vocabulary').SelectItems>}
   */
  async getSelectItems (node) {
    if (!isSelect(node)) throw new Error('node is not a select component')
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
}
