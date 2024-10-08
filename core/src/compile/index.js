// compileStatic is meant to produce a serializable result

import ajvModule from 'ajv/dist/2019.js'
// import { Parser as ExprEvalParser } from 'expr-eval'
import addFormats from 'ajv-formats'
import ajvErrors from 'ajv-errors'
import ajvLocalizeModule from 'ajv-i18n'
import MarkdownIt from 'markdown-it'
import { produce } from 'immer'
import i18n from '../i18n/index.js'
import { makeSkeletonTree } from './skeleton-tree.js'
import { resolveLocaleRefs } from './utils/resolve-refs.js'
import { resolveXI18n } from './utils/x-i18n.js'
import clone from '../utils/clone.js'
import { standardComponents } from '@json-layout/vocabulary'
import { shallowEqualArray } from '../state/utils/immutable.js'

export { resolveLocaleRefs } from './utils/resolve-refs.js'
export { resolveXI18n } from './utils/x-i18n.js'

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

// use Immer for efficient updating with immutability and no-op detection
/** @type {(draft: PartialCompileOptions, newOptions: PartialCompileOptions) => PartialCompileOptions} */
export const produceCompileOptions = produce((draft, newOptions) => {
  for (const key of ['ajv', 'ajvOptions', 'code', 'markdown', 'markdownItOptions', 'xI18n', 'locale', 'defaultLocale', 'messages', 'optionsKeys', 'components']) {
    // @ts-ignore
    if (key in newOptions) {
      // components is problematic because it is an object with nested objects
      // simply compare there keys instead of the whole object
      if (key === 'components' && shallowEqualArray(Object.keys(draft.components ?? []), Object.keys(newOptions.components ?? []))) {
        continue
      }
      // @ts-ignore
      draft[key] = newOptions[key]
    } else {
      // @ts-ignore
      delete draft[key]
    }
  }
})

/**
 * @param {PartialCompileOptions} partialOptions
 * @returns {CompileOptions}
 */
const fillOptions = (partialOptions) => {
  let ajv = partialOptions.ajv
  if (!ajv) {
    /** @type {import('ajv').Options} */
    const ajvOpts = { allErrors: true, strict: false, verbose: true }
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

  const defaultLocale = partialOptions.defaultLocale || 'en'
  const locale = partialOptions.locale || defaultLocale
  const messages = { ...i18n[locale] || i18n[defaultLocale] }
  if (partialOptions.messages) Object.assign(messages, partialOptions.messages)

  const components = standardComponents.reduce((acc, component) => {
    acc[component.name] = component
    return acc
  }, /** @type {Record<string, import('@json-layout/vocabulary').ComponentInfo>} */({}))

  if (partialOptions.components) {
    for (const componentName of Object.keys(partialOptions.components)) {
      components[componentName] = { ...partialOptions.components[componentName], name: componentName }
    }
    Object.assign(components, partialOptions.components)
  }

  return {
    ajv,
    code: false,
    markdown,
    optionsKeys: [],
    ...partialOptions,
    locale,
    defaultLocale,
    messages,
    components,
    xI18n: !!partialOptions.xI18n
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
      ? ['data', expression.dataAlias, 'options', 'context', 'display', 'layout', 'validates']
      : ['data', expression.dataAlias, 'options', 'context', 'display', 'layout', 'validates', 'rootData', 'parent']
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
