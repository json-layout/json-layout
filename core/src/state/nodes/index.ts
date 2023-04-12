// import { type Emitter } from 'mitt'
import { type LayoutNode, type CompiledLayout } from '../../compile'
import { type Mode } from '..'
import { getDisplay } from '../utils'
import { type TextField, type CompObject, type Section } from '@json-layout/vocabulary'
import produce, { freeze } from 'immer'

export interface StateNode {
  layout: CompObject
  key: string
  parentKey: string | null
  mode: Mode
  value: unknown
  children?: StateNode[]
}

export type TextFieldNode = Omit<StateNode, 'children'> & { layout: TextField, value: string }
export const isTextField = (node: StateNode | undefined): node is TextFieldNode => !!node && node.layout.comp === 'text-field'

export type SectionNode = StateNode & { layout: Section, value: Record<string, unknown>, children: StateNode[] }
export const isSection = (node: StateNode | undefined): node is SectionNode => !!node && node.layout.comp === 'section'

// use Immer for efficient updating with immutability and no-op detection
const updateStateNode = produce<StateNode, [CompObject, string, string | null, Mode, unknown, StateNode[]?]>((draft, layout, key, parentKey, mode, value, children?) => {
  draft.layout = layout
  draft.key = key
  draft.parentKey = parentKey
  draft.mode = mode
  draft.value = value
  draft.children = children
})

export function produceStateNode (
  compiledLayout: CompiledLayout,
  nodesByKeys: Record<string, StateNode>,
  // events: Emitter<Record<string, any>>,
  parentKey: string | null,
  skeleton: LayoutNode,
  mode: Mode,
  containerWidth: number,
  value: unknown,
  reusedNode?: StateNode
): StateNode {
  const normalizedLayout = compiledLayout.normalizedLayouts[skeleton.layout]
  const display = getDisplay(containerWidth)
  const layout = normalizedLayout[mode][display]
  const fullKey = parentKey ? (parentKey + '.' + skeleton.key) : skeleton.key

  let children
  if (layout.comp === 'section') {
    value = value ?? {}
    // TODO: make this type casting safe using prior validation
    const objectValue = (value ?? {}) as Record<string, unknown>
    children = skeleton.children?.map((child, i) => {
      return produceStateNode(compiledLayout, nodesByKeys, fullKey, child, mode, containerWidth, objectValue[child.key], reusedNode?.children?.[i])
    })
  }

  if (layout.comp === 'text-field') {
    value = value ?? ''
  }

  nodesByKeys[fullKey] = reusedNode ? updateStateNode(reusedNode, layout, skeleton.key, parentKey, mode, value, children) : freeze({ layout, key: skeleton.key, parentKey, mode, value, children })
  return nodesByKeys[fullKey]

  /* switch (layout.comp) {
    case 'section':
      // return new SectionNode(compiledLayout, skeleton, layout, mode, containerWidth)
      return produceSectionNode(reusedNode, { key: skeleton.key, skeleton, mode, value, containerWidth })
    case 'text-field':
      return produceTextFieldNode(reusedNode, { key: skeleton.key, mode, value })
    default:
      throw new Error(`Unknown component ${layout.comp}`)
  } */
}

export const produceStateNodeValue = produce((draft, key, value) => {
  draft[key] = value
})
