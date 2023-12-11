import { isSwitchStruct, childIsCompObject, isCompositeLayout, isFocusableLayout } from '@json-layout/vocabulary'
import { produce } from 'immer'
import { getChildDisplay } from './utils/display.js'
import { shallowCompareArrays } from './utils/immutable.js'

/**
 * @param {unknown} data
 * @returns {boolean}
 */
const isDataEmpty = (data) => {
  if (data === '' || data === undefined) return true
  if (Array.isArray(data) && !data.length) return true
  if (typeof data === 'object' && !Array.isArray(data) && !!data && Object.values(data).findIndex(prop => prop !== undefined) === -1) return true
  return false
}

/**
 * @param {unknown} data
 * @param {import('@json-layout/vocabulary').CompObject} layout
 * @param {import('./types.js').StateNodeOptions} options
 * @returns {boolean}
 */
const useDefaultData = (data, layout, options) => {
  if (options.defaultOn === 'missing' && data === undefined) return true
  if (options.defaultOn === 'empty' && isDataEmpty(data)) return true
  return false
}

// use Immer for efficient updating with immutability and no-op detection
/** @type {(draft: import('./types.js').StateNode, key: string | number, fullKey: string, parentFullKey: string | null, dataPath: string, parentDataPath: string | null, skeleton: import('../index.js').SkeletonNode, layout: import('@json-layout/vocabulary').CompObject, width: number, cols: number, data: unknown, error: string | undefined, validated: boolean, options: import('./types.js').StateNodeOptions, autofocus: boolean, children: import('../index.js').StateNode[] | undefined) => import('../index.js').StateNode} */
const produceStateNode = produce((draft, key, fullKey, parentFullKey, dataPath, parentDataPath, skeleton, layout, width, cols, data, error, validated, options, autofocus, children) => {
  draft.messages = layout.messages ? produceStateNodeMessages(draft.messages || {}, layout.messages, options) : options.messages

  draft.key = key
  draft.fullKey = fullKey
  draft.parentFullKey = parentFullKey
  draft.dataPath = dataPath
  draft.parentDataPath = parentDataPath
  draft.skeleton = skeleton
  draft.layout = layout
  draft.width = width
  draft.options = options
  draft.cols = cols
  draft.data = data
  draft.error = error
  draft.childError = children && (children.findIndex(c => c.error || c.childError) !== -1)
  draft.validated = validated
  if (autofocus) {
    draft.autofocus = true
    delete draft.autofocusChild
  } else {
    delete draft.autofocus
    const autofocusChild = children?.find(c => c.autofocus)
    if (autofocusChild) draft.autofocusChild = autofocusChild.key
    else delete draft.autofocusChild
  }

  draft.children = children
})

/** @type {(draft: import('../i18n/types.js').LocaleMessages, layoutMessages: Partial<import('../i18n/types.js').LocaleMessages>, options: import('./types.js').StateNodeOptions) => import('../i18n/types.js').LocaleMessages} */
const produceStateNodeMessages = produce((draft, layoutMessages, options) => {
  Object.assign(draft, options.messages, layoutMessages)
})

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

/** @type {(draft: import('./types.js').StateNodeOptions, parentNodeOptions: import('./types.js').StateNodeOptions, nodeOptions: Partial<import('./types.js').StateNodeOptions> | undefined) => import('./types.js').StateNodeOptions} */
const produceNodeOptions = produce((draft, parentNodeOptions, nodeOptions = {}) => {
  for (const key in parentNodeOptions) {
    draft[key] = nodeOptions[key] ?? parentNodeOptions[key]
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

/** @type {(draft: import('./types.js').StateNodeOptions) => import('./types.js').StateNodeOptions} */
const produceReadonlyArrayItemOptions = produce((draft) => {
  draft.readOnly = true
  draft.summary = true
})

/** @type {(draft: import('./types.js').StateNodeOptions, section: import('@json-layout/vocabulary').CompositeCompObject) => import('./types.js').StateNodeOptions} */
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
 * @param {import('./types.js').StateNodeOptions} options
 * @param {import('./utils/display.js').Display} display
 * @returns {any}
 */
export function evalExpression (expressions, expression, data, options, display) {
  if (expression.ref === undefined) throw new Error('expression was not compiled : ' + JSON.stringify(expression))
  const compiledExpression = expressions[expression.ref]
  // console.log(expression.expr, context, mode, display)
  return compiledExpression(data, options, options.context, display)
}

/**
 * @param {import('@json-layout/vocabulary').NormalizedLayout} normalizedLayout
 * @param {import('./types.js').StateNodeOptions} options
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
 * @param {import('./types.js').StateNodeOptions} parentOptions
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
 * @param {import('./types.js').ValidationState} validationState
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
  validationState,
  reusedNode
) {
  const normalizedLayout = childDefinition && childIsCompObject(childDefinition)
    ? childDefinition
    : compiledLayout.normalizedLayouts[skeleton.pointer]
  const layout = getCompObject(normalizedLayout, parentOptions, compiledLayout, parentDisplay, data)
  const [display, cols] = getChildDisplay(parentDisplay, childDefinition?.cols ?? layout.cols)

  const options = layout.options
    ? produceNodeOptions(
      reusedNode?.options ?? /** @type {import('./types.js').StateNodeOptions} */({}),
      parentOptions,
      layout.options
    )
    : parentOptions

  if (context.initial && parentOptions.autofocus && layout.autofocus) {
    context.autofocusTarget = fullKey
  }

  /** @type {import('./types.js').StateNode[] | undefined} */
  let children
  if (isCompositeLayout(layout)) {
    // TODO: make this type casting safe using prior validation
    const objectData = /** @type {Record<string, unknown>} */(data ?? {})
    const childrenOptions = produceCompositeChildrenOptions(options, layout)
    children = []
    let focusChild = context.autofocusTarget === fullKey
    for (let i = 0; i < layout.children.length; i++) {
      const childLayout = layout.children[i]
      const childSkeleton = skeleton.children?.find(c => c.key === childLayout.key) ?? skeleton
      const isSameData = typeof childLayout.key === 'string' && childLayout.key.startsWith('$')
      const childFullKey = `${fullKey}/${childLayout.key}`
      if (focusChild) context.autofocusTarget = childFullKey
      const child = createStateNode(
        context,
        childrenOptions,
        compiledLayout,
        childLayout.key,
        childFullKey,
        fullKey,
        isSameData ? dataPath : `${dataPath}/${childLayout.key}`,
        dataPath,
        childSkeleton,
        childLayout,
        display,
        isSameData ? objectData : objectData[childLayout.key],
        validationState,
        reusedNode?.children?.[i]
      )
      if (child.autofocus || child.autofocusChild !== undefined) focusChild = false
      children.push(child)
    }
  }

  if (key === '$oneOf' && skeleton.childrenTrees) {
    // find the oneOf child that was either previously selected, if none were selected select the child that is valid with current data
    /** @type {number} */
    const activeChildTreeIndex = fullKey in context.activeItems ? context.activeItems[fullKey] : skeleton.childrenTrees?.findIndex((childTree) => compiledLayout.validates[childTree.root.pointer](data))
    if (activeChildTreeIndex !== -1) {
      context.activeItems[fullKey] = activeChildTreeIndex
      const activeChildKey = `${fullKey}/${activeChildTreeIndex}`
      if (context.autofocusTarget === fullKey) context.autofocusTarget = activeChildKey
      const activeChildTree = skeleton.childrenTrees[activeChildTreeIndex]
      children = [
        createStateNode(
          context,
          options,
          compiledLayout,
          activeChildTreeIndex,
          activeChildKey,
          fullKey,
          dataPath,
          dataPath,
          activeChildTree.root,
          null,
          display,
          data,
          validationState,
          reusedNode?.children?.[0]
        )
      ]
    }
  }

  if (layout.comp === 'list') {
    const arrayData = /** @type {unknown[]} */(data ?? [])
    const childSkeleton = /** @type {import('../index.js').SkeletonNode} */(skeleton?.childrenTrees?.[0]?.root)
    const listItemOptions = layout.listEditMode === 'inline' ? options : produceReadonlyArrayItemOptions(options)
    children = []
    let focusChild = context.autofocusTarget === fullKey
    for (let i = 0; i < arrayData.length; i++) {
      const itemData = arrayData[i]
      const childFullKey = `${fullKey}/${i}`
      if (focusChild) context.autofocusTarget = childFullKey
      const child = createStateNode(
        context,
        (layout.listEditMode === 'inline-single' && context.activeItems[fullKey] === i) ? options : listItemOptions,
        compiledLayout,
        i,
        childFullKey,
        fullKey,
        `${dataPath}/${i}`,
        dataPath,
        childSkeleton,
        null,
        display,
        itemData,
        validationState,
        reusedNode?.children?.[0]
      )
      if (child.autofocus || child.autofocusChild !== undefined) focusChild = false
      children.push(child)
    }
  }

  const error = context.errors?.find(error => matchError(error, skeleton, dataPath, parentDataPath)) ?? context.errors?.find(error => matchChildError(error, skeleton, dataPath))
  // capture errors so that they are not repeated in parent nodes
  if (layout.comp !== 'none') {
    if (error) context.errors = context.errors?.filter(error => !matchError(error, skeleton, dataPath, parentDataPath) && !matchChildError(error, skeleton, dataPath))
  }
  const validated = validationState.validatedForm ||
    validationState.validatedChildren.includes(fullKey) ||
    (validationState.initialized === false && options.initialValidation === 'always') ||
    (validationState.initialized === false && options.initialValidation === 'withData' && !isDataEmpty(data))

  let nodeData = children ? produceStateNodeData(/** @type {Record<string, unknown>} */(data ?? {}), dataPath, children) : data
  if (layout.constData) {
    nodeData = evalExpression(compiledLayout.expressions, layout.constData, nodeData, options, display)
  } else {
    if (layout.defaultData && useDefaultData(nodeData, layout, options)) {
      nodeData = evalExpression(compiledLayout.expressions, layout.defaultData, nodeData, options, display)
    } else {
      if (isDataEmpty(nodeData)) {
        if (layout.nullable) {
          // if a property is nullable empty values are converted to null
          // except for undefined if we need to distinguish between empty and missing data
          if (options.defaultOn !== 'missing' || nodeData !== undefined) {
            nodeData = null
          }
        } else if (options.defaultOn !== 'missing') {
          // remove empty data, except if we need to distinguish between empty and missing data
          nodeData = undefined
        }
      }
    }
  }

  const autofocus = isFocusableLayout(layout) && !options.readOnly && !options.summary && context.autofocusTarget === fullKey
  const node = produceStateNode(
    reusedNode ?? /** @type {import('./types.js').StateNode} */({}),
    key,
    fullKey,
    parentFullKey,
    dataPath,
    parentDataPath,
    skeleton,
    layout,
    display.width,
    cols,
    nodeData,
    error?.message,
    validated,
    options,
    autofocus,
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
})
