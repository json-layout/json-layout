import { isSwitchStruct, childIsCompObject, isCompositeLayout, isFocusableLayout, isItemsLayout, isGetItemsExpression, isGetItemsFetch } from '@json-layout/vocabulary'
import { produce } from 'immer'
import debug from 'debug'
import { getChildDisplay } from './utils/display.js'
import { shallowEqualArray, shallowProduceArray, shallowProduceObject } from './utils/immutable.js'

const logStateNode = debug('jl:state-node')

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
 * @param {import('@json-layout/vocabulary').BaseCompObject} layout
 * @param {import('./types.js').StateNodeOptions} options
 * @returns {boolean}
 */
const useDefaultData = (data, layout, options) => {
  if (options.defaultOn === 'missing' && data === undefined) return true
  if (options.defaultOn === 'empty' && isDataEmpty(data)) return true
  return false
}

// use Immer for efficient updating with immutability and no-op detection
/** @type {(draft: import('./types.js').StateNode, key: string | number, fullKey: string, parentFullKey: string | null, dataPath: string, parentDataPath: string | null, skeleton: import('../index.js').SkeletonNode, layout: import('@json-layout/vocabulary').BaseCompObject, width: number, cols: number, data: unknown, error: string | undefined, validated: boolean, options: import('./types.js').StateNodeOptions, autofocus: boolean, props: import('@json-layout/vocabulary').StateNodePropsLib, itemsCacheKey: any, children: import('../index.js').StateNode[] | undefined) => import('../index.js').StateNode} */
const produceStateNode = produce((draft, key, fullKey, parentFullKey, dataPath, parentDataPath, skeleton, layout, width, cols, data, error, validated, options, autofocus, props, itemsCacheKey, children) => {
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
  draft.itemsCacheKey = itemsCacheKey
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
  draft.props = props

  draft.children = children
})

/** @type {(draft: import('../i18n/types.js').LocaleMessages, layoutMessages: Partial<import('../i18n/types.js').LocaleMessages>, options: import('./types.js').StateNodeOptions) => import('../i18n/types.js').LocaleMessages} */
const produceStateNodeMessages = produce((draft, layoutMessages, options) => {
  Object.assign(draft, options.messages, layoutMessages)
})

/** @type {(draft: Record<string, unknown>, parentDataPath: string, children?: import('../index.js').StateNode[], additionalPropertiesErrors?: import('ajv').ErrorObject[], propertyKeys?: string[], removePropertyKeys?: string[]) => Record<string, unknown>} */
const produceStateNodeData = produce((draft, parentDataPath, children, additionalPropertiesErrors, propertyKeys, removePropertyKeys) => {
  if (propertyKeys && (propertyKeys.length || children?.length)) {
    for (const key of Object.keys(draft)) {
      if (!propertyKeys.includes(key)) delete draft[key]
    }
  }
  if (removePropertyKeys) {
    for (const key of removePropertyKeys) {
      delete draft[key]
    }
  }
  if (children) {
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
    if (Array.isArray(draft)) {
      // remove trailing undefined values from tuples
      while (draft.length && draft[draft.length - 1] === undefined) {
        draft.pop()
      }
    }
  }

  if (additionalPropertiesErrors) {
    for (const error of additionalPropertiesErrors) {
      if (error.instancePath !== parentDataPath) continue
      if (error.keyword === 'additionalProperties') {
        delete draft[error.params.additionalProperty]
      }
      if (error.keyword === 'unevaluatedProperties') {
        delete draft[error.params.unevaluatedProperty]
      }
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
 * should match if an error belongs to this exact node
 * @param {import('ajv').ErrorObject} error
 * @param {import('../index.js').SkeletonNode} skeleton
 * @param {string} dataPath
 * @param {string | null} parentDataPath
 * @returns {boolean}
 */
const matchError = (error, skeleton, dataPath, parentDataPath) => {
  const originalError = error.params?.errors?.[0] ?? error
  if (parentDataPath === originalError.instancePath && originalError.params?.missingProperty === skeleton.key) return true
  if (originalError.instancePath === dataPath && (originalError.schemaPath === skeleton.pointer || originalError.schemaPath === skeleton.refPointer)) return true
  return false
}

/**
 * should match if an error belongs to a child of the current node but the child was not displayed
 * @param {import('ajv').ErrorObject} error
 * @param {import('../index.js').SkeletonNode} skeleton
 * @param {string} dataPath
 * @param {string | null} parentDataPath
 * @returns {boolean}
 */
const matchChildError = (error, skeleton, dataPath, parentDataPath) => {
  const originalError = error.params?.errors?.[0] ?? error
  if (!(
    originalError.schemaPath === skeleton.pointer ||
    originalError.schemaPath.startsWith(skeleton.pointer + '/')
  ) && !(
    originalError.schemaPath === skeleton.refPointer ||
    originalError.schemaPath.startsWith(skeleton.refPointer + '/')
  )) return false
  if (originalError.instancePath.startsWith(dataPath)) return true
  return false
}

/**
 * @param {import('../index.js').CompiledExpression[]} expressions
 * @param {import('@json-layout/vocabulary').Expression} expression
 * @param {any} data
 * @param {import('./types.js').StateNodeOptions} options
 * @param {import('./utils/display.js').Display} display
 * @param {import('@json-layout/vocabulary').BaseCompObject} layout
 * @param {Record<string, import('ajv').ValidateFunction>} validates
 * @param {unknown} rootData
 * @param {import('../compile/types.js').ParentContextExpression | null} parentContext
 * @returns {any}
 */
export function evalExpression (expressions, expression, data, options, display, layout, validates, rootData, parentContext) {
  if (expression.ref === undefined) throw new Error('expression was not compiled : ' + JSON.stringify(expression))
  const compiledExpression = expressions[expression.ref]
  try {
    if (expression.pure) {
      return compiledExpression(data, options, options.context, display, layout, validates)
    } else {
      return compiledExpression(data, options, options.context, display, layout, validates, rootData, parentContext)
    }
  } catch (err) {
    console.warn('json-layout: failed to evaluate expression', err, { expression, data, context: options.context, display, rootData, parent: parentContext })
    throw new Error('json-layout: failed to evaluate expression')
  }
}

/**
 * @param {import('@json-layout/vocabulary').NormalizedLayout} normalizedLayout
 * @param {import('./types.js').StateNodeOptions} options
 * @param {import('../index.js').CompiledLayout} compiledLayout
 * @param {import('./utils/display.js').Display} display
 * @param {unknown} data
 * @param {unknown} rootData
 * @param {import('../compile/types.js').ParentContextExpression | null} parentContext
 * @returns {import('@json-layout/vocabulary').BaseCompObject}
 */
const getCompObject = (normalizedLayout, options, compiledLayout, display, data, rootData, parentContext) => {
  if (isSwitchStruct(normalizedLayout)) {
    for (const compObject of normalizedLayout.switch) {
      if (!compObject.if || !!evalExpression(compiledLayout.expressions, compObject.if, data, options, display, compObject, compiledLayout.validates, rootData, parentContext)) {
        return compObject
      }
    }
  } else {
    if (normalizedLayout.if) {
      if (evalExpression(compiledLayout.expressions, normalizedLayout.if, data, options, display, normalizedLayout, compiledLayout.validates, rootData, parentContext)) {
        return normalizedLayout
      }
    } else {
      return normalizedLayout
    }
  }
  return { comp: 'none' }
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
 * @param {import('../compile/types.js').ParentContextExpression | null} parentContext
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
  parentContext,
  validationState,
  reusedNode
) {
  logStateNode('createStateNode', fullKey)

  /** @type {import('./types.js').StateNodeCacheKey | null} */
  let cacheKey = null

  // NOTE we have to exclude nodes with errors from the cache, because context.errors is unpurely modified
  // TODO: implement a cleaner way to filter context.errors while being able to reuse nodes with errors
  if (skeleton.pure && !reusedNode?.error && !reusedNode?.childError) {
    const validatedCacheKey = validationState.validatedForm || validationState.validatedChildren.includes(fullKey)
    cacheKey = [parentOptions, compiledLayout, fullKey, skeleton, childDefinition, parentDisplay.width, validatedCacheKey, context.activatedItems, context.initial, data]
    if (reusedNode && context.cacheKeys[fullKey] && shallowEqualArray(context.cacheKeys[fullKey], cacheKey)) {
      logStateNode('createStateNode cache hit', fullKey)
      // @ts-ignore
      if (context._debugCache) context._debugCache[fullKey] = (context._debugCache[fullKey] ?? []).concat(['hit'])
      return reusedNode
    } else {
      logStateNode('createStateNode cache miss', fullKey)
      // @ts-ignore
      if (context._debugCache) context._debugCache[fullKey] = (context._debugCache[fullKey] ?? []).concat(['miss'])
    }
  } else {
    logStateNode('createStateNode cache skip', fullKey)
    // @ts-ignore
    if (context._debugCache) context._debugCache[fullKey] = (context._debugCache[fullKey] ?? []).concat(['skip'])
  }

  const normalizedLayout = childDefinition && childIsCompObject(childDefinition)
    ? childDefinition
    : compiledLayout.normalizedLayouts[skeleton.pointer]
  const layout = getCompObject(normalizedLayout, parentOptions, compiledLayout, parentDisplay, data, context.rootData, parentContext)
  const [display, cols] = getChildDisplay(parentDisplay, childDefinition?.cols ?? layout.cols)

  const options = layout.getOptions
    ? produceNodeOptions(
      reusedNode?.options ?? /** @type {import('./types.js').StateNodeOptions} */({}),
      parentOptions,
      evalExpression(compiledLayout.expressions, layout.getOptions, data, parentOptions, display, layout, compiledLayout.validates, context.rootData, parentContext)
    )
    : parentOptions

  if (context.initial && parentOptions.autofocus && layout.autofocus && layout.comp !== 'none') {
    context.autofocusTarget = fullKey
  }

  /** @type {import('./types.js').StateNode[] | undefined} */
  let children
  if (isCompositeLayout(layout, compiledLayout.components)) {
    // TODO: make this type casting safe using prior validation
    const objectData = /** @type {Record<string, unknown>} */(data ?? {})
    const childrenOptions = produceCompositeChildrenOptions(options, layout)
    children = []
    let focusChild = context.autofocusTarget === fullKey
    for (let i = 0; i < layout.children.length; i++) {
      const childLayout = layout.children[i]
      if (
        ['remove', 'hide'].includes(options.readOnlyPropertiesMode) &&
        skeleton.roPropertyKeys?.includes(/** @type {string} */(childLayout.key))
      ) continue
      let childSkeleton = skeleton
      const childSkeletonKey = skeleton.children?.find(c => compiledLayout.skeletonNodes[c].key === childLayout.key)
      if (childSkeletonKey !== undefined) childSkeleton = compiledLayout.skeletonNodes[childSkeletonKey]
      if (childSkeleton.condition) {
        if (!evalExpression(compiledLayout.expressions, childSkeleton.condition, objectData, parentOptions, display, layout, compiledLayout.validates, context.rootData, parentContext)) {
          continue
        }
      }
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
        { parent: parentContext, data: objectData },
        validationState,
        reusedNode?.children?.find(c => c.fullKey === childFullKey)
      )
      if (child.autofocus || child.autofocusChild !== undefined) focusChild = false
      children.push(child)
    }
  }

  if (key === '$oneOf' && skeleton.childrenTrees) {
    // find the oneOf child that was either previously selected, if none were selected select the child that is valid with current data
    /** @type {number} */
    const activeChildTreeIndex = fullKey in context.activatedItems ? context.activatedItems[fullKey] : skeleton.childrenTrees?.findIndex((childTree) => compiledLayout.validates[compiledLayout.skeletonTrees[childTree].root](data))
    if (activeChildTreeIndex !== -1) {
      context.errors = context.errors?.filter(error => {
        const originalError = error.params?.errors?.[0] ?? error
        // console.log(originalError.schemaPath, skeleton.pointer, skeleton.refPointer)
        // if an item was selected, remove the oneOf error
        if (matchError(error, skeleton, dataPath, parentDataPath)) return false
        // also remove the errors from other children of the oneOf
        if (matchChildError(error, skeleton, dataPath, parentDataPath)) {
          if (originalError.schemaPath.startsWith(skeleton.pointer) && !originalError.schemaPath.startsWith(skeleton.pointer + '/' + activeChildTreeIndex)) return false
          if (originalError.schemaPath.startsWith(skeleton.refPointer) && !originalError.schemaPath.startsWith(skeleton.refPointer + '/' + activeChildTreeIndex)) return false
        }
        return true
      })
      // console.log(context.errors?.map(error => error.params?.errors?.[0] ?? error))
      const activeChildKey = `${fullKey}/${activeChildTreeIndex}`
      if (context.autofocusTarget === fullKey) context.autofocusTarget = activeChildKey
      const activeChildTree = compiledLayout.skeletonTrees[skeleton.childrenTrees[activeChildTreeIndex]]
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
          compiledLayout.skeletonNodes[activeChildTree.root],
          null,
          display,
          data,
          { parent: parentContext, data },
          validationState,
          reusedNode?.children?.[0]
        )
      ]
    }
  }

  if (layout.comp === 'list') {
    const arrayData = /** @type {unknown[]} */(data ?? [])
    const childSkeleton = /** @type {import('../index.js').SkeletonNode} */(skeleton?.childrenTrees?.[0] && compiledLayout.skeletonNodes[compiledLayout.skeletonTrees[skeleton?.childrenTrees?.[0]]?.root])
    const listItemOptions = layout.listEditMode === 'inline' ? options : produceReadonlyArrayItemOptions(options)
    children = []
    let focusChild = context.autofocusTarget === fullKey
    for (let i = 0; i < arrayData.length; i++) {
      const itemData = arrayData[i]
      const childFullKey = `${fullKey}/${i}`
      if (focusChild) context.autofocusTarget = childFullKey
      const child = createStateNode(
        context,
        (layout.listEditMode === 'inline-single' && context.activatedItems[fullKey] === i) ? options : listItemOptions,
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
        { parent: parentContext, data: arrayData },
        validationState,
        reusedNode?.children?.[i]
      )
      if (child.autofocus || child.autofocusChild !== undefined) focusChild = false
      children.push(child)
    }
  }

  let error = context.errors?.find(error => matchError(error, skeleton, dataPath, parentDataPath))
  if (!error) {
    // findLast here is important because we want to keep the error of the highest child (deepest errors are listed first)
    error = context.errors?.findLast(error => matchChildError(error, skeleton, dataPath, parentDataPath))
  }

  // capture errors so that they are not repeated in parent nodes
  if (layout.comp !== 'none') {
    if (error) {
      context.errors = context.errors?.filter(error => {
        return !matchError(error, skeleton, dataPath, parentDataPath) && !matchChildError(error, skeleton, dataPath, parentDataPath)
      })
    }
  }

  let nodeData = data
  if (nodeData === null && !layout.nullable) nodeData = undefined

  const validated = validationState.validatedForm ||
    validationState.validatedChildren.includes(fullKey) ||
    (validationState.initialized === false && options.initialValidation === 'always') ||
    (validationState.initialized === false && options.initialValidation === 'withData' && !isDataEmpty(nodeData))

  /** @type {unknown} */
  if ((typeof nodeData === 'object' || (nodeData === undefined && children?.length)) && !(nodeData instanceof File)) {
    nodeData = produceStateNodeData(
      /** @type {Record<string, unknown>} */(nodeData ?? (typeof children?.[0]?.key === 'number' ? [] : {})),
      dataPath,
      children,
      context.additionalPropertiesErrors,
      [true, 'unknown'].includes(options.removeAdditional) ? skeleton.propertyKeys : undefined,
      options.readOnlyPropertiesMode === 'remove' ? skeleton.roPropertyKeys : undefined
    )

    // the producer is not perfect, sometimes data is considered mutated but it is actually the same
    // we double check here to avoid unnecessary re-renders
    if (nodeData !== data) {
      if (Array.isArray(data) && Array.isArray(nodeData)) nodeData = shallowProduceArray(data, nodeData)
      // @ts-ignore
      else if (typeof data === 'object' && typeof nodeData === 'object') nodeData = shallowProduceObject(data, nodeData)
    }
  }

  if (layout.getConstData) {
    if (!context.rehydrate) {
      nodeData = evalExpression(compiledLayout.expressions, layout.getConstData, nodeData, options, display, layout, compiledLayout.validates, context.rootData, parentContext)
    }
  } else {
    if (layout.getDefaultData && useDefaultData(nodeData, layout, options)) {
      if (!context.rehydrate) {
        const defaultData = evalExpression(compiledLayout.expressions, layout.getDefaultData, nodeData, options, display, layout, compiledLayout.validates, context.rootData, parentContext)
        if (nodeData === undefined || !isDataEmpty(defaultData)) {
          nodeData = defaultData
        }
      }
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

  let props
  if (layout.getProps) {
    props = evalExpression(compiledLayout.expressions, layout.getProps, nodeData, options, display, layout, compiledLayout.validates, context.rootData, parentContext)
  }

  /** @type {any} */
  let itemsCacheKey
  if (isItemsLayout(layout, compiledLayout.components)) {
    // prefetch items or preresolve url and store a key whose changes can be monitored to re-trigger actual fetch
    if (layout.items) itemsCacheKey = layout.items
    else if (layout.getItems?.immutable && reusedNode?.itemsCacheKey) itemsCacheKey = reusedNode.itemsCacheKey
    else if (layout.getItems && isGetItemsExpression(layout.getItems)) {
      if (layout.getItems.immutable && reusedNode?.itemsCacheKey) {
        itemsCacheKey = reusedNode.itemsCacheKey
      } else {
        try {
          itemsCacheKey = evalExpression(compiledLayout.expressions, layout.getItems, nodeData, options, display, layout, compiledLayout.validates, context.rootData, parentContext)
        } catch (err) {
          itemsCacheKey = null
        }
      }
    } else if (layout.getItems && isGetItemsFetch(layout.getItems)) {
      try {
        itemsCacheKey = evalExpression(compiledLayout.expressions, layout.getItems.url, null, options, display, layout, compiledLayout.validates, context.rootData, parentContext)
      } catch (err) {
        itemsCacheKey = null
      }
    }
  }

  const autofocus = isFocusableLayout(layout, compiledLayout.components) && !options.readOnly && !options.summary && context.autofocusTarget === fullKey
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
    props,
    itemsCacheKey,
    children && shallowProduceArray(reusedNode?.children, children)
  )

  if (cacheKey) context.cacheKeys[fullKey] = cacheKey

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
