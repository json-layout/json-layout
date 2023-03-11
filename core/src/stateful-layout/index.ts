import { type CompObject } from '../normalized-layout'
import mitt, { type Emitter } from 'mitt'

export interface StatefulLayoutNode {
  key: string
  layout: CompObject
  readonly mode: 'read' | 'write'
  readonly breakpoint: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  value: unknown
  input: (v: unknown) => void
  change: () => void
}

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
type StatefulLayoutEvents = {
  input: unknown
  inputChild: { schemaPath: string, dataPath: string, value: unknown }
  change: undefined
}

export class StatefulLayout {
  events: Emitter<StatefulLayoutEvents>
  constructor (schema: any) {
    this.events = mitt<StatefulLayoutEvents>()
  }
}
