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
  key: string | number
  fullKey: string
  parentFullKey: string | null
  dataPath: string
  parentDataPath: string | null
  skeleton: SkeletonNode
  layout: CompObject
  mode: Mode
  data: unknown
  error: string | undefined
  children?: StateNode[]
}

// use Immer for efficient updating with immutability and no-op detection
const produceStateNode = produce<StateNode, [string | number, string, string | null, string, string | null, SkeletonNode, CompObject, Mode, unknown, string | undefined, StateNode[]?]>(
  (draft, key, fullKey, parentFullKey, dataPath, parentDataPath, skeleton, layout, mode, data, error, children?) => {
    draft.key = key
    draft.fullKey = fullKey
    draft.parentFullKey = parentFullKey
    draft.dataPath = dataPath
    draft.parentDataPath = parentDataPath
    draft.skeleton = skeleton
    draft.layout = layout
    draft.mode = mode
    draft.data = children ? produceStateNodeData((data ?? {}) as Record<string, unknown>, dataPath, children) : data
    draft.error = error
    draft.children = children
  }
)

const produceStateNodeData = produce<Record<string, unknown>, [string, StateNode[]]>((draft, parentDataPath, children) => {
  for (const child of children) {
    if (child.data === undefined) continue
    if (parentDataPath === child.dataPath) {
      Object.assign(draft, child.data)
    } else {
      draft[child.key] = child.data
    }
  }
})

const nodeCompObject: CompObject = { comp: 'none' }

const matchError = (error: ErrorObject, skeleton: SkeletonNode, dataPath: string, parentDataPath: string | null): boolean => {
  const originalError = error.params?.errors?.[0] ?? error
  if (parentDataPath === originalError.instancePath && originalError.params?.missingProperty === skeleton.key) return true
  if (originalError.instancePath === dataPath && originalError.schemaPath === skeleton.pointer) return true
  return false
}
const matchChildError = (error: ErrorObject, skeleton: SkeletonNode, dataPath: string): boolean => {
  if (error.instancePath.startsWith(dataPath) && !(typeof skeleton.key === 'string' && skeleton.key.startsWith('$allOf'))) return true
  return false
}

export function createStateNode (
  context: CreateStateTreeContext,
  compiledLayout: CompiledLayout,
  key: string | number,
  fullKey: string,
  parentFullKey: string | null,
  dataPath: string,
  parentDataPath: string | null,
  skeleton: SkeletonNode,
  mode: Mode,
  display: Display,
  data: unknown,
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

  data = data ?? skeleton.defaultData

  let children: StateNode[] | undefined
  if (layout.comp === 'section') {
    // TODO: make this type casting safe using prior validation
    const objectData = (data ?? {}) as Record<string, unknown>
    children = skeleton.children?.map((child, i) => {
      const isSameData = typeof child.key === 'string' && child.key.startsWith('$')
      return createStateNode(
        context,
        compiledLayout,
        child.key,
        `${fullKey}/${child.key}`,
        fullKey,
        isSameData ? dataPath : `${dataPath}/${child.key}`,
        dataPath,
        child,
        mode,
        display,
        isSameData ? objectData : objectData[child.key],
        reusedNode?.children?.[i]
      )
    })
  }

  if (layout.comp === 'list') {
    const arrayData = (data ?? []) as unknown[]
    const childSkeletonNode = skeleton?.childrenTrees?.[0]?.root as SkeletonNode
    children = arrayData.map((itemData, i) => {
      return createStateNode(
        context,
        compiledLayout,
        i,
        `${fullKey}/${i}`,
        fullKey,
        `${dataPath}/${i}`,
        dataPath,
        childSkeletonNode,
        mode,
        display,
        itemData,
        reusedNode?.children?.[0]
      )
    })
  }

  const error = context.errors?.find(error => matchError(error, skeleton, dataPath, parentDataPath)) ?? context.errors?.find(error => matchChildError(error, skeleton, dataPath))
  // capture errors so that they are not repeated in parent nodes
  if (layout.comp !== 'none') {
    if (error) context.errors = context.errors?.filter(error => !matchError(error, skeleton, dataPath, parentDataPath) && !matchChildError(error, skeleton, dataPath))
  }

  const node = produceStateNode(
    reusedNode ?? ({} as StateNode),
    key,
    fullKey,
    parentFullKey,
    dataPath,
    parentDataPath,
    skeleton,
    layout,
    mode,
    data,
    error?.message,
    shallowCompareArrays(reusedNode?.children, children)
  )
  context.nodes.push(node)
  return node
}

export const producePatchedData = produce<any, [StateNode, unknown]>(
  (draft, node, data) => {
    if (node.dataPath === node.parentDataPath) {
      Object.assign(draft, data)
    } else {
      draft[node.key] = data
    }
  }
)
