import mitt, { type Emitter } from 'mitt'
import { type CompiledLayout, type SkeletonTree } from '../compile'
import { evalExpression, producePatchedData, type StateNode } from './state-node'
import { type CreateStateTreeContext, type StateTree, createStateTree } from './state-tree'
import { Display } from './utils/display'
import { isSelect } from './nodes'
import { isGetItemsExpression, type SelectItems } from '@json-layout/vocabulary'

export * from './nodes'
export type { StateTree } from './state-tree'
export type { StateNode } from './state-node'

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type StatefulLayoutEvents = {
  // input: { value: unknown, child: { pointer: string, dataPointer: string, value: unknown } }
  input: unknown
  'update': StatefulLayout
}

export type Mode = 'read' | 'write'

export interface StatefulLayoutOptions {
  context: Record<string, any>
  mode: Mode
  width: number
}

const fillOptions = (partialOptions: Partial<StatefulLayoutOptions>): StatefulLayoutOptions => {
  return {
    context: {},
    mode: 'write',
    width: 1000,
    ...partialOptions
  }
}

export class StatefulLayout {
  readonly events: Emitter<StatefulLayoutEvents>
  private readonly _compiledLayout: CompiledLayout
  get compiledLayout () { return this._compiledLayout }

  private _stateTree!: StateTree
  get stateTree () { return this._stateTree }

  private readonly skeletonTree: SkeletonTree

  private _display!: Display

  private _options!: StatefulLayoutOptions
  get options () { return this._options }
  set options (options: Partial<StatefulLayoutOptions>) {
    this._options = fillOptions(options)
    this._display = this._display && this._display.width === this._options.width ? this._display : new Display(this._options.width)
    this.updateState()
  }

  private _data: unknown
  get data () { return this._data }
  set data (data: unknown) {
    this._data = data
    this.updateState()
  }

  private _lastCreateStateTreeContext!: CreateStateTreeContext

  constructor (compiledLayout: CompiledLayout, skeletonTree: SkeletonTree, options: Partial<StatefulLayoutOptions>, value: unknown = {}) {
    this._compiledLayout = compiledLayout
    this.skeletonTree = skeletonTree
    this.events = mitt<StatefulLayoutEvents>()
    this.options = options
    this._data = value
    this.updateState()
  }

  private updateState () {
    const createStateTreeContext: CreateStateTreeContext = { nodes: [] }
    this._stateTree = createStateTree(
      createStateTreeContext,
      this._options,
      this._compiledLayout,
      this.skeletonTree,
      this._display,
      this._data,
      this._stateTree
    )
    this._data = this._stateTree.root.data
    this._lastCreateStateTreeContext = createStateTreeContext
    this.events.emit('update', this)
  }

  input (node: StateNode, data: unknown) {
    if (node.parentFullKey === null) {
      this.data = data
      this.events.emit('input', this.data)
      return
    }
    const parentNode = this._lastCreateStateTreeContext.nodes.find(p => p.fullKey === node.parentFullKey)
    if (!parentNode) throw new Error(`parent with key "${node.parentFullKey}" not found`)
    const newParentValue = producePatchedData(parentNode.data, node, data)
    this.input(parentNode, newParentValue)
  }

  getSelectItems (node: StateNode): SelectItems {
    if (!isSelect(node)) throw new Error('node is not a select component')
    if (node.layout.items) return node.layout.items
    if (node.layout.getItems && isGetItemsExpression(node.layout.getItems)) {
      return evalExpression(this.compiledLayout.expressions, node.layout.getItems, this._options.context, node.mode, new Display(node.width))
    }
    throw new Error('node is missing items or getItems parameters')
  }
}
