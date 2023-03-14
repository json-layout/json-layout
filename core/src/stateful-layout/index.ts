import mitt, { type Emitter } from 'mitt'
import { type CompObject, type NormalizedLayout } from '../normalized-layout'
import { type CompiledLayout, type StatefulLayoutSkeleton } from './compile'

export * from './compile'

export class StatefulLayout {
  readonly events: Emitter<StatefulLayoutEvents>
  readonly root: StatefulLayoutNode
  constructor (compiledLayout: CompiledLayout) {
    this.events = mitt<StatefulLayoutEvents>()
    this.root = new StatefulLayoutNode(compiledLayout, compiledLayout.skeleton, 'write')
  }
}

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type StatefulLayoutEvents = {
  input: unknown
  inputChild: { schemaPath: string, dataPath: string, value: unknown }
  change: undefined
}

interface StatefulLayoutNodeInspect {
  key: string
  mode: string
  display: string
  layout: CompObject
  children?: StatefulLayoutNodeInspect[]
}

export class StatefulLayoutNode {
  key: string

  private readonly mode: 'read' | 'write'

  private readonly normalizedLayout: NormalizedLayout

  private readonly children?: StatefulLayoutNode[]

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

  inspect (): StatefulLayoutNodeInspect {
    const inspectObject: StatefulLayoutNodeInspect = {
      key: this.key,
      mode: this.mode,
      display: this.display,
      layout: this.layout
    }
    if (this.children) {
      inspectObject.children = this.children.map(c => c.inspect())
    }
    return inspectObject
  }

  constructor (compiledLayout: CompiledLayout, skeleton: StatefulLayoutSkeleton, mode: 'read' | 'write') {
    this.key = skeleton.key
    this.normalizedLayout = compiledLayout.normalizedLayouts[skeleton.layout]
    this.mode = mode
    if (skeleton.children) {
      this.children = skeleton.children.map(childSkeleton => new StatefulLayoutNode(compiledLayout, childSkeleton, mode))
    }
  }
}
