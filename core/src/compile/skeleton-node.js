// import Debug from 'debug'
import { isSwitchStruct, isGetItemsExpression, isGetItemsFetch, isItemsLayout, isCompositeLayout, childIsCompositeCompObject, isListLayout } from '@json-layout/vocabulary'
import { normalizeLayoutFragment, mergeNullableSubSchema, getSchemaFragmentType } from '@json-layout/vocabulary/normalize'
import { makeSkeletonTree } from './skeleton-tree.js'
import { partialResolveRefs } from './utils/resolve-refs.js'

/**
 * @param {any} rawSchema
 * @param {string} sourceSchemaId
 * @param {import('./index.js').CompileOptions} options
 * @param {(schemaId: string, ref: string) => [any, string, string]} getJSONRef
 * @param {Record<string, import('./types.js').SkeletonTree>} skeletonTrees
 * @param {Record<string, import('./types.js').SkeletonNode>} skeletonNodes
 * @param {string[]} validatePointers
 * @param {Record<string, string[]>} validationErrors
 * @param {Record<string, import('@json-layout/vocabulary').NormalizedLayout>} normalizedLayouts
 * @param {import('@json-layout/vocabulary').Expression[]} expressions
 * @param {string | number} key
 * @param {string} pointer
 * @param {boolean} required
 * @param {string} [condition]
 * @param {boolean} [dependent]
 * @param {string} [knownType]
 * @returns {import('./types.js').SkeletonNode}
 */
export function makeSkeletonNode (
  rawSchema,
  sourceSchemaId,
  options,
  getJSONRef,
  skeletonTrees,
  skeletonNodes,
  validatePointers,
  validationErrors,
  normalizedLayouts,
  expressions,
  key,
  pointer,
  required,
  condition,
  dependent,
  knownType
) {
  let schemaId = sourceSchemaId
  let schema = rawSchema
  let refPointer = pointer
  let refFragment
  rawSchema.__pointer = pointer
  if (schema.$ref) {
    [refFragment, schemaId, refPointer] = getJSONRef(sourceSchemaId, schema.$ref)
    refFragment.__pointer = refPointer
    schema = { ...rawSchema, ...refFragment }
    delete schema.$ref
  }
  const nullableType = mergeNullableSubSchema(schema)
  if (nullableType) {
    schema = nullableType
    if (pointer === refPointer) pointer = schema.__pointer
    refPointer = schema.__pointer
  }
  const resolvedSchema = partialResolveRefs(schema, schemaId, getJSONRef)
  let { type, nullable } = getSchemaFragmentType(resolvedSchema)
  if (knownType) type = knownType
  if (nullableType) nullable = true

  // improve on ajv error messages based on ajv-errors (https://ajv.js.org/packages/ajv-errors.html)
  rawSchema.errorMessage = rawSchema.errorMessage ?? {}
  if (!normalizedLayouts[pointer]) {
    const normalizationResult = normalizeLayoutFragment(
      key,
      /** @type {import('@json-layout/vocabulary').SchemaFragment} */(resolvedSchema),
      pointer,
      options,
      undefined,
      type,
      nullable
    )
    normalizedLayouts[pointer] = normalizationResult.layout
    if (normalizationResult.errors.length) {
      validationErrors[pointer.replace('_jl#', '/')] = normalizationResult.errors
    }
  }
  const normalizedLayout = normalizedLayouts[pointer]

  let pure = !dependent
  /**
   * @param {import('@json-layout/vocabulary').Expression[]} expressions
   * @param {import('@json-layout/vocabulary').Expression} expression
   */
  const pushExpression = (expressions, expression) => {
    if (!expression.pure) pure = false
    const index = expressions.findIndex(e => e.type === expression.type && e.expr === expression.expr)
    if (index !== -1) {
      expression.ref = index
    } else {
      expression.ref = expressions.length
      expressions.push(expression)
    }
  }

  /**
   * @param {import('@json-layout/vocabulary').Child} child
   */
  const prepareLayoutChild = (child) => {
    if (child.if) pushExpression(expressions, child.if)
    if (childIsCompositeCompObject(child)) {
      for (const grandChild of child.children) prepareLayoutChild(grandChild)
    }
  }

  const compObjects = isSwitchStruct(normalizedLayout) ? normalizedLayout.switch : [normalizedLayout]

  for (const compObject of compObjects) {
    const component = options.components[compObject.comp]
    if (!component) throw new Error(`Component "${compObject.comp}" not found`)

    if (compObject.if) pushExpression(expressions, compObject.if)
    if (isCompositeLayout(compObject, options.components)) {
      for (const child of compObject.children) prepareLayoutChild(child)
    }

    if (schema.const !== undefined && compObject.constData === undefined) compObject.constData = schema.const
    if (compObject.constData !== undefined && !compObject.getConstData) compObject.getConstData = { type: 'js-eval', expr: 'layout.constData', pure: true, dataAlias: 'value' }
    if (compObject.getConstData) pushExpression(expressions, compObject.getConstData)

    let defaultData
    if ('default' in schema && (options.useDefault === 'data' || options.useDefault === true || required)) defaultData = schema.default
    else if (required) {
      if (nullable) defaultData = null
      else if (type === 'object' && isCompositeLayout(compObject, options.components)) defaultData = {}
      else if (type === 'array') defaultData = []
      else if (type === 'boolean') defaultData = false
    }
    if (defaultData !== undefined && compObject.defaultData === undefined) compObject.defaultData = defaultData
    if (compObject.defaultData !== undefined && !compObject.getDefaultData) compObject.getDefaultData = { type: 'js-eval', expr: 'layout.defaultData', pure: true, dataAlias: 'value' }
    if (compObject.getDefaultData) pushExpression(expressions, compObject.getDefaultData)

    if (compObject.options !== undefined && !compObject.getOptions) compObject.getOptions = { type: 'js-eval', expr: 'layout.options', pure: true, dataAlias: 'value' }
    if (compObject.getOptions) pushExpression(expressions, compObject.getOptions)

    if (compObject.props !== undefined && !compObject.getProps) compObject.getProps = { type: 'js-eval', expr: 'layout.props', pure: true, dataAlias: 'value' }
    if (compObject.getProps) pushExpression(expressions, compObject.getProps)

    if (compObject.transformData) pushExpression(expressions, compObject.transformData)

    if (isListLayout(compObject)) {
      if (compObject.itemTitle) pushExpression(expressions, compObject.itemTitle)
      if (compObject.itemSubtitle) pushExpression(expressions, compObject.itemSubtitle)
    }

    if (isItemsLayout(compObject, options.components) && compObject.getItems) {
      if (isGetItemsExpression(compObject.getItems)) pushExpression(expressions, compObject.getItems)
      if (isGetItemsFetch(compObject.getItems)) {
        pushExpression(expressions, compObject.getItems.url)
        if (compObject.getItems.searchParams) {
          for (const expr of Object.values(compObject.getItems.searchParams)) {
            pushExpression(expressions, expr)
          }
        }
        if (compObject.getItems.headers) {
          for (const expr of Object.values(compObject.getItems.headers)) {
            pushExpression(expressions, expr)
          }
        }
      }
      if (compObject.getItems.itemTitle) pushExpression(expressions, compObject.getItems.itemTitle)
      if (compObject.getItems.itemKey) pushExpression(expressions, compObject.getItems.itemKey)
      if (compObject.getItems.itemValue) pushExpression(expressions, compObject.getItems.itemValue)
      if (compObject.getItems.itemIcon) pushExpression(expressions, compObject.getItems.itemIcon)
      if (compObject.getItems.itemsResults) pushExpression(expressions, compObject.getItems.itemsResults)
    }
  }

  /** @type {import('./types.js').SkeletonNode} */
  const node = {
    key: key ?? '',
    pointer,
    refPointer,
    pure,
    propertyKeys: [],
    roPropertyKeys: [],
    nullable,
    required: required && !nullable
  }

  if (condition) {
    if (isSwitchStruct(normalizedLayout)) throw new Error('Switch struct not allowed in conditional schema')
    node.condition = { type: 'js-eval', expr: condition, pure: true, dataAlias: 'value' }
    pushExpression(expressions, node.condition)
  }

  if (schema.oneOf) {
    rawSchema.errorMessage.oneOf = options.messages.errorOneOf
  }

  if (type === 'object') {
    if (schema.properties) {
      node.children = node.children ?? []
      for (const propertyKey of Object.keys(schema.properties)) {
        node.propertyKeys.push(propertyKey)
        if (schema.properties[propertyKey].readOnly) node.roPropertyKeys.push(propertyKey)
        const dependent = schema.dependentRequired && Object.values(schema.dependentRequired).some(dependentProperties => dependentProperties.includes(propertyKey))
        const childPointer = `${refPointer}/properties/${propertyKey}`
        if (!skeletonNodes[childPointer]) {
          // @ts-ignore
          skeletonNodes[childPointer] = 'recursing'
          skeletonNodes[childPointer] = makeSkeletonNode(
            schema.properties[propertyKey],
            schemaId,
            options,
            getJSONRef,
            skeletonTrees,
            skeletonNodes,
            validatePointers,
            validationErrors,
            normalizedLayouts,
            expressions,
            propertyKey,
            childPointer,
            schema.required?.includes(propertyKey),
            undefined,
            dependent
          )
        }
        node.children.push(childPointer)

        if (schema.dependentSchemas?.[propertyKey] || (schema.dependencies?.[propertyKey] && !Array.isArray(schema.dependencies[propertyKey]))) {
          const dependentSchema = schema.dependentSchemas?.[propertyKey] ?? schema.dependencies[propertyKey]
          const dependentPointer = schema.dependentSchemas?.[propertyKey] ? `${refPointer}/dependentSchemas/${propertyKey}` : `${refPointer}/dependencies/${propertyKey}`
          if (!skeletonNodes[dependentPointer]) {
            // @ts-ignore
            skeletonNodes[dependentPointer] = 'recursing'
            skeletonNodes[dependentPointer] = makeSkeletonNode(
              dependentSchema,
              schemaId,
              options,
              getJSONRef,
              skeletonTrees,
              skeletonNodes,
              validatePointers,
              validationErrors,
              normalizedLayouts,
              expressions,
              `$deps-${propertyKey}`,
              dependentPointer,
              false,
              `data["${propertyKey}"] !== undefined`,
              undefined,
              'object'
            )
          }
          node.children.push(dependentPointer)
        }
      }
    }
    if (schema.allOf) {
      for (let i = 0; i < schema.allOf.length; i++) {
        const childPointer = `${refPointer}/allOf/${i}`
        if (!skeletonNodes[childPointer]) {
          // @ts-ignore
          skeletonNodes[childPointer] = 'recursing'
          skeletonNodes[childPointer] = makeSkeletonNode(
            schema.allOf[i],
            schemaId,
            options,
            getJSONRef,
            skeletonTrees,
            skeletonNodes,
            validatePointers,
            validationErrors,
            normalizedLayouts,
            expressions,
            `$allOf-${i}`,
            childPointer,
            false,
            undefined,
            undefined,
            'object'
          )
        }
        node.propertyKeys = node.propertyKeys.concat(skeletonNodes[childPointer].propertyKeys)
        node.roPropertyKeys = node.roPropertyKeys.concat(skeletonNodes[childPointer].roPropertyKeys)
        node.children = node.children ?? []
        node.children.push(childPointer)
      }
    }
    if (schema.oneOf) {
      const oneOfPointer = `${refPointer}/oneOf`
      if (!normalizedLayouts[oneOfPointer]) {
        const normalizationResult = normalizeLayoutFragment(
          '',
          schema,
          oneOfPointer,
          options,
          'oneOf',
          type,
          nullable
        )
        normalizedLayouts[oneOfPointer] = normalizationResult.layout
        if (normalizationResult.errors.length) {
          validationErrors[oneOfPointer.replace('_jl#', '/')] = normalizationResult.errors
        }
      }
      /** @type {string[]} */
      const childrenTrees = []
      for (let i = 0; i < schema.oneOf.length; i++) {
        if (!schema.oneOf[i].type) schema.oneOf[i].type = type
        const title = schema.oneOf[i].title ?? `option ${i}`
        delete schema.oneOf[i].title
        const childTreePointer = `${oneOfPointer}/${i}`
        if (!skeletonTrees[childTreePointer]) {
          // @ts-ignore
          skeletonTrees[childTreePointer] = 'recursing'
          skeletonTrees[childTreePointer] = makeSkeletonTree(
            schema.oneOf[i],
            schemaId,
            options,
            getJSONRef,
            skeletonTrees,
            skeletonNodes,
            validatePointers,
            validationErrors,
            normalizedLayouts,
            expressions,
            childTreePointer,
            title
          )
        }
        childrenTrees.push(childTreePointer)
      }
      if (!skeletonNodes[oneOfPointer]) {
        skeletonNodes[oneOfPointer] = {
          key: '$oneOf',
          pointer: oneOfPointer,
          refPointer: oneOfPointer,
          childrenTrees,
          pure: !childrenTrees.some(childTree => !skeletonNodes[skeletonTrees[childTree]?.root].pure),
          propertyKeys: [],
          roPropertyKeys: []
        }
      }
      node.children = node.children ?? []
      node.children.push(oneOfPointer)
    }
    if (schema.patternProperties) {
      const patternPropertiesPointer = `${pointer}/patternProperties`
      if (!normalizedLayouts[patternPropertiesPointer]) {
        const normalizationResult = normalizeLayoutFragment(
          '',
          schema,
          patternPropertiesPointer,
          options,
          'patternProperties',
          type,
          nullable
        )
        normalizedLayouts[patternPropertiesPointer] = normalizationResult.layout
        if (normalizationResult.errors.length) {
          validationErrors[patternPropertiesPointer.replace('_jl#', '/')] = normalizationResult.errors
        }
      }
      /** @type {string[]} */
      const childrenTrees = []
      for (const pattern of Object.keys(schema.patternProperties)) {
        const childTreePointer = `${patternPropertiesPointer}/${pattern}`
        if (!skeletonTrees[childTreePointer]) {
          // @ts-ignore
          skeletonTrees[childTreePointer] = 'recursing'
          skeletonTrees[childTreePointer] = makeSkeletonTree(
            schema.patternProperties[pattern],
            schemaId,
            options,
            getJSONRef,
            skeletonTrees,
            skeletonNodes,
            validatePointers,
            validationErrors,
            normalizedLayouts,
            expressions,
            childTreePointer,
            'pattern ' + pattern
          )
          const childLayout = normalizedLayouts[skeletonNodes[skeletonTrees[childTreePointer].root].pointer]
          if (isSwitchStruct(childLayout)) {
            for (const switchCase of childLayout.switch) {
              switchCase.nullable = true
            }
          } else {
            childLayout.nullable = true
          }
        }
        childrenTrees.push(childTreePointer)
      }
      if (!skeletonNodes[patternPropertiesPointer]) {
        skeletonNodes[patternPropertiesPointer] = {
          key: '$patternProperties',
          pointer: patternPropertiesPointer,
          refPointer: patternPropertiesPointer,
          childrenTrees,
          pure: !childrenTrees.some(childTree => !skeletonNodes[skeletonTrees[childTree]?.root].pure),
          propertyKeys: [],
          roPropertyKeys: []
        }
      }
      node.children = node.children ?? []
      node.children.push(patternPropertiesPointer)
    }
    if (schema.if) {
      validatePointers.push(`${pointer}/if`)
      if (schema.then) {
        const childPointer = `${refPointer}/then`
        if (!skeletonNodes[childPointer]) {
          // @ts-ignore
          skeletonNodes[childPointer] = 'recursing'
          skeletonNodes[childPointer] = makeSkeletonNode(
            schema.then,
            schemaId,
            options,
            getJSONRef,
            skeletonTrees,
            skeletonNodes,
            validatePointers,
            validationErrors,
            normalizedLayouts,
            expressions,
            '$then',
            childPointer,
            false,
            `validates["${pointer}/if"](data)`,
            undefined,
            'object'
          )
        }
        node.children = node.children ?? []
        node.children.push(childPointer)
      }
      if (schema.else) {
        const childPointer = `${refPointer}/else`
        if (!skeletonNodes[childPointer]) {
          // @ts-ignore
          skeletonNodes[childPointer] = 'recursing'
          skeletonNodes[childPointer] = makeSkeletonNode(
            schema.else,
            schemaId,
            options,
            getJSONRef,
            skeletonTrees,
            skeletonNodes,
            validatePointers,
            validationErrors,
            normalizedLayouts,
            expressions,
            '$else',
            childPointer,
            false,
            `!validates["${pointer}/if"](data)`,
            undefined,
            'object'
          )
        }
        node.children = node.children ?? []
        node.children.push(childPointer)
      }
    }

    for (const propertyKey of node.propertyKeys) {
      if (schema?.required?.includes(propertyKey)) {
        rawSchema.errorMessage.required = rawSchema.errorMessage.required ?? {}
        rawSchema.errorMessage.required[propertyKey] = options.messages.errorRequired
      }
      if (schema.dependentRequired && Object.keys(schema.dependentRequired).includes(propertyKey)) {
        rawSchema.errorMessage.dependentRequired = options.messages.errorRequired
      }
    }
  }

  if (type === 'array' && schema.items) {
    if (Array.isArray(schema.items)) {
      node.children = node.children ?? []
      for (let i = 0; i < schema.items.length; i++) {
        /** @type {any} */
        const itemSchema = schema.items[i]
        const childPointer = `${refPointer}/items/${i}`
        if (!skeletonNodes[childPointer]) {
          // @ts-ignore
          skeletonNodes[childPointer] = 'recursing'
          skeletonNodes[childPointer] = makeSkeletonNode(
            itemSchema,
            schemaId,
            options,
            getJSONRef,
            skeletonTrees,
            skeletonNodes,
            validatePointers,
            validationErrors,
            normalizedLayouts,
            expressions,
            i,
            childPointer,
            true
          )
        }
        node.children.push(childPointer)
      }
    } else {
      const childTreePointer = `${refPointer}/items`
      if (!skeletonTrees[childTreePointer]) {
        // @ts-ignore
        skeletonTrees[childTreePointer] = 'recursing'
        skeletonTrees[childTreePointer] = makeSkeletonTree(
          schema.items,
          schemaId,
          options,
          getJSONRef,
          skeletonTrees,
          skeletonNodes,
          validatePointers,
          validationErrors,
          normalizedLayouts,
          expressions,
          childTreePointer,
          schema.items.title
        )
      }
      node.childrenTrees = [childTreePointer]
      const childLayout = normalizedLayouts[skeletonNodes[skeletonTrees[childTreePointer].root].pointer]
      if (isSwitchStruct(childLayout)) {
        for (const switchCase of childLayout.switch) {
          switchCase.nullable = true
        }
      } else {
        childLayout.nullable = true
      }
    }
  }

  for (const childPointer of node.children || []) {
    const child = skeletonNodes[childPointer]
    if (!child.pure) node.pure = false
  }
  for (const childTree of node.childrenTrees || []) {
    if (!skeletonNodes[skeletonTrees[childTree]?.root]?.pure) node.pure = false
  }

  return node
}
