// compileStatic is meant to produce a serializable result

// import { Parser as ExprEvalParser } from 'expr-eval'
import ajvLocalizeModule from 'ajv-i18n'
import { makeSkeletonTree } from './skeleton-tree.js'
import { resolveLocaleRefs } from './utils/resolve-refs.js'
import { resolveXI18n } from './utils/x-i18n.js'
import clone from '../utils/clone.js'
import { fillOptions } from './options.js'

export { resolveLocaleRefs } from './utils/resolve-refs.js'
export { resolveXI18n } from './utils/x-i18n.js'
export { produceCompileOptions } from './options.js'

/**
 * @typedef {import('./types.js').SkeletonTree} SkeletonTree
 * @typedef {import('./types.js').SkeletonNode} SkeletonNode
 * @typedef {import('./types.js').CompiledLayout} CompiledLayout
 * @typedef {import('./types.js').CompileOptions} CompileOptions
 * @typedef {import('./types.js').PartialCompileOptions} PartialCompileOptions
 * @typedef {import('./types.js').CompiledExpression} CompiledExpression
 */

// @ts-ignore
const ajvLocalize = /** @type {typeof ajvLocalizeModule.default} */ (ajvLocalizeModule)

// const exprEvalParser = new ExprEvalParser()

/**
 * @param {object} _schema
 * @param {PartialCompileOptions} [partialOptions]
 * @returns {CompiledLayout}
 */
export function compile (_schema, partialOptions = {}) {
  const options = fillOptions(partialOptions)

  const schema = /** @type {import('ajv').SchemaObject} */(clone(_schema))
  schema.$id = schema.$id ?? '_jl'
  const getJSONRef = resolveLocaleRefs(schema, options.ajv, options.locale, options.defaultLocale)
  if (options.xI18n) resolveXI18n(schema, options.locale, options.defaultLocale)

  /** @type {string[]} */
  const validatePointers = []
  /** @type {Record<string, import('@json-layout/vocabulary').NormalizedLayout>} */
  const normalizedLayouts = {}
  /** @type {import('@json-layout/vocabulary').Expression[]} */
  const expressionsDefinitions = []
  /** @type {Record<string, string[]>} */
  const validationErrors = {}
  /** @type {Record<string, import('./types.js').SkeletonTree>} */
  const skeletonTrees = {}
  /** @type {Record<string, import('./types.js').SkeletonNode>} */
  const skeletonNodes = {}

  // makeSkeletonTree also mutates the schema (adding some error messages)
  const mainTreePointer = `${schema.$id}#`
  // @ts-ignore
  skeletonTrees[mainTreePointer] = 'recursing'
  skeletonTrees[mainTreePointer] = makeSkeletonTree(
    schema,
    schema.$id,
    options,
    getJSONRef,
    skeletonTrees,
    skeletonNodes,
    validatePointers,
    validationErrors,
    normalizedLayouts,
    expressionsDefinitions,
    mainTreePointer,
    'main'
  )
  options.ajv.addSchema(schema)

  const uriResolver = options.ajv.opts.uriResolver
  /** @type {Record<string, import('ajv').ValidateFunction>} */
  const validates = {}
  for (const pointer of validatePointers) {
    const fullPointer = uriResolver.resolve(schema.$id, pointer)
    validates[pointer] = options.ajv.compile({ $ref: fullPointer })
  }

  /** @type {CompiledExpression[]} */
  const expressions = []

  for (const expression of expressionsDefinitions) {
    const expressionsParams = expression.pure
      ? ['data', expression.dataAlias, 'options', 'context', 'display', 'layout', 'readOnly', 'summary', 'validates']
      : ['data', expression.dataAlias, 'options', 'context', 'display', 'layout', 'readOnly', 'summary', 'validates', 'rootData', 'parent']
    /* if (expression.type === 'expr-eval') {
      expressions.push(exprEvalParser.parse(expression.expr).toJSFunction(expressionsParams.join(',')))
    } */
    if (expression.type === 'js-fn') {
      // eslint-disable-next-line no-new-func
      expressions.push(/** @type {CompiledExpression} */(new Function(...expressionsParams, expression.expr)))
    }
    if (expression.type === 'js-eval') {
      // eslint-disable-next-line no-new-func
      expressions.push(/** @type {CompiledExpression} */(new Function(...expressionsParams, 'return (' + expression.expr + ')')))
    }
    if (expression.type === 'js-tpl') {
      // eslint-disable-next-line no-new-func
      expressions.push(/** @type {CompiledExpression} */(new Function(...expressionsParams, 'return `' + expression.expr + '`')))
    }
  }

  if (Object.keys(validationErrors).length) {
    console.error('JSON layout encountered some validation errors:', validationErrors)
  }

  return {
    options,
    schema,
    mainTree: mainTreePointer,
    skeletonTrees,
    skeletonNodes,
    validates,
    validationErrors,
    normalizedLayouts,
    expressions,
    locale: options.locale,
    messages: options.messages,
    components: options.components,
    // @ts-ignore
    localizeErrors: ajvLocalize[options.locale] || ajvLocalize.en
  }
}
