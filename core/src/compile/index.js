// compileStatic is meant to produce a serializable result

import ajvModule from 'ajv/dist/2019.js'
// import { Parser as ExprEvalParser } from 'expr-eval'
import addFormats from 'ajv-formats'
import ajvErrors from 'ajv-errors'
import ajvLocalizeModule from 'ajv-i18n'
import MarkdownIt from 'markdown-it'
import i18n from '../i18n/index.js'
import { makeSkeletonTree } from './skeleton-tree.js'
import { resolveRefs } from './utils/resolve-refs.js'
import clone from '../utils/clone.js'

export { resolveRefs } from './utils/resolve-refs.js'

/**
 * @typedef {import('./types.js').SkeletonTree} SkeletonTree
 * @typedef {import('./types.js').SkeletonNode} SkeletonNode
 * @typedef {import('./types.js').CompiledLayout} CompiledLayout
 * @typedef {import('./types.js').CompileOptions} CompileOptions
 * @typedef {import('./types.js').PartialCompileOptions} PartialCompileOptions
 * @typedef {import('./types.js').CompiledExpression} CompiledExpression
 */

// @ts-ignore
const Ajv = /** @type {typeof ajvModule.default} */ (ajvModule)
// @ts-ignore
const ajvLocalize = /** @type {typeof ajvLocalizeModule.default} */ (ajvLocalizeModule)

// const exprEvalParser = new ExprEvalParser()

/**
 * @param {PartialCompileOptions} partialOptions
 * @returns {CompileOptions}
 */
const fillOptions = (partialOptions) => {
  let ajv = partialOptions.ajv
  if (!ajv) {
    /** @type {import('ajv').Options} */
    const ajvOpts = { allErrors: true, strict: false }
    if (partialOptions.ajvOptions) Object.assign(ajvOpts, partialOptions.ajvOptions)
    if (partialOptions.code) ajvOpts.code = { source: true, esm: true, lines: true }
    const newAjv = new Ajv(ajvOpts)
    addFormats.default(newAjv)
    ajvErrors.default(newAjv)
    ajv = newAjv
  }
  ajv.addKeyword('layout')

  let markdown = partialOptions.markdown
  if (!markdown) {
    const markdownIt = new MarkdownIt(partialOptions.markdownItOptions ?? {})
    markdown = markdownIt.render.bind(markdownIt)
  }

  const locale = partialOptions.locale || 'en'
  const messages = { ...i18n[locale] || i18n.en }
  if (partialOptions.messages) Object.assign(messages, partialOptions.messages)

  return {
    ajv,
    code: false,
    markdown,
    ...partialOptions,
    locale,
    messages
  }
}

/**
 * @param {object} _schema
 * @param {PartialCompileOptions} [partialOptions]
 * @returns {CompiledLayout}
 */
export function compile (_schema, partialOptions = {}) {
  const options = fillOptions(partialOptions)

  const schema = /** @type {import('ajv').SchemaObject} */(clone(_schema))

  schema.$id = schema.$id ?? '_jl'
  resolveRefs(schema, options.ajv, options.locale)

  /** @type {string[]} */
  const validatePointers = []
  /** @type {Record<string, import('@json-layout/vocabulary').NormalizedLayout>} */
  const normalizedLayouts = {}
  /** @type {import('@json-layout/vocabulary').Expression[]} */
  const expressionsDefinitions = []
  /** @type {Record<string, string[]>} */
  const validationErrors = {}

  const skeletonTree = makeSkeletonTree(
    schema,
    options,
    validatePointers,
    validationErrors,
    normalizedLayouts,
    expressionsDefinitions,
    `${schema.$id}#`,
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
      ? ['data', 'options', 'context', 'display']
      : ['data', 'options', 'context', 'display', 'parentData', 'rootData']
    /* if (expression.type === 'expr-eval') {
      expressions.push(exprEvalParser.parse(expression.expr).toJSFunction(expressionsParams.join(',')))
    } */
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

  return {
    options,
    schema,
    skeletonTree,
    validates,
    validationErrors,
    normalizedLayouts,
    expressions,
    locale: options.locale,
    messages: options.messages,
    // @ts-ignore
    localizeErrors: ajvLocalize[options.locale] || ajvLocalize.en
  }
}
