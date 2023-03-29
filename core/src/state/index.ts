import { type ValidateFunction } from 'ajv'
import mitt, { type Emitter } from 'mitt'
import { type CompiledLayout, type LayoutTree } from '../compile'
import { makeStatefulNode, type StatefulLayoutNode } from './nodes'

export * from './nodes'

// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type StatefulLayoutEvents = {
  input: { value: unknown, child: { schemaPointer: string, dataPointer: string, value: unknown } }
  change: undefined
}

export type Mode = 'read' | 'write'

export class StatefulLayout {
  readonly events: Emitter<StatefulLayoutEvents>
  readonly root: StatefulLayoutNode
  readonly mode: Mode
  readonly width: number
  value: any
  validate: ValidateFunction
  constructor (compiledLayout: CompiledLayout, tree: LayoutTree, mode: Mode, width: number) {
    this.events = mitt<StatefulLayoutEvents>()
    this.mode = mode
    this.width = width
    this.validate = compiledLayout.validates[compiledLayout.tree.validate]
    this.root = makeStatefulNode(compiledLayout, compiledLayout.tree.root, mode, width, (value) => {
      this.value = value
    })
  }

  hydrate (value: any) {
    this.root.hydrateValue(value)
  }
}
