// compileStatic is meant to produce a serializable result

import ajvModule from 'ajv'
import rfdc from 'rfdc'
import { Parser as ExprEvalParser } from 'expr-eval'
import addFormats from 'ajv-formats'
import ajvErrors from 'ajv-errors'
import MarkdownIt from 'markdown-it'
import { makeSkeletonTree } from './skeleton-tree.js'
import { resolveRefs } from './utils/resolve-refs.js'

export { resolveRefs } from './utils/resolve-refs.js'

/**
 * @typedef {import('./types.js').SkeletonTree} SkeletonTree
 * @typedef {import('./types.js').SkeletonNode} SkeletonNode
 * @typedef {import('./types.js').CompiledLayout} CompiledLayout
 * @typedef {import('./types.js').CompileOptions} CompileOptions
 * @typedef {import('./types.js').CompiledExpression} CompiledExpression
 */

// @ts-ignore
const Ajv = /** @type {typeof ajvModule.default} */ (ajvModule)

const expressionsParams = ['data', 'options', 'display']

const clone = rfdc()
const exprEvalParser = new ExprEvalParser()

/**
 * @param {Partial<CompileOptions>} partialOptions
 * @returns {CompileOptions}
 */
const fillOptions = (partialOptions) => {
  let ajv = partialOptions.ajv
  if (!ajv) {
    /** @type {import('ajv').Options} */
    const ajvOpts = { strict: false, allErrors: true }
    if (partialOptions.code) ajvOpts.code = { source: true, esm: true }
    const newAjv = new Ajv(ajvOpts)
    addFormats.default(newAjv)
    ajvErrors.default(newAjv)
    ajv = newAjv
  }

  let markdown = partialOptions.markdown
  if (!markdown) {
    const markdownIt = new MarkdownIt(partialOptions.markdownIt ?? {})
    markdown = markdownIt.render.bind(markdownIt)
  }

  return {
    ajv,
    code: false,
    markdown,
    lang: 'en',
    ...partialOptions
  }
}

/**
 * @param {object} _schema
 * @param {Partial<CompileOptions>} [partialOptions]
 * @returns {CompiledLayout}
 */
export function compile (_schema, partialOptions = {}) {
  const options = fillOptions(partialOptions)

  const schema = /** @type {import('ajv').SchemaObject} */(clone(_schema))

  schema.$id = schema.$id ?? '_jl'
  resolveRefs(schema, options.ajv, options.lang)
  options.ajv.addSchema(schema)

  /** @type {string[]} */
  const validatePointers = []
  /** @type {Record<string, import('@json-layout/vocabulary').NormalizedLayout>} */
  const normalizedLayouts = {}
  /** @type {import('@json-layout/vocabulary').Expression[]} */
  const expressionsDefinitions = []

  // TODO: produce a resolved/normalized version of the schema
  // useful to get predictable schemaPath properties in errors and to have proper handling of default values
  const skeletonTree = makeSkeletonTree(schema, options, validatePointers, normalizedLayouts, expressionsDefinitions, `${schema.$id}#`, 'main')

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
    if (expression.type === 'expr-eval') {
      expressions.push(exprEvalParser.parse(expression.expr).toJSFunction(expressionsParams.join(',')))
    }
    if (expression.type === 'js-fn') {
      // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
      expressions.push(/** @type {CompiledExpression} */(new Function(...expressionsParams, expression.expr)))
    }
    if (expression.type === 'js-eval') {
      // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func, @typescript-eslint/restrict-plus-operands
      expressions.push(/** @type {CompiledExpression} */(new Function(...expressionsParams, 'return (' + expression.expr + ')')))
    }
    if (expression.type === 'js-tpl') {
      // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func, @typescript-eslint/restrict-plus-operands
      expressions.push(/** @type {CompiledExpression} */(new Function(...expressionsParams, 'return `' + expression.expr + '`')))
    }
  }

  return { options, schema, skeletonTree, validates, normalizedLayouts, expressions }
}