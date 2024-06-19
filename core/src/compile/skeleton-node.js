// import Debug from 'debug'
import { normalizeLayoutFragment, isSwitchStruct, isGetItemsExpression, isGetItemsFetch, isItemsLayout, getSchemaFragmentType } from '@json-layout/vocabulary'
import { makeSkeletonTree } from './skeleton-tree.js'
import { partialResolveRefs } from './utils/resolve-refs.js'

/**
 * @param {any} rawSchema
 * @param {string} sourceSchemaId
 * @param {import('./index.js').CompileOptions} options
 * @param {(schemaId: string, ref: string) => [any, string, string]} getJSONRef
 * @param {Record<string, import('./types.js').SkeletonTree>} skeletonTrees
 * @param {string[]} validates
 * @param {Record<string, string[]>} validationErrors
 * @param {Record<string, import('@json-layout/vocabulary').NormalizedLayout>} normalizedLayouts
 * @param {import('@json-layout/vocabulary').Expression[]} expressions
 * @param {string | number} key
 * @param {string} currentPointer
 * @param {string | null} parentPointer
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
  validates,
  validationErrors,
  normalizedLayouts,
  expressions,
  key,
  currentPointer,
  parentPointer,
  required,
  condition,
  dependent,
  knownType
) {
  let schemaId = sourceSchemaId
  let schema = rawSchema
  let pointer = currentPointer
  let refFragment
  if (schema.$ref) {
    [refFragment, schemaId, pointer] = getJSONRef(sourceSchemaId, schema.$ref)
    schema = {...rawSchema, ...refFragment}
    delete schema.$ref
  }
  schema = partialResolveRefs(schema, schemaId, getJSONRef)
  const { type, nullable } = knownType ? { type: knownType, nullable: false } : getSchemaFragmentType(schema)

  // improve on ajv error messages based on ajv-errors (https://ajv.js.org/packages/ajv-errors.html)
  rawSchema.errorMessage = rawSchema.errorMessage ?? {}
  if (!normalizedLayouts[pointer]) {
    const normalizationResult = normalizeLayoutFragment(
      /** @type {import('@json-layout/vocabulary').SchemaFragment} */(schema),
      pointer,
      options.components,
      options.markdown,
      options.optionsKeys,
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

  let defaultData
  if ('default' in schema) defaultData = schema.default
  else if (required) {
    if (nullable) defaultData = null
    else if (type === 'object') defaultData = {}
    else if (type === 'array') defaultData = []
  }

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

  const compObjects = isSwitchStruct(normalizedLayout) ? normalizedLayout.switch : [normalizedLayout]
  for (const compObject of compObjects) {
    if (schema.description && !compObject.help) compObject.help = schema.description
    if (compObject.if) pushExpression(expressions, compObject.if)

    if (schema.const !== undefined && compObject.constData === undefined) compObject.constData = schema.const
    if (compObject.constData !== undefined && !compObject.getConstData) compObject.getConstData = { type: 'js-eval', expr: 'layout.constData', pure: true }
    if (compObject.getConstData) pushExpression(expressions, compObject.getConstData)

    if (defaultData !== undefined && compObject.defaultData === undefined) compObject.defaultData = defaultData
    if (compObject.defaultData !== undefined && !compObject.getDefaultData) compObject.getDefaultData = { type: 'js-eval', expr: 'layout.defaultData', pure: true }
    if (compObject.getDefaultData) pushExpression(expressions, compObject.getDefaultData)

    if (compObject.options !== undefined && !compObject.getOptions) compObject.getOptions = { type: 'js-eval', expr: 'layout.options', pure: true }
    if (compObject.getOptions) pushExpression(expressions, compObject.getOptions)

    if (compObject.props !== undefined && !compObject.getProps) compObject.getProps = { type: 'js-eval', expr: 'layout.props', pure: true }
    if (compObject.getProps) pushExpression(expressions, compObject.getProps)

    if (compObject.transformData) pushExpression(expressions, compObject.transformData)

    if (isItemsLayout(compObject, options.components) && compObject.getItems) {
      if (isGetItemsExpression(compObject.getItems)) pushExpression(expressions, compObject.getItems)
      if (isGetItemsFetch(compObject.getItems)) pushExpression(expressions, compObject.getItems.url)
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
    parentPointer,
    pure,
    propertyKeys: [],
    roPropertyKeys: [],
    nullable,
    required: required && !nullable
  }

  if (condition) {
    if (isSwitchStruct(normalizedLayout)) throw new Error('Switch struct not allowed in conditional schema')
    node.condition = { type: 'js-eval', expr: condition, pure: true }
    pushExpression(expressions, node.condition)
  }

  if (type === 'object') {
    if (schema.properties) {
      node.children = node.children ?? []
      for (const propertyKey of Object.keys(schema.properties)) {
        node.propertyKeys.push(propertyKey)
        if (schema.properties[propertyKey].readOnly) node.roPropertyKeys.push(propertyKey)
        const dependent = schema.dependentRequired && Object.values(schema.dependentRequired).some(dependentProperties => dependentProperties.includes(propertyKey))
        node.children.push(makeSkeletonNode(
          schema.properties[propertyKey],
          schemaId,
          options,
          getJSONRef,
          skeletonTrees,
          validates,
          validationErrors,
          normalizedLayouts,
          expressions,
          propertyKey,
          `${pointer}/properties/${propertyKey}`,
          pointer,
          schema.required?.includes(propertyKey),
          undefined,
          dependent
        ))

        if (schema.dependentSchemas?.[propertyKey] || (schema.dependencies?.[propertyKey] && !Array.isArray(schema.dependencies[propertyKey]))) {
          const dependentSchema = schema.dependentSchemas?.[propertyKey] ?? schema.dependencies[propertyKey]
          const dependentPointer = schema.dependentSchemas?.[propertyKey] ? `${pointer}/dependentSchemas/${propertyKey}` : `${pointer}/dependencies/${propertyKey}`
          node.children.push(makeSkeletonNode(
            dependentSchema,
            schemaId,
            options,
            getJSONRef,
            skeletonTrees,
            validates,
            validationErrors,
            normalizedLayouts,
            expressions,
            `$deps-${propertyKey}`,
            dependentPointer,
            pointer,
            false,
            `data["${propertyKey}"] !== undefined`,
            undefined,
            'object'
          ))
        }
      }
    }
    if (schema.allOf) {
      node.children = node.children ?? []
      for (let i = 0; i < schema.allOf.length; i++) {
        const allOfNode = makeSkeletonNode(
          schema.allOf[i],
          schemaId,
          options,
          getJSONRef,
          skeletonTrees,
          validates,
          validationErrors,
          normalizedLayouts,
          expressions,
          `$allOf-${i}`,
          `${pointer}/allOf/${i}`,
          pointer,
          false,
          undefined,
          undefined,
          'object'
        )
        node.propertyKeys = node.propertyKeys.concat(allOfNode.propertyKeys)
        node.roPropertyKeys = node.roPropertyKeys.concat(allOfNode.roPropertyKeys)
        node.children.push(allOfNode)
      }
    }
    if (schema.oneOf) {
      const oneOfPointer = `${pointer}/oneOf`
      if (!normalizedLayouts[oneOfPointer]) {
        const normalizationResult = normalizeLayoutFragment(
          schema,
          oneOfPointer,
          options.components,
          options.markdown,
          options.optionsKeys,
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
      /** @type {string[]} */
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
            validates,
            validationErrors,
            normalizedLayouts,
            expressions,
            childTreePointer,
            title
          )
        }
        childrenTrees.push(childTreePointer)
      }
      node.children = node.children ?? []
      node.children.push({
        key: '$oneOf',
        pointer: `${pointer}/oneOf`,
        parentPointer: pointer,
        childrenTrees,
        pure: skeletonTrees[childrenTrees[0]]?.root.pure,
        propertyKeys: [],
        roPropertyKeys: []
      })

      schema.errorMessage.oneOf = options.messages.errorOneOf
    }
    if (schema.if) {
      validates.push(`${pointer}/if`)
      if (schema.then) {
        node.children = node.children ?? []
        node.children.push(makeSkeletonNode(
          schema.then,
          schemaId,
          options,
          getJSONRef,
          skeletonTrees,
          validates,
          validationErrors,
          normalizedLayouts,
          expressions,
          '$then',
          `${pointer}/then`,
          pointer,
          false,
          `validates["${pointer}/if"](data)`,
          undefined,
          'object'
        ))
      }
      if (schema.else) {
        node.children = node.children ?? []
        node.children.push(makeSkeletonNode(
          schema.else,
          schemaId,
          options,
          getJSONRef,
          skeletonTrees,
          validates,
          validationErrors,
          normalizedLayouts,
          expressions,
          '$else',
          `${pointer}/else`,
          pointer,
          false,
          `!validates["${pointer}/if"](data)`,
          undefined,
          'object'
        ))
      }
    }

    for (const propertyKey of node.propertyKeys) {
      if (schema?.required?.includes(propertyKey)) {
        schema.errorMessage.required = schema.errorMessage.required ?? {}
        schema.errorMessage.required[propertyKey] = options.messages.errorRequired
      }
      if (schema.dependentRequired && Object.keys(schema.dependentRequired).includes(propertyKey)) {
        schema.errorMessage.dependentRequired = options.messages.errorRequired
      }
    }
  }

  if (type === 'array' && schema.items) {
    if (Array.isArray(schema.items)) {
      node.children = schema.items.map((/** @type {any} */ itemSchema, /** @type {number} */ i) => {
        return makeSkeletonNode(
          itemSchema,
          schemaId,
          options,
          getJSONRef,
          skeletonTrees,
          validates,
          validationErrors,
          normalizedLayouts,
          expressions,
          i,
          `${pointer}/items/${i}`,
          pointer,
          true
        )
      })
    } else {
      const childTreePointer = `${pointer}/items`
      if (!skeletonTrees[childTreePointer]) {
        // @ts-ignore
        skeletonTrees[childTreePointer] = 'recursing'
        skeletonTrees[childTreePointer] = makeSkeletonTree(
          schema.items,
          schemaId,
          options,
          getJSONRef,
          skeletonTrees,
          validates,
          validationErrors,
          normalizedLayouts,
          expressions,
          childTreePointer,
          schema.items.title
        )
      }
      node.childrenTrees = [childTreePointer]
    }
  }

  for (const child of node.children || []) {
    if (!child.pure) node.pure = false
  }
  for (const childTree of node.childrenTrees || []) {
    if (!skeletonTrees[childTree]?.root?.pure) node.pure = false
  }

  return node
}
