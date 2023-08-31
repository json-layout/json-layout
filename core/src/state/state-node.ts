// import { type Emitter } from 'mitt'
import { type SkeletonNode, type CompiledLayout, type CompiledExpression } from '../compile'
import { type StatefulLayoutOptions, type Mode } from '..'
// import { getDisplay } from '../utils'
import { type CompObject, isSwitch, type Expression, type Cols, type NodeOptions } from '@json-layout/vocabulary'
import produce from 'immer'
import { type ErrorObject } from 'ajv'
import { getChildDisplay, type Display } from './utils/display'
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
  width: number
  cols: Cols
  data: unknown
  error: string | undefined
  options: NodeOptions
  children?: StateNode[]
}

const isDataEmpty = (data: unknown) => {
  if (data === '') return true
  if (Array.isArray(data) && !data.length) return true
  if (typeof data === 'object' && !!data && Object.values(data).findIndex(prop => !isDataEmpty(prop)) === -1) return true
  return false
}

// use Immer for efficient updating with immutability and no-op detection
const produceStateNode = produce<StateNode, [string | number, string, string | null, string, string | null, SkeletonNode, CompObject, Mode, number, number, unknown, string | undefined, NodeOptions, StateNode[]?]>(
  (draft, key, fullKey, parentFullKey, dataPath, parentDataPath, skeleton, layout, mode, width, cols, data, error, options, children?) => {
    data = children ? produceStateNodeData((data ?? {}) as Record<string, unknown>, dataPath, children) : data
    // empty data is removed and replaced by the default data
    if (isDataEmpty(data) && skeleton.defaultData === undefined) data = undefined
    data = data ?? skeleton.defaultData

    draft.key = key
    draft.fullKey = fullKey
    draft.parentFullKey = parentFullKey
    draft.dataPath = dataPath
    draft.parentDataPath = parentDataPath
    draft.skeleton = skeleton
    draft.layout = layout
    draft.mode = mode
    draft.width = width
    draft.cols = cols
    draft.data = data
    draft.error = error
    draft.options = options
    draft.children = children
  }
)

const produceStateNodeData = produce<Record<string, unknown>, [string, StateNode[]]>((draft, parentDataPath, children) => {
  for (const child of children) {
    if (parentDataPath === child.dataPath) {
      if (child.data === undefined) continue
      Object.assign(draft, child.data)
    } else {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      if (child.data === undefined) delete draft[child.key]
      else draft[child.key] = child.data
    }
  }
})

const produceNodeOptions = produce<NodeOptions, [NodeOptions, NodeOptions]>((draft, parentNodeOptions, nodeOptions) => {
  for (const key in parentNodeOptions) {
    draft[key] = parentNodeOptions[key]
  }
  for (const key in nodeOptions) {
    draft[key] = nodeOptions[key]
  }
  for (const key in draft) {
    if (!(key in parentNodeOptions) && !(key in nodeOptions)) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete draft[key]
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

export function evalExpression (expressions: CompiledExpression[], expression: Expression, data: any, context: Record<string, any>, mode: Mode, display: Display): any {
  if (expression.ref === undefined) throw new Error('expression was not compiled : ' + JSON.stringify(expression))
  const compiledExpression = expressions[expression.ref]
  // console.log(expression.expr, context, mode, display)
  return compiledExpression(data, context, mode, display)
}

export function createStateNode (
  context: CreateStateTreeContext,
  options: StatefulLayoutOptions,
  compiledLayout: CompiledLayout,
  key: string | number,
  fullKey: string,
  parentFullKey: string | null,
  dataPath: string,
  parentDataPath: string | null,
  skeleton: SkeletonNode,
  contextualLayout: CompObject | null,
  mode: Mode,
  parentDisplay: Display,
  data: unknown,
  parentNodeOptions: NodeOptions,
  reusedNode?: StateNode
): StateNode {
  const normalizedLayout = contextualLayout ?? compiledLayout.normalizedLayouts[skeleton.pointer]
  let layout: CompObject
  if (isSwitch(normalizedLayout)) {
    layout = normalizedLayout.switch.find(compObject => {
      if (!compObject.if) return true
      return !!evalExpression(compiledLayout.expressions, compObject.if, data, options.context, mode, parentDisplay)
    }) ?? nodeCompObject
  } else {
    layout = normalizedLayout
  }

  const [display, col] = getChildDisplay(parentDisplay, contextualLayout?.cols ?? layout.cols)

  const nodeOptions = layout.options ? produceNodeOptions(reusedNode?.options ?? {}, parentNodeOptions, layout.options) : parentNodeOptions

  let children: StateNode[] | undefined
  if (layout.comp === 'section') {
    // TODO: make this type casting safe using prior validation
    const objectData = (data ?? {}) as Record<string, unknown>
    children = layout.children.map((child, i) => {
      const childSkeleton = skeleton.children?.find(c => c.key === child.key) ?? skeleton
      const isSameData = typeof child.key === 'string' && child.key.startsWith('$')
      return createStateNode(
        context,
        options,
        compiledLayout,
        child.key,
        `${fullKey}/${child.key}`,
        fullKey,
        isSameData ? dataPath : `${dataPath}/${child.key}`,
        dataPath,
        childSkeleton,
        child.comp ? (child as unknown as CompObject) : null,
        mode,
        display,
        isSameData ? objectData : objectData[child.key],
        nodeOptions,
        reusedNode?.children?.[i]
      )
    })
  }

  if (layout.comp === 'list') {
    const arrayData = (data ?? []) as unknown[]
    const childSkeleton = skeleton?.childrenTrees?.[0]?.root as SkeletonNode
    children = arrayData.map((itemData, i) => {
      return createStateNode(
        context,
        options,
        compiledLayout,
        i,
        `${fullKey}/${i}`,
        fullKey,
        `${dataPath}/${i}`,
        dataPath,
        childSkeleton,
        null,
        mode,
        display,
        itemData,
        nodeOptions,
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
    display.width,
    col,
    data,
    error?.message,
    nodeOptions,
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
