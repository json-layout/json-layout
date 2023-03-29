import { type StatefulLayoutNode } from '.'
import { type LayoutNode, type CompiledLayout } from '../../compile'
import { type Mode } from '../'
import { type TextField } from '@json-layout/vocabulary'

export class TextFieldNode implements StatefulLayoutNode, TextField {
  readonly key: string
  readonly comp!: 'text-field'
  readonly mode: Mode
  private _value: string
  get value () { return this._value }
  private readonly onInput: (value: string | undefined | null) => void

  constructor (
    compiledLayout: CompiledLayout,
    skeleton: LayoutNode,
    layout: TextField,
    mode: Mode,
    onInput: (value: string | undefined | null) => void
  ) {
    this.key = skeleton.key
    this.mode = mode
    this._value = ''
    this.onInput = onInput
  }

  input (value: string) {
    this._value = value
    this.onInput(value || undefined)
  }

  hydrateValue (value: unknown) {
    // TODO: perform schema validation on hydrating data so that we can perform this type casting safely
    this._value = (value || '') as string
  }
}
