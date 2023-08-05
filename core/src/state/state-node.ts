// import { type Emitter } from 'mitt'
import { type SkeletonNode, type CompiledLayout } from '../compile'
import { type Mode } from '..'
// import { getDisplay } from '../utils'
import { type CompObject, isSwitch } from '@json-layout/vocabulary'
import produce from 'immer'
import { type ErrorObject } from 'ajv'
import { type Display } from './utils/display'
import { shallowCompareArrays } from './utils/immutable'
import { type CreateStateTreeContext } from './state-tree'
// import { type ErrorObject } from 'ajv-errors'

export interface StateNode {
  fullKey: string
  parentFullKey: string | null
  skeleton: SkeletonNode
  layout: CompObject
  mode: Mode
  value: unknown
  error: string | undefined
  children?: StateNode[]
}

// use Immer for efficient updating with immutability and no-op detection
const produceStateNode = produce<StateNode, [string, string | null, SkeletonNode, CompObject, Mode, unknown, string | undefined, StateNode[]?]>(
  (draft, fullKey, parentFullKey, skeleton, layout, mode, value, error, children?) => {
    draft.fullKey = fullKey
    draft.parentFullKey = parentFullKey
    draft.skeleton = skeleton
    draft.layout = layout
    draft.mode = mode
    draft.value = value
    draft.error = error
    draft.children = children
  }
)

const nodeCompObject: CompObject = { comp: 'none' }

const matchError = (error: ErrorObject, skeleton: SkeletonNode): boolean => {
  const originalError = error.params?.errors?.[0] ?? error
  if (skeleton.parentDataPath === originalError.instancePath && originalError.params?.missingProperty === skeleton.key) return true
  if (originalError.instancePath === skeleton.dataPath && originalError.schemaPath === skeleton.pointer) return true
  return false
}
const matchChildError = (error: ErrorObject, skeleton: SkeletonNode): boolean => {
  if (error.instancePath.startsWith(skeleton.dataPath)) return true
  return false
}

export function createStateNode (
  context: CreateStateTreeContext,
  compiledLayout: CompiledLayout,
  fullKey: string,
  parentFullKey: string | null,
  skeleton: SkeletonNode,
  mode: Mode,
  display: Display,
  value: unknown,
  reusedNode?: StateNode
): StateNode {
  const normalizedLayout = compiledLayout.normalizedLayouts[skeleton.pointer]
  // const display = getDisplay(containerWidth)
  let layout: CompObject
  if (isSwitch(normalizedLayout)) {
    layout = normalizedLayout.find(compObject => {
      if (!compObject.if) return true
      const compiledExpression = compiledLayout.expressions[compObject.if.type][compObject.if.expr]
      return !!compiledExpression(mode, display)
    }) ?? nodeCompObject
  } else {
    layout = normalizedLayout
  }
  // const fullKey = parentKey === null ? skeleton.key : (parentKey + '/' + skeleton.key)

  let children: StateNode[] | undefined
  if (layout.comp === 'section') {
    value = value ?? {}
    // TODO: make this type casting safe using prior validation
    const objectValue = (value ?? {}) as Record<string, unknown>
    children = skeleton.children?.map((child, i) => {
      return createStateNode(
        context,
        compiledLayout,
        fullKey + '/' + child.key,
        fullKey,
        child,
        mode,
        display,
        objectValue[child.key], reusedNode?.children?.[i]
      )
    }).filter(child => child?.layout.comp !== 'none')
  }

  if (layout.comp === 'text-field') {
    value = value ?? ''
  }

  const error = context.errors?.find(error => matchError(error, skeleton)) ?? context.errors?.find(error => matchChildError(error, skeleton))

  // capture errors so that they are not repeated in parent nodes
  if (error) context.errors = context.errors?.filter(error => !matchError(error, skeleton) && !matchChildError(error, skeleton))
  const node = produceStateNode(
    reusedNode ?? ({} as StateNode),
    fullKey,
    parentFullKey,
    skeleton,
    layout,
    mode,
    value,
    error?.message,
    shallowCompareArrays(reusedNode?.children, children)
  )
  context.nodes.push(node)
  return node
}

export const produceStateNodeValue = produce<any, [StateNode, StateNode, unknown]>(
  (draft, parentNode, node, value) => {
    if (parentNode.skeleton.dataPath === node.skeleton.dataPath) {
      Object.assign(draft, value)
    } else {
      draft[node.skeleton.key] = value
    }
  }
)
