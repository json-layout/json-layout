import { type LayoutNode, type CompiledLayout } from '../../compile'
import { type Mode } from '..'
import { getDisplay } from '../utils'
import { SectionNode } from './section'
import { TextFieldNode } from './text-field'

export * from './section'
export * from './text-field'

export interface StatefulLayoutNode {
  readonly key: string
  readonly comp: string
  readonly mode: Mode
  readonly value: unknown
  readonly children?: StatefulLayoutNode[]
  hydrateValue: (value: unknown) => void
  // hydrateError: (value: unknown) => void
}

export function makeStatefulNode (
  compiledLayout: CompiledLayout,
  node: LayoutNode,
  mode: Mode,
  containerWidth: number,
  onInput: (value: any) => void
): StatefulLayoutNode {
  const normalizedLayout = compiledLayout.normalizedLayouts[node.layout]
  const display = getDisplay(containerWidth)
  const layout = normalizedLayout[mode][display]
  switch (layout.comp) {
    case 'section':
      return new SectionNode(compiledLayout, node, layout, mode, containerWidth)
    case 'text-field':
      return new TextFieldNode(compiledLayout, node, layout, mode, onInput)
    default:
      throw new Error(`Unknown component ${layout.comp}`)
  }
}
