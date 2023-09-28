import { isSwitchStruct, childIsCompObject, isCompositeLayout } from '@json-layout/vocabulary'
import { produce } from 'immer'
import { getChildDisplay } from './utils/display.js'
import { shallowCompareArrays } from './utils/immutable.js'

/**
 * @param {unknown} data
 * @returns {boolean}
 */
const isDataEmpty = (data) => {
  if (data === '') return true
  if (Array.isArray(data) && !data.length) return true
  if (typeof data === 'object' && !Array.isArray(data) && !!data && Object.values(data).findIndex(prop => !isDataEmpty(prop)) === -1) return true
  return false
}

// use Immer for efficient updating with immutability and no-op detection
/** @type {(draft: import('./types.js').StateNode, key: string | number, fullKey: string, parentFullKey: string | null, dataPath: string, parentDataPath: string | null, skeleton: import('../index.js').SkeletonNode, layout: import('@json-layout/vocabulary').CompObject, cols: number, data: unknown, error: string | undefined, options: import('./types.js').StatefulLayoutOptions, children: import('../index.js').StateNode[] | undefined) => import('../index.js').StateNode} */
const produceStateNode = produce((draft, key, fullKey, parentFullKey, dataPath, parentDataPath, skeleton, layout, cols, data, error, options, children) => {
  data = children && layout.comp !== 'list' ? produceStateNodeData(/** @type {Record<string, unknown>} */(data ?? {}), dataPath, children) : data
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
  draft.options = options
  draft.cols = cols
  draft.data = data
  draft.error = error
  draft.children = children
}
)

/** @type {(draft: Record<string, unknown>, parentDataPath: string, children: import('../index.js').StateNode[]) => Record<string, unknown>} */
const produceStateNodeData = produce((draft, parentDataPath, children) => {
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

/** @type {(draft: import('./types.js').StatefulLayoutOptions, parentNodeOptions: import('./types.js').StatefulLayoutOptions, nodeOptions: import('@json-layout/vocabulary').StateNodeOptions | undefined, width: number) => import('./types.js').StatefulLayoutOptions} */
const produceNodeOptions = produce((draft, parentNodeOptions, nodeOptions = {}, width) => {
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
  draft.width = width
})

/** @type {(draft: import('./types.js').StatefulLayoutOptions) => import('./types.js').StatefulLayoutOptions} */
const produceReadonlyArrayItemOptions = produce((draft) => {
  draft.readOnly = true
  draft.summary = true
})

/** @type {(draft: import('./types.js').StatefulLayoutOptions, section: import('@json-layout/vocabulary').CompositeCompObject) => import('./types.js').StatefulLayoutOptions} */
const produceCompositeChildrenOptions = produce((draft, section) => {
  // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
  if (section.title && draft.titleDepth < 6) draft.titleDepth += 1
})

/**
 * @param {import('ajv').ErrorObject} error
 * @param {import('../index.js').SkeletonNode} skeleton
 * @param {string} dataPath
 * @param {string | null} parentDataPath
 * @returns {boolean}
 */
const matchError = (error, skeleton, dataPath, parentDataPath) => {
  const originalError = error.params?.errors?.[0] ?? error
  if (parentDataPath === originalError.instancePath && originalError.params?.missingProperty === skeleton.key) return true
  if (originalError.instancePath === dataPath && originalError.schemaPath === skeleton.pointer) return true
  return false
}

/**
 * @param {import('ajv').ErrorObject} error
 * @param {import('../index.js').SkeletonNode} skeleton
 * @param {string} dataPath
 * @returns {boolean}
 */
const matchChildError = (error, skeleton, dataPath) => {
  if (error.instancePath.startsWith(dataPath) && !(typeof skeleton.key === 'string' && skeleton.key.startsWith('$allOf'))) return true
  return false
}

/**
 * @param {import('../index.js').CompiledExpression[]} expressions
 * @param {import('@json-layout/vocabulary').Expression} expression
 * @param {any} data
 * @param {import('./types.js').StatefulLayoutOptions} options
 * @param {import('./utils/display.js').Display} display
 * @returns {any}
 */
export function evalExpression (expressions, expression, data, options, display) {
  if (expression.ref === undefined) throw new Error('expression was not compiled : ' + JSON.stringify(expression))
  const compiledExpression = expressions[expression.ref]
  // console.log(expression.expr, context, mode, display)
  return compiledExpression(data, options, display)
}

/**
 * @param {import('@json-layout/vocabulary').NormalizedLayout} normalizedLayout
 * @param {import('./types.js').StatefulLayoutOptions} options
 * @param {import('../index.js').CompiledLayout} compiledLayout
 * @param {import('./utils/display.js').Display} display
 * @param {unknown} data
 * @returns {import('@json-layout/vocabulary').CompObject}
 */
const getCompObject = (normalizedLayout, options, compiledLayout, display, data) => {
  if (isSwitchStruct(normalizedLayout)) {
    for (const compObject of normalizedLayout.switch) {
      if (!compObject.if || !!evalExpression(compiledLayout.expressions, compObject.if, data, options, display)) {
        return compObject
      }
    }
  } else {
    return normalizedLayout
  }
  throw new Error('no layout matched for node')
}

/**
 *
 * @param {import('./types.js').CreateStateTreeContext} context
 * @param {import('./types.js').StatefulLayoutOptions} parentOptions
 * @param {import('../index.js').CompiledLayout} compiledLayout
 * @param {string | number} key
 * @param {string} fullKey
 * @param {string | null} parentFullKey
 * @param {string} dataPath
 * @param {string | null} parentDataPath
 * @param {import('../index.js').SkeletonNode} skeleton
 * @param {import('@json-layout/vocabulary').Child | null} childDefinition
 * @param {import('./utils/display.js').Display} parentDisplay
 * @param {unknown} data
 * @param {import('./types.js').StateNode} [reusedNode]
 * @returns {import('./types.js').StateNode}
 */
export function createStateNode (
  context,
  parentOptions,
  compiledLayout,
  key,
  fullKey,
  parentFullKey,
  dataPath,
  parentDataPath,
  skeleton,
  childDefinition,
  parentDisplay,
  data,
  reusedNode
) {
  const normalizedLayout = childDefinition && childIsCompObject(childDefinition)
    ? childDefinition
    : compiledLayout.normalizedLayouts[skeleton.pointer]
  const layout = getCompObject(normalizedLayout, parentOptions, compiledLayout, parentDisplay, data)
  const [display, cols] = getChildDisplay(parentDisplay, childDefinition?.cols ?? layout.cols)

  const options = produceNodeOptions(
    reusedNode?.options ?? /** @type {import('./types.js').StatefulLayoutOptions} */({}),
    parentOptions,
    layout.options, display.width
  )

  /** @type {import('./types.js').StateNode[] | undefined} */
  let children
  if (isCompositeLayout(layout)) {
    // TODO: make this type casting safe using prior validation
    const objectData = /** @type {Record<string, unknown>} */(data ?? {})
    const childrenOptions = produceCompositeChildrenOptions(options, layout)
    children = layout.children.map((child, i) => {
      const childSkeleton = skeleton.children?.find(c => c.key === child.key) ?? skeleton
      const isSameData = typeof child.key === 'string' && child.key.startsWith('$')
      return createStateNode(
        context,
        childrenOptions,
        compiledLayout,
        child.key,
        `${fullKey}/${child.key}`,
        fullKey,
        isSameData ? dataPath : `${dataPath}/${child.key}`,
        dataPath,
        childSkeleton,
        child,
        display,
        isSameData ? objectData : objectData[child.key],
        reusedNode?.children?.[i]
      )
    })
  }

  if (layout.comp === 'list') {
    const arrayData = /** @type {unknown[]} */(data ?? [])
    const childSkeleton = /** @type {import('../index.js').SkeletonNode} */(skeleton?.childrenTrees?.[0]?.root)
    const listItemOptions = layout.listEditMode === 'inline' ? options : produceReadonlyArrayItemOptions(options)
    children = arrayData.map((itemData, i) => {
      return createStateNode(
        context,
        listItemOptions,
        compiledLayout,
        i,
        `${fullKey}/${i}`,
        fullKey,
        `${dataPath}/${i}`,
        dataPath,
        childSkeleton,
        null,
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
    reusedNode ?? /** @type {import('./types.js').StateNode} */({}),
    key,
    fullKey,
    parentFullKey,
    dataPath,
    parentDataPath,
    skeleton,
    layout,
    cols,
    data,
    error?.message,
    options,
    children && shallowCompareArrays(reusedNode?.children, children)
  )
  context.nodes.push(node)
  return node
}

/** @type {(draft: any, node: import('./types.js').StateNode, data: unknown) => any} */
export const producePatchedData = produce((draft, node, data) => {
  if (node.dataPath === node.parentDataPath) {
    Object.assign(draft, data)
  } else {
    draft[node.key] = data
  }
}
)
