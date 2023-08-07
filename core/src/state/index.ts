import mitt, { type Emitter } from 'mitt'
import { type CompiledLayout, type SkeletonTree } from '../compile'
import { producePatchedData, type StateNode } from './state-node'
import { type CreateStateTreeContext, type StateTree, createStateTree } from './state-tree'
import { Display } from './utils/display'

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

export class StatefulLayout {
  readonly events: Emitter<StatefulLayoutEvents>
  private readonly _compiledLayout: CompiledLayout
  get compiledLayout () { return this._compiledLayout }

  private _stateTree!: StateTree
  get stateTree () { return this._stateTree }

  private readonly skeletonTree: SkeletonTree

  private _mode: Mode
  get mode () { return this._mode }
  set mode (mode) {
    this._mode = mode
    this.updateState()
  }

  private _width: number
  private _display: Display
  get width () { return this._width }
  set width (width) {
    this._width = width
    this._display = this._display && this._display.width === width ? this._display : new Display(width)
    this.updateState()
  }

  private _data: unknown
  get data () { return this._data }
  set data (data: unknown) {
    this._data = data
    this.updateState()
  }

  private _lastCreateStateTreeContext!: CreateStateTreeContext

  constructor (compiledLayout: CompiledLayout, skeletonTree: SkeletonTree, mode: Mode, width: number, value: unknown = {}) {
    this._compiledLayout = compiledLayout
    this.skeletonTree = skeletonTree
    this.events = mitt<StatefulLayoutEvents>()
    this._mode = mode
    this._width = width
    this._display = new Display(width)
    this._data = value
    this.updateState()
  }

  private updateState () {
    const createStateTreeContext: CreateStateTreeContext = { nodes: [] }
    this._stateTree = createStateTree(
      createStateTreeContext,
      this._compiledLayout,
      this.skeletonTree,
      this._mode,
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
}
