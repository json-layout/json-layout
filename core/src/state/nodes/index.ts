// import { type Emitter } from 'mitt'
import { type LayoutNode, type CompiledLayout } from '../../compile'
import { type Mode } from '..'
import { getDisplay } from '../utils'
import { type TextField, type CompObject, type Section } from '@json-layout/vocabulary'
import produce, { freeze } from 'immer'
import { type ErrorObject } from 'ajv'
// import { type ErrorObject } from 'ajv-errors'

export interface StateNode {
  layout: CompObject
  key: string
  parentKey: string | null
  mode: Mode
  value: unknown
  error: string | undefined
  children?: StateNode[]
}

export type TextFieldNode = Omit<StateNode, 'children'> & { layout: TextField, value: string }
export const isTextField = (node: StateNode | undefined): node is TextFieldNode => !!node && node.layout.comp === 'text-field'

export type SectionNode = StateNode & { layout: Section, value: Record<string, unknown>, children: StateNode[] }
export const isSection = (node: StateNode | undefined): node is SectionNode => !!node && node.layout.comp === 'section'

// use Immer for efficient updating with immutability and no-op detection
const updateStateNode = produce<StateNode, [string, CompObject, string | null, Mode, unknown, string | undefined, StateNode[]?]>(
  (draft, key, layout, parentKey, mode, value, error, children?) => {
    draft.key = key
    draft.layout = layout
    draft.parentKey = parentKey
    draft.mode = mode
    draft.value = value
    draft.error = error
    draft.children = children
  }
)

export function produceStateNode (
  compiledLayout: CompiledLayout,
  nodesByKeys: Record<string, StateNode>,
  parentKey: string | null,
  skeleton: LayoutNode,
  mode: Mode,
  containerWidth: number,
  value: unknown,
  errors: ErrorObject[],
  reusedNode?: StateNode
): StateNode {
  const normalizedLayout = compiledLayout.normalizedLayouts[skeleton.schemaPointer]
  const display = getDisplay(containerWidth)
  const layout = normalizedLayout[mode][display]
  const fullKey = parentKey === null ? skeleton.key : (parentKey + '/' + skeleton.key)

  let children
  if (layout.comp === 'section') {
    value = value ?? {}
    // TODO: make this type casting safe using prior validation
    const objectValue = (value ?? {}) as Record<string, unknown>
    children = skeleton.children?.map((child, i) => {
      return produceStateNode(compiledLayout, nodesByKeys, fullKey, child, mode, containerWidth, objectValue[child.key], errors, reusedNode?.children?.[i])
    })
  }

  if (layout.comp === 'text-field') {
    value = value ?? ''
  }

  const error = errors.find(e => {
    const error = e.params?.errors?.[0] ?? e
    if (parentKey === error.instancePath && error.params?.missingProperty === skeleton.key) return true
    if (fullKey === error.instancePath) return true
    return false
  })

  nodesByKeys[fullKey] = reusedNode
    ? updateStateNode(reusedNode, skeleton.key, layout, parentKey, mode, value, error?.message, children)
    : freeze({ key: skeleton.key, layout, parentKey, mode, value, error: error?.message, children })
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
