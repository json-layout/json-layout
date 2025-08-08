import { isSwitchStruct, childIsCompositeCompObject, childIsSlotCompObject, isCompositeLayout, isFocusableLayout, isItemsLayout, isGetItemsExpression, isGetItemsFetch, isListLayout } from '@json-layout/vocabulary'
import { produce } from 'immer'
import debug from 'debug'
import { getChildDisplay } from './utils/display.js'
import { shallowEqualArray, shallowProduceArray, shallowProduceObject } from './utils/immutable.js'
import { getRegexp } from './utils/regexps.js'
import { pathURL } from './utils/urls.js'

const logStateNode = debug('jl:state-node')
const logValidation = debug('jl:validation')
const logGetItems = debug('jl:get-items')

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
export const useDefaultData = (data, layout, options) => {
  if (options.defaultOn === 'missing' && data === undefined) return true
  if (options.defaultOn === 'empty' && isDataEmpty(data)) return true
  return false
}

// use Immer for efficient updating with immutability and no-op detection
/** @type {(draft: import('./types.js').StateNode, key: string | number, fullKey: string, parentFullKey: string | null, dataPath: string, parentDataPath: string | null, skeleton: import('../index.js').SkeletonNode, layout: import('@json-layout/vocabulary').BaseCompObject, width: number, cols: number, data: unknown, error: string | undefined, validated: boolean, options: import('./types.js').StateNodeOptions, autofocus: boolean, shouldLoadData: boolean, props: import('@json-layout/vocabulary').StateNodePropsLib, slots: import('@json-layout/vocabulary').Slots | undefined, itemsCacheKey: any, children: import('../index.js').StateNode[] | undefined) => import('../index.js').StateNode} */
const produceStateNode = produce((draft, key, fullKey, parentFullKey, dataPath, parentDataPath, skeleton, layout, width, cols, data, error, validated, options, autofocus, shouldLoadData, props, slots, itemsCacheKey, children) => {
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
  if (shouldLoadData || (draft.loading && draft.data === data)) draft.loading = true
  else delete draft.loading
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
  draft.slots = slots
  draft.children = children
})

/** @type {(draft: import('../i18n/types.js').LocaleMessages, layoutMessages: Partial<import('../i18n/types.js').LocaleMessages>, options: import('./types.js').StateNodeOptions) => import('../i18n/types.js').LocaleMessages} */
const produceStateNodeMessages = produce((draft, layoutMessages, options) => {
  Object.assign(draft, options.messages, layoutMessages)
})

/** @type {(draft: unknown[], children: import('../index.js').StateNode[]) => unknown[]} */
const produceStateNodeDataChildrenArray = produce((draft, children) => {
  for (const child of children) {
    const key = /** @type {number} */(child.key)
    if (child.data === undefined) delete draft[key]
    else draft[key] = child.data
  }
  // remove trailing undefined values from tuples
  while (draft.length && draft[draft.length - 1] === undefined) {
    draft.pop()
  }
})

/** @type {(draft: Record<string, unknown>[], parentDataPath: string, additionalPropertiesErrors?: import('ajv').ErrorObject[], propertyKeys?: string[], removePropertyKeys?: string[]) => Record<string, unknown>[]} */
const produceStateNodeDataArray = produce((draft, parentDataPath, additionalPropertiesErrors, propertyKeys, removePropertyKeys) => {
  for (let i = 0; i < draft.length; i++) {
    if (!(draft[i] instanceof File)) {
      draft[i] = produceStateNodeData(draft[i], parentDataPath + '/' + i, undefined, additionalPropertiesErrors, propertyKeys, removePropertyKeys)
    }
  }
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
        if (child.data === undefined || child.data === null) continue
        if (children.length > 1) {
          for (const key of Object.keys(child.data)) {
            if (children.some(c => c.key === key)) continue
            if (!child.skeleton.propertyKeys.includes(key) && children.some(c => c.key !== child.key && c.skeleton.propertyKeys.includes(key))) continue
            draft[key] = /** @type {any} */(child.data)[key]
          }
        } else {
          Object.assign(draft, child.data)
        }
      } else {
        if (child.data === undefined) delete draft[child.key]
        else draft[child.key] = child.data
      }
    }
  }

  if (additionalPropertiesErrors?.length) {
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

/** @type {(draft: Record<string, unknown>, parentData: Record<string, unknown>, propertyKeys: string[], patterns: string[]) => Record<string, unknown>} */
const producePatternPropertiesData = produce((draft, parentData, propertyKeys, patterns) => {
  for (const key of Object.keys(parentData)) {
    if (propertyKeys.includes(key)) continue
    if (!patterns.some(p => !!key.match(getRegexp(p)))) continue
    draft[key] = parentData[key]
  }
  for (const key of Object.keys(draft)) {
    if (!(key in parentData)) delete draft[key]
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
const matchLocalError = (error, skeleton, dataPath, parentDataPath) => {
  const originalError = error.params?.errors?.[0] ?? error
  if (parentDataPath === originalError.instancePath && originalError.params?.missingProperty === skeleton.key) {
    return true
  }
  if (
    originalError.instancePath === dataPath &&
    (originalError.schemaPath === skeleton.pointer || originalError.schemaPath === skeleton.refPointer) &&
    !originalError.params?.missingProperty
  ) {
    return true
  }
  return false
}

/**
 * should match if an error belongs to a child of the current node but the child was not displayed
 * @param {import('../index.js').CompiledLayout} compiledLayout
 * @param {import('ajv').ErrorObject} error
 * @param {import('../index.js').SkeletonNode} skeleton
 * @param {string} dataPath
 * @param {string | null} parentDataPath
 * @returns {boolean}
 */
const matchChildError = (compiledLayout, error, skeleton, dataPath, parentDataPath) => {
  const originalError = error.params?.errors?.[0] ?? error
  if (!originalError.instancePath.startsWith(dataPath)) return false
  if (originalError.schemaPath === skeleton.pointer || originalError.schemaPath.startsWith(skeleton.pointer + '/') || originalError.schemaPath === skeleton.refPointer || originalError.schemaPath.startsWith(skeleton.refPointer + '/')) return true
  if (skeleton.children) {
    for (const c of skeleton.children) {
      const childSkeleton = compiledLayout.skeletonNodes[c]
      if (!childSkeleton) continue
      if (matchPointerError(error, childSkeleton.pointer, childSkeleton.refPointer, dataPath, parentDataPath)) return true
    }
  }
  if (skeleton.childrenTrees) {
    for (const c of skeleton.childrenTrees) {
      const childTree = compiledLayout.skeletonTrees[c]
      if (!childTree) continue
      if (matchPointerError(error, childTree.root, childTree.refPointer, dataPath, parentDataPath)) return true
    }
  }
  return false
}

/**
 * should match any error related to the data node not matter the origin in the schema
 * @param {import('ajv').ErrorObject} error
 * @param {string} dataPath
 * @returns {boolean}
 */
const matchDataPathError = (error, dataPath) => {
  const originalError = error.params?.errors?.[0] ?? error
  return originalError.instancePath.startsWith(dataPath)
}

/**
 * should match if an error belongs to a child of the current node but the child was not displayed
 * @param {import('ajv').ErrorObject} error
 * @param {string} pointer1
 * @param {string} pointer2
 * @param {string} dataPath
 * @param {string | null} parentDataPath
 * @returns {boolean}
 */
const matchPointerError = (error, pointer1, pointer2, dataPath, parentDataPath) => {
  const originalError = error.params?.errors?.[0] ?? error
  if (!originalError.instancePath.startsWith(dataPath)) return false
  if (originalError.schemaPath === pointer1 ||
          originalError.schemaPath.startsWith(pointer1 + '/') ||
          originalError.schemaPath === pointer2 ||
          originalError.schemaPath.startsWith(pointer2 + '/')
  ) return true
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
      return compiledExpression(data, data, options, options.context, display, layout, options.readOnly, options.summary, validates)
    } else {
      return compiledExpression(data, data, options, options.context, display, layout, options.readOnly, options.summary, validates, rootData, parentContext)
    }
  } catch (err) {
    /** @type {any} */
    const info = { expression, data, context: options.context, display }
    info[expression.dataAlias] = data
    if (!expression.pure) {
      info.rootData = rootData
      info.parent = parentContext
    }
    console.warn('json-layout: failed to evaluate expression', err, info)
    throw new Error('json-layout: failed to evaluate expression')
  }
}

const noneComp = { comp: 'none' }
/**
 * @param {import('@json-layout/vocabulary').NormalizedLayout} normalizedLayout
 * @param {import('@json-layout/vocabulary').Child | null} childDefinition
 * @param {import('./types.js').StateNodeOptions} options
 * @param {import('../index.js').CompiledLayout} compiledLayout
 * @param {import('./utils/display.js').Display} display
 * @param {unknown} data
 * @param {unknown} rootData
 * @param {import('../compile/types.js').ParentContextExpression | null} parentContext
 * @returns {import('@json-layout/vocabulary').BaseCompObject}
 */
const getCompObject = (normalizedLayout, childDefinition, options, compiledLayout, display, data, rootData, parentContext) => {
  if (isSwitchStruct(normalizedLayout)) {
    for (const compObject of normalizedLayout.switch) {
      if (!compObject.if || !!evalExpression(compiledLayout.expressions, compObject.if, data, options, display, compObject, compiledLayout.validates, rootData, parentContext)) {
        return compObject
      }
    }
  } else {
    if (childDefinition?.if && !evalExpression(compiledLayout.expressions, childDefinition.if, data, options, display, normalizedLayout, compiledLayout.validates, rootData, parentContext)) {
      return noneComp
    }
    if (normalizedLayout.if && !evalExpression(compiledLayout.expressions, normalizedLayout.if, data, options, display, normalizedLayout, compiledLayout.validates, rootData, parentContext)) {
      return noneComp
    }
    return normalizedLayout
  }
  return noneComp
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
 * @param {any} data
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
  if (skeleton.pure && !reusedNode?.error && !reusedNode?.childError && !parentOptions.noStateCache) {
    const validatedCacheKey = validationState.validatedForm || validationState.validatedChildren.includes(fullKey)
    cacheKey = [
      reusedNode,
      parentOptions,
      compiledLayout,
      fullKey,
      context.currentInput !== null && context.currentInput.startsWith(fullKey),
      skeleton,
      childDefinition,
      parentDisplay.width,
      validatedCacheKey,
      context.activatedItems,
      context.initial,
      context.rehydrateErrors?.length ?? 0,
      data
    ]
    if (reusedNode && context.cacheKeys[fullKey] && shallowEqualArray(context.cacheKeys[fullKey], cacheKey)) {
      logStateNode('createStateNode cache hit', fullKey)
      // @ts-ignore
      if (context._debugCache) context._debugCache[fullKey] = (context._debugCache[fullKey] ?? []).concat(['hit'])
      if (reusedNode.layout.comp === 'list' && reusedNode.layout.getItems) {
        logGetItems(fullKey, 'list component node is fully reused from cache, no fetch will be triggered')
      }
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

  const normalizedLayout = childDefinition && (childIsCompositeCompObject(childDefinition) || childIsSlotCompObject(childDefinition))
    ? childDefinition
    : compiledLayout.normalizedLayouts[skeleton.pointer]
  const layout = getCompObject(normalizedLayout, childDefinition, parentOptions, compiledLayout, parentDisplay, data, context.rootData, parentContext)
  const [display, cols] = getChildDisplay(parentDisplay, childDefinition?.cols ?? layout.cols)
  const slots = childDefinition?.slots ?? layout.slots

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
      const isSameDataPath = typeof childLayout.key === 'string' && childLayout.key.startsWith('$')
      const childFullKey = `${fullKey}/${childLayout.key}`
      if (focusChild) context.autofocusTarget = childFullKey
      let childData = isSameDataPath ? objectData : objectData[childLayout.key]
      if (childLayout.key === '$patternProperties') {
        const childNormalizedLayout = /** @type {import('@json-layout/vocabulary').List} */(compiledLayout.normalizedLayouts[childSkeleton.pointer])
        childData = producePatternPropertiesData(
          /** @type {Record<string, unknown>} */(reusedNode?.children?.find(c => c.key === '$patternProperties')?.data ?? {}),
          /** @type {Record<string, unknown>} */(objectData),
          skeleton.propertyKeys,
          childNormalizedLayout.indexed ?? []
        )
      }
      const child = createStateNode(
        context,
        childrenOptions,
        compiledLayout,
        childLayout.key,
        childFullKey,
        fullKey,
        isSameDataPath ? dataPath : `${dataPath}/${childLayout.key}`,
        dataPath,
        childSkeleton,
        childLayout,
        display,
        childData,
        { parent: parentContext, data: objectData },
        validationState,
        reusedNode?.children?.find(c => c.fullKey === childFullKey)
      )
      if (child.autofocus || child.autofocusChild !== undefined) focusChild = false
      children.push(child)
    }
  }

  if (key === '$oneOf' && skeleton.childrenTrees) {
    // find the oneOf child that was either previously selected
    // or the one matching the specified discriminator
    // or the one that is valid with current data
    let activeChildTreeIndex = /** @type {number} */context.activatedItems[fullKey]
    const validChildTreeIndex = skeleton.childrenTrees?.findIndex((childTree) => compiledLayout.validates[compiledLayout.skeletonTrees[childTree].refPointer](data))
    if (activeChildTreeIndex === undefined) {
      if (skeleton.discriminator !== undefined && validChildTreeIndex === -1) {
        activeChildTreeIndex = skeleton.childrenTrees?.findIndex((childTree) => skeleton.discriminator !== undefined && data?.[skeleton.discriminator] !== undefined && data[skeleton.discriminator] === compiledLayout.skeletonTrees[childTree].discriminatorValue)
      } else {
        activeChildTreeIndex = validChildTreeIndex
      }
    }

    if (activeChildTreeIndex !== -1) {
      const activeChildTree = compiledLayout.skeletonTrees[skeleton.childrenTrees[activeChildTreeIndex]]
      const activeChildNode = compiledLayout.skeletonNodes[activeChildTree.root]
      if (!(fullKey in context.activatedItems)) context.autoActivatedItems[fullKey] = activeChildTreeIndex
      context.errors = context.errors?.filter(error => {
        // if an item was selected, remove the oneOf error
        if (matchLocalError(error, skeleton, dataPath, parentDataPath)) {
          return false
        }
        // also remove the errors from other children of the oneOf
        if (matchChildError(compiledLayout, error, skeleton, dataPath, parentDataPath) && !matchPointerError(error, activeChildNode.pointer, activeChildNode.refPointer, dataPath, parentDataPath)) {
          return false
        }
        return true
      })

      if (context.additionalPropertiesErrors?.length) {
        // exclude the additional properties errors from the other children
        context.additionalPropertiesErrors = context.additionalPropertiesErrors?.filter(error => {
          // keep errors from other parts of the data
          if (!matchDataPathError(error, dataPath)) return true
          // keep errors from the active child's schema
          if (matchPointerError(error, activeChildNode.pointer, activeChildNode.refPointer, dataPath, parentDataPath)) return true
          // remove errors from other children
          if (matchChildError(compiledLayout, error, skeleton, dataPath, parentDataPath) && !matchPointerError(error, activeChildNode.pointer, activeChildNode.refPointer, dataPath, parentDataPath)) return false
          // ignore unevaluatedProperties errors from higher level that can be triggered because the active element is not yet valid
          // TODO: should the last check include comparing with activeChildNode.propertyKeys ?
          if (validChildTreeIndex === -1) return false
          return true
        })
      }

      const activeChildKey = `${fullKey}/${activeChildTreeIndex}`
      if (context.autofocusTarget === fullKey) context.autofocusTarget = activeChildKey

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
          activeChildNode,
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

  if (isListLayout(layout)) {
    if (layout.indexed) {
      const objectData = /** @type {Record<string, unknown>} */(data ?? [])
      const listItemOptions = layout.listEditMode === 'inline' ? options : produceReadonlyArrayItemOptions(options)
      children = []
      let focusChild = context.autofocusTarget === fullKey
      const childrenKeys = Object.keys(objectData)
      for (let i = 0; i < childrenKeys.length; i++) {
        const childKey = childrenKeys[i]
        let valueChildSkeleton = /** @type {import('../index.js').SkeletonNode | null} */ null
        if (skeleton?.childrenTrees?.length === 1) {
          valueChildSkeleton = compiledLayout.skeletonNodes[compiledLayout.skeletonTrees[skeleton?.childrenTrees[0]]?.root]
        } else {
          for (let p = 0; p < layout.indexed.length; p++) {
            const pattern = layout.indexed[p]
            const childTreeKey = skeleton?.childrenTrees?.[p]
            if (!childTreeKey) throw new Error(`missing skeleton tree for pattern ${pattern}`)
            if (childKey.match(getRegexp(pattern))) {
              valueChildSkeleton = compiledLayout.skeletonNodes[compiledLayout.skeletonTrees[childTreeKey]?.root]
            }
          }
        }
        if (valueChildSkeleton) {
          const childFullKey = `${fullKey}/${childKey}`
          if (focusChild) context.autofocusTarget = childFullKey
          const valueChild = createStateNode(
            context,
            (layout.listEditMode === 'inline-single' && context.activatedItems[fullKey] === i) ? options : listItemOptions,
            compiledLayout,
            childKey,
            childFullKey,
            fullKey,
            `${dataPath}/${childKey}`,
            dataPath,
            valueChildSkeleton,
            null,
            display,
            objectData[childKey],
            { parent: parentContext, data: objectData },
            validationState,
            reusedNode?.children?.find(c => c.key === childKey)
          )
          if (valueChild.autofocus || valueChild.autofocusChild !== undefined) focusChild = false
          children.push(valueChild)
        }
      }
    } else {
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

      // duplicate active child at the end of the list in case of dialog/menu edition
      if (context.activatedItems[fullKey] !== undefined && (layout.listEditMode === 'menu' || layout.listEditMode === 'dialog')) {
        const i = context.activatedItems[fullKey]
        const activeChild = createStateNode(
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
          display,
          arrayData[i],
          { parent: parentContext, data: arrayData },
          validationState,
          reusedNode?.children?.[i]
        )
        children.push(activeChild)
      }
    }
  }

  let error = context.errors?.find(e => matchLocalError(e, skeleton, dataPath, parentDataPath))

  // findLast in following lines is important because we want to keep the error of the highest child (deepest errors are listed first)
  if (!error && !isCompositeLayout(layout, compiledLayout.components) && layout.comp !== 'slot') {
    error = context.errors?.findLast(e => matchChildError(compiledLayout, e, skeleton, dataPath, parentDataPath))
  }
  if (!error && context.rehydrate && context.rehydrateErrors) {
    error = context.rehydrateErrors?.findLast(e => matchChildError(compiledLayout, e, skeleton, dataPath, parentDataPath))
  }

  // capture errors so that they are not repeated in parent nodes
  if (layout.comp !== 'none') {
    if (error) {
      logValidation(`${fullKey} capture validation error on node`, error)
      context.errors = context.errors?.filter(e => error !== e)
      if (!isCompositeLayout(layout, compiledLayout.components) && layout.comp !== 'slot') {
        context.errors = context.errors?.filter(e => !matchChildError(compiledLayout, e, skeleton, dataPath, parentDataPath))
      }
      if (context.rehydrate && context.rehydrateErrors) {
        context.rehydrateErrors = context.rehydrateErrors?.filter(e => !matchChildError(compiledLayout, e, skeleton, dataPath, parentDataPath))
      }
    }
  }

  let nodeData = data
  if (nodeData === null && !layout.nullable) nodeData = undefined

  const validated = validationState.validatedForm ||
    validationState.validatedChildren.includes(fullKey) ||
    (validationState.initialized === false && options.initialValidation === 'always') ||
    (validationState.initialized === false && options.initialValidation === 'withData' && !isDataEmpty(nodeData))

  if (typeof children?.[0]?.key === 'number' && layout.comp !== 'one-of-select' && !layout.indexed) {
    // case of an array of children nodes
    nodeData = produceStateNodeDataChildrenArray(
      /** @type {unknown[]} */(nodeData ?? []),
      children
    )
  } else if (Array.isArray(nodeData)) {
    // case of an array without children nodes, so a select of objects for example
    const itemsSkeletonTree = skeleton.childrenTrees?.[0] && compiledLayout.skeletonTrees[skeleton.childrenTrees?.[0]]
    const itemsSkeletonNode = (itemsSkeletonTree && compiledLayout.skeletonNodes[itemsSkeletonTree.root]) || null
    nodeData = produceStateNodeDataArray(
      /** @type {Record<string, unknown>[]} */(nodeData ?? []),
      dataPath,
      context.additionalPropertiesErrors,
      [true, 'unknown'].includes(options.removeAdditional) ? itemsSkeletonNode?.propertyKeys : undefined,
      options.readOnlyPropertiesMode === 'remove' ? itemsSkeletonNode?.roPropertyKeys : undefined
    )
  } else if ((typeof nodeData === 'object' || (nodeData === undefined && children?.length)) && !(nodeData instanceof File)) {
    // case of an object base on children nodes or not
    const removeAdditional = [true, 'unknown'].includes(options.removeAdditional) || children?.some(c => c.key === '$patternProperties')
    nodeData = produceStateNodeData(
      /** @type {Record<string, unknown>} */(nodeData ?? {}),
      dataPath,
      children,
      context.additionalPropertiesErrors,
      removeAdditional ? skeleton.propertyKeys : undefined,
      options.readOnlyPropertiesMode === 'remove' ? skeleton.roPropertyKeys : undefined
    )
  }

  // the producer is not perfect, sometimes data is considered mutated but it is actually the same
  // we double check here to avoid unnecessary re-renders
  if (nodeData !== data) {
    if (Array.isArray(data) && Array.isArray(nodeData)) nodeData = shallowProduceArray(data, nodeData)
    // @ts-ignore
    else if (typeof data === 'object' && typeof nodeData === 'object') nodeData = shallowProduceObject(data, nodeData)
  }

  if (layout.getConstData) {
    if (!context.rehydrate) {
      nodeData = evalExpression(compiledLayout.expressions, layout.getConstData, nodeData, options, display, layout, compiledLayout.validates, context.rootData, parentContext)
    }
  } else {
    if (layout.getDefaultData && useDefaultData(nodeData, layout, options) && context.currentInput !== fullKey) {
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
        const urlExprResult = evalExpression(compiledLayout.expressions, layout.getItems.url, null, options, display, layout, compiledLayout.validates, context.rootData, parentContext)
        const url = pathURL(urlExprResult, options.fetchBaseURL)
        if (layout.getItems.searchParams) {
          for (const [key, expr] of Object.entries(layout.getItems.searchParams)) {
            let val
            try {
              val = evalExpression(compiledLayout.expressions, expr, null, options, display, layout, compiledLayout.validates, context.rootData, parentContext)
              if (val) url.searchParams.set(key, val)
            } catch (err) {
              // nothing to o
            }
          }
        }
        if (layout.getItems.headers) {
          for (const [key, expr] of Object.entries(layout.getItems.headers)) {
            let val
            try {
              val = evalExpression(compiledLayout.expressions, expr, null, options, display, layout, compiledLayout.validates, context.rootData, parentContext)
              if (val) url.searchParams.set('__jl__header__' + key, val)
            } catch (err) {
              // nothing to o
            }
          }
        }
        itemsCacheKey = url.href
      } catch (err) {
        console.warn('failed to process URL for getItems', err)
        itemsCacheKey = null
      }
    }
  }

  const autofocus = isFocusableLayout(layout, compiledLayout.components) && !options.readOnly && !options.summary && context.autofocusTarget === fullKey
  const shouldLoadData = layout.comp === 'list' && itemsCacheKey && reusedNode?.itemsCacheKey !== itemsCacheKey
  if (shouldLoadData) {
    logGetItems(fullKey, 'list component with getItems expression registered for fetch', itemsCacheKey)
  } else if (layout.comp === 'list' && itemsCacheKey) {
    logGetItems(fullKey, 'list component with unchanged getItems cache key, no fetch will be triggered', itemsCacheKey)
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
    display.width,
    cols,
    nodeData,
    error?.message,
    validated,
    options,
    autofocus,
    shouldLoadData,
    props,
    slots,
    itemsCacheKey,
    children && shallowProduceArray(reusedNode?.children, children)
  )

  if (cacheKey) {
    cacheKey[0] = node
    context.cacheKeys[fullKey] = cacheKey
  }

  if (shouldLoadData) context.getItemsDataRequests.push(node)

  return node
}

/** @type {(draft: any, node: import('./types.js').StateNode, data: unknown) => any} */
export const producePatchedData = produce((draft, node, data) => {
  if (node.dataPath === node.parentDataPath) {
    Object.assign(draft, data)

    // remove properties that previously came from this merged child and were removed
    if (node.data && typeof data === 'object' && data !== null) {
      for (const key of Object.keys(node.data)) {
        if (!(key in data)) {
          delete draft[key]
        }
      }
    }
  } else {
    draft[node.key] = data
  }
})

/** @type {(existingData: any[], existingItems: import('@json-layout/vocabulary').SelectItems, newItems: import('@json-layout/vocabulary').SelectItems) => any} */
export const produceListData = (existingData, existingItems, newItems) => {
  const data = []
  for (const item of newItems) {
    const existingItem = existingItems.find(i => i.key === item.key)
    if (existingItem) {
      data.push(existingData[existingItems.indexOf(existingItem)])
    } else {
      data.push(item.value)
    }
  }
  return shallowProduceArray(existingData, data)
}
