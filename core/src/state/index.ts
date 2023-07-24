import { type ErrorObject, type ValidateFunction } from 'ajv'
import mitt, { type Emitter } from 'mitt'
import { type CompiledLayout, type LayoutTree } from '../compile'
import { produceStateNode, produceStateNodeValue, type StateNode } from './nodes'

export * from './nodes'

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type StatefulLayoutEvents = {
  // input: { value: unknown, child: { schemaPointer: string, dataPointer: string, value: unknown } }
  input: unknown
}

export type Mode = 'read' | 'write'

export class StatefulLayout {
  readonly events: Emitter<StatefulLayoutEvents>
  private readonly _compiledLayout: CompiledLayout
  private readonly _tree: LayoutTree

  private _root: StateNode
  get root () { return this._root }

  private _mode: Mode
  get mode () { return this._mode }
  set mode (mode) {
    this._mode = mode
    this._root = this.produceRoot()
  }

  private _width: number
  get width () { return this._width }
  set width (width) {
    this._width = width
    this._root = this.produceRoot()
  }

  private _errors: ErrorObject[]
  get errors () { return this._errors }

  private _value: unknown
  get value () { return this._value }
  set value (value: unknown) {
    this._value = value
    this._root = this.produceRoot()
  }

  private readonly validate: ValidateFunction

  private _nodesByKeys: Record<string, StateNode> = {}

  constructor (compiledLayout: CompiledLayout, tree: LayoutTree, mode: Mode, width: number, value: unknown = {}) {
    this._compiledLayout = compiledLayout
    this._tree = tree
    this.events = mitt<StatefulLayoutEvents>()
    this._mode = mode
    this._width = width
    this._errors = []
    this._value = value
    this.validate = compiledLayout.validates[compiledLayout.tree.validate]
    this._root = this.produceRoot()
  }

  private produceRoot () {
    this._nodesByKeys = {}
    this.validate(this._value)
    console.log('errors ?', this.validate.errors)
    this._errors = this.validate.errors ?? []
    return produceStateNode(
      this._compiledLayout,
      this._nodesByKeys,
      null,
      this._tree.root,
      this._mode,
      this._width,
      this._value,
      this._errors,
      this._root
    )
  }

  input (node: StateNode, value: unknown) {
    if (node.parentKey === null) {
      this.value = value
      this.events.emit('input', value)
      return
    }
    const parentNode = this._nodesByKeys[node.parentKey]
    if (!parentNode) throw new Error(`parent with key "${node.parentKey}" not found`)
    const newParentValue = produceStateNodeValue(parentNode.value, node.key, value)
    this.input(parentNode, newParentValue)
  }
}
