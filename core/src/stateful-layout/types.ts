import { type CompObject, type NormalizedLayout } from '../normalized-layout'
import { type CompiledLayout, type StatefulLayoutSkeleton } from './compile'

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type StatefulLayoutEvents = {
  input: unknown
  inputChild: { schemaPath: string, dataPath: string, value: unknown }
  change: undefined
}

export class StatefulLayoutNode {
  key: string

  private readonly mode: 'read' | 'write'

  private readonly normalizedLayout: NormalizedLayout

  get layout (): CompObject { return this.normalizedLayout[this.mode][this.display] }

  private _display: 'xs' | 'sm' | 'md' | 'lg' | 'xl' = 'xs'
  get display () { return this._display }

  private _width: number = 0
  get width () { return this._width }
  set width (width: number) {
    this._width = width
    if (width < 600) this._display = 'xs'
    else if (width < 960) this._display = 'sm'
    else if (width < 1264) this._display = 'md'
    else if (width < 1904) this._display = 'lg'
    else this._display = 'xl'
  }

  private _value: unknown
  get value () { return this._value }
  set value (value: unknown) {
    // TODO: propagate to parent, check validation errors, etc
    this._value = value
  }

  input (value: unknown) {
    // TODO: emit input and inputChild events
    this.value = value
  }

  change () {
    // TODO: emit change event
  }

  constructor (compiledLayout: CompiledLayout, skeleton: StatefulLayoutSkeleton, mode: 'read' | 'write') {
    this.key = key
    this.normalizedLayout = compiledLayout.normalizedLayouts[skeleton.layout]
    this.mode = mode
  }
}
