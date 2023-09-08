// compileStatic is meant to produce a serializable result

import rfdc from 'rfdc'
import { Parser as ExprEvalParser } from 'expr-eval'
import { type SchemaObject } from 'json-schema-traverse'
import Ajv, { type ValidateFunction, type Options as AjvOptions } from 'ajv'
import addFormats from 'ajv-formats'
import ajvErrors from 'ajv-errors'
import MarkdownIt from 'markdown-it'
import { type Markdown, type Expression, type NormalizedLayout, type StateNodeOptions } from '@json-layout/vocabulary'
import { makeSkeletonTree, type SkeletonTree } from './skeleton-tree'
import { type Display } from '../state/utils/display'
import { resolveRefs } from './utils/resolve-refs'

export type { SkeletonTree } from './skeleton-tree'
export type { SkeletonNode } from './skeleton-node'
export { resolveRefs } from './utils/resolve-refs'

export type CompiledExpression = (data: any, options: StateNodeOptions, display: Display) => any

export interface CompileOptions {
  ajv: Ajv
  code: boolean
  markdown: Markdown
  markdownIt?: MarkdownIt.Options
  lang: string
}

export interface CompiledLayout {
  options: CompileOptions
  schema?: SchemaObject
  skeletonTree: SkeletonTree
  validates: Record<string, ValidateFunction>
  normalizedLayouts: Record<string, NormalizedLayout>
  expressions: CompiledExpression[]
}

const expressionsParams = ['data', 'options', 'display']

const clone = rfdc()
const exprEvalParser = new ExprEvalParser()

const fillOptions = (partialOptions: Partial<CompileOptions>): CompileOptions => {
  let ajv = partialOptions.ajv
  if (!ajv) {
    const ajvOpts: AjvOptions = { strict: false, allErrors: true }
    if (partialOptions.code) ajvOpts.code = { source: true, esm: true }
    ajv = new Ajv(ajvOpts)
    addFormats(ajv)
    ajvErrors(ajv)
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

export function compile (_schema: object, partialOptions: Partial<CompileOptions> = {}): CompiledLayout {
  const options = fillOptions(partialOptions)

  const schema = <SchemaObject>clone(_schema)

  schema.$id = schema.$id ?? '_jl'
  resolveRefs(schema, options.ajv, options.lang)
  options.ajv.addSchema(schema)

  const validatePointers: string[] = []
  const normalizedLayouts: Record<string, NormalizedLayout> = {}
  const expressionsDefinitions: Expression[] = []

  // TODO: produce a resolved/normalized version of the schema
  // useful to get predictable schemaPath properties in errors and to have proper handling of default values
  const skeletonTree = makeSkeletonTree(schema, options, validatePointers, normalizedLayouts, expressionsDefinitions, `${schema.$id}#`, 'main')

  const uriResolver = options.ajv.opts.uriResolver
  const validates: Record<string, ValidateFunction> = {}
  for (const pointer of validatePointers) {
    const fullPointer = uriResolver.resolve(schema.$id, pointer)
    validates[pointer] = options.ajv.compile({ $ref: fullPointer })
  }

  const expressions: CompiledExpression[] = []

  for (const expression of expressionsDefinitions) {
    if (expression.type === 'expr-eval') {
      expressions.push(exprEvalParser.parse(expression.expr).toJSFunction(expressionsParams.join(',')) as CompiledExpression)
    }
    if (expression.type === 'js-fn') {
      // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
      expressions.push(new Function(...expressionsParams, expression.expr) as CompiledExpression)
    }
    if (expression.type === 'js-eval') {
      // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
      expressions.push(new Function(...expressionsParams, 'return (' + expression.expr + ')') as CompiledExpression)
    }
    if (expression.type === 'js-tpl') {
      // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
      expressions.push(new Function(...expressionsParams, 'return `' + expression.expr + '`') as CompiledExpression)
    }
  }

  return { options, schema, skeletonTree, validates, normalizedLayouts, expressions }
}
