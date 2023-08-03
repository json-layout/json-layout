import { type ValidateFunction } from 'ajv'
import mitt, { type Emitter } from 'mitt'
import { type CompiledLayout, type LayoutTree } from '../compile'
import { produceStateNode, produceStateNodeValue, type StateNode } from './nodes'
import { Display } from './utils/display'

export * from './nodes'

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

  private readonly _tree: LayoutTree

  private _root!: StateNode
  get root () { return this._root }

  private _mode: Mode
  get mode () { return this._mode }
  set mode (mode) {
    this._mode = mode
    this.produceRoot()
  }

  private _width: number
  private _display: Display
  get width () { return this._width }
  set width (width) {
    this._width = width
    this._display = this._display && this._display.width === width ? this._display : new Display(width)
    this.produceRoot()
  }

  private _valid: boolean
  get valid () { return this._valid }

  private _value: unknown
  get value () { return this._value }
  set value (value: unknown) {
    this._value = value
    this.produceRoot()
  }

  private readonly _validate: ValidateFunction

  private _nodesByPointers: Record<string, StateNode> = {}

  constructor (compiledLayout: CompiledLayout, tree: LayoutTree, mode: Mode, width: number, value: unknown = {}) {
    this._compiledLayout = compiledLayout
    this._tree = tree
    this.events = mitt<StatefulLayoutEvents>()
    this._mode = mode
    this._width = width
    this._display = new Display(width)
    this._valid = true
    this._value = value
    this._validate = compiledLayout.validates[compiledLayout.tree.validate]
    this.produceRoot()
  }

  private produceRoot () {
    this._nodesByPointers = {}
    this._valid = this._validate(this._value)
    this._root = produceStateNode(
      this._compiledLayout,
      this._nodesByPointers,
      this._tree.root,
      this._mode,
      this._display,
      this._value,
      this._validate.errors ?? [],
      this._root
    )
    this.events.emit('update', this)
  }

  input (node: StateNode, value: unknown) {
    if (node.parentPointer === null) {
      this.value = value
      this.events.emit('input', value)
      return
    }
    const parentNode = this._nodesByPointers[node.parentPointer]
    if (!parentNode) throw new Error(`parent with key "${node.parentPointer}" not found`)
    const newParentValue = produceStateNodeValue(parentNode.value, node.key, value)
    this.input(parentNode, newParentValue)
  }
}
