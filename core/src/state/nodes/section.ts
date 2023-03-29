import { makeStatefulNode, type StatefulLayoutNode } from '.'
import { type LayoutNode, type CompiledLayout } from '../../compile'
import { type Mode } from '..'
import { type Section } from '@json-layout/vocabulary'

export class SectionNode implements StatefulLayoutNode, Omit<Section, 'children'> {
  readonly key: string
  readonly comp!: 'section'
  readonly mode: Mode
  readonly width: number
  private _value: Record<string, any>
  get value () { return this._value }
  readonly children: StatefulLayoutNode[]

  constructor (
    compiledLayout: CompiledLayout,
    skeleton: LayoutNode,
    layout: Section,
    mode: Mode,
    diwth: number
  ) {
    this.key = skeleton.key
    this.mode = mode
    this.width = diwth
    this._value = {}
    this.children = (skeleton.children ?? []).map(child => makeStatefulNode(compiledLayout, child, mode, this.width, (childValue) => {
      this.value[child.key] = childValue
    }))
  }

  hydrateValue (value: unknown) {
    // TODO: perform schema validation on hydrating data so that we can perform this type casting safely
    this._value = value as Record<string, any>
    for (const child of this.children) {
      child.hydrateValue(this._value[child.key])
    }
  }
}
