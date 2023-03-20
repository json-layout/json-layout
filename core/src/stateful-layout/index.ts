import mitt, { type Emitter } from 'mitt'
import { type TextField, type Section } from '../normalized-layout'
import { type CompiledLayout, type StatefulLayoutSkeleton } from './compile'
import { getDisplay } from './utils'

export * from './compile'

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type StatefulLayoutEvents = {
  input: unknown
  inputChild: { schemaPath: string, dataPath: string, value: unknown }
  change: undefined
}

export class StatefulLayout {
  readonly events: Emitter<StatefulLayoutEvents>
  readonly root: Node
  readonly mode: Mode
  readonly width: number
  value: any
  constructor (compiledLayout: CompiledLayout, mode: Mode, width: number) {
    this.events = mitt<StatefulLayoutEvents>()
    this.mode = mode
    this.width = width
    this.root = makeNode(compiledLayout, compiledLayout.skeleton, mode, width, (value) => {
      this.value = value
    })
  }

  hydrate (value: any) {
    this.root.hydrate(value)
  }
}

type Mode = 'read' | 'write'

interface Node {
  readonly key: string
  readonly comp: string
  readonly mode: Mode
  readonly value: unknown
  readonly children?: Node[]
  hydrate: (value: unknown) => void
}

const makeNode = (
  compiledLayout: CompiledLayout,
  skeleton: StatefulLayoutSkeleton,
  mode: Mode,
  containerWidth: number,
  onInput: (value: any) => void
): Node => {
  const normalizedLayout = compiledLayout.normalizedLayouts[skeleton.layout]
  const display = getDisplay(containerWidth)
  const layout = normalizedLayout[mode][display]
  switch (layout.comp) {
    case 'section':
      return new SectionNode(compiledLayout, skeleton, layout, mode, containerWidth)
    case 'text-field':
      return new TextFieldNode(compiledLayout, skeleton, layout, mode, onInput)
    default:
      throw new Error(`Unknown component ${layout.comp}`)
  }
}

export class SectionNode implements Node, Omit<Section, 'children'> {
  readonly key: string
  readonly comp!: 'section'
  readonly mode: Mode
  readonly width: number
  private _value: Record<string, any>
  get value () { return this._value }
  readonly children: Node[]

  constructor (
    compiledLayout: CompiledLayout,
    skeleton: StatefulLayoutSkeleton,
    layout: Section,
    mode: Mode,
    diwth: number
  ) {
    this.key = skeleton.key
    this.mode = mode
    this.width = diwth
    this._value = {}
    this.children = (skeleton.children ?? []).map(child => makeNode(compiledLayout, child, mode, this.width, (childValue) => {
      this.value[child.key] = childValue
    }))
  }

  hydrate (value: unknown) {
    // TODO: perform schema validation on hydrating data so that we can perform this type casting safely
    this._value = value as Record<string, any>
    for (const child of this.children) {
      child.hydrate(this._value[child.key])
    }
  }
}

export class TextFieldNode implements Node, TextField {
  readonly key: string
  readonly comp!: 'text-field'
  readonly mode: Mode
  private _value: string
  get value () { return this._value }
  private readonly onInput: (value: string | undefined | null) => void

  constructor (
    compiledLayout: CompiledLayout,
    skeleton: StatefulLayoutSkeleton,
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

  hydrate (value: unknown) {
    // TODO: perform schema validation on hydrating data so that we can perform this type casting safely
    this._value = (value || '') as string
  }
}
