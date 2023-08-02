// compile is a soft wrapper around compileRaw
// the difference being that the result of compile is meant to be usable
// while the result of compileRaw is serializable

import { type SchemaObject } from 'json-schema-traverse'
import Ajv, { type ValidateFunction } from 'ajv'
import addFormats from 'ajv-formats'
import ajvErrors from 'ajv-errors'
import rfdc from 'rfdc'
import { Parser as ExprEvalParser } from 'expr-eval'
import { freeze } from 'immer'

// import Debug from 'debug'
import { type NormalizedLayout } from '@json-layout/vocabulary'
import { compileRaw, type LayoutTree } from './raw'

export * from './raw'
export * from './serialize'

const clone = rfdc()

const exprEvalParser = new ExprEvalParser()

// const debug = Debug('json-layout:compile')

export interface CompileOptions {
  ajv?: Ajv
}

export interface CompiledExpressions {
  'expr-eval': Record<string, CompiledExpression>
  'js-fn': Record<string, CompiledExpression>
}

export interface CompiledLayout {
  tree: LayoutTree
  validates: Record<string, ValidateFunction>
  normalizedLayouts: Record<string, NormalizedLayout>
  expressions: CompiledExpressions
}

export type CompiledExpression = (mode: string) => any
const expressionsParams = ['mode']

export function compile (_schema: object, options: CompileOptions = {}): CompiledLayout {
  const schema = <SchemaObject>clone(_schema)

  let ajv = options.ajv
  if (!ajv) {
    ajv = new Ajv({ strict: false, allErrors: true })
    addFormats(ajv)
    ajvErrors(ajv)
  }
  const uriResolver = ajv.opts.uriResolver

  const compiledRaw = compileRaw(schema, { ajv })
  if (!('$id' in schema)) {
    schema.$id = '_jl'
  }
  ajv.addSchema(schema)

  const validates: Record<string, ValidateFunction> = {}
  for (const pointer of compiledRaw.validates) {
    const fullPointer = uriResolver.resolve(schema.$id as string, pointer)
    validates[pointer] = ajv.compile({ $ref: fullPointer })
  }

  const expressions: CompiledExpressions = { 'expr-eval': {}, 'js-fn': {} }

  for (const expression of compiledRaw.expressions) {
    if (expression.type === 'expr-eval') {
      expressions['expr-eval'][expression.expr] = exprEvalParser.parse(expression.expr).toJSFunction(expressionsParams.join(',')) as CompiledExpression
    }
    if (expression.type === 'js-fn') {
      // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
      expressions['js-fn'][expression.expr] = new Function(...expressionsParams, expression.expr) as CompiledExpression
    }
  }

  return freeze({
    tree: compiledRaw.tree,
    normalizedLayouts: compiledRaw.normalizedLayouts,
    validates,
    expressions
  })
}
