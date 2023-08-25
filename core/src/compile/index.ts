// compileStatic is meant to produce a serializable result

import rfdc from 'rfdc'
import { Parser as ExprEvalParser } from 'expr-eval'
import { type SchemaObject } from 'json-schema-traverse'
import Ajv, { type ValidateFunction, type Options as AjvOptions } from 'ajv'
import addFormats from 'ajv-formats'
import ajvErrors from 'ajv-errors'
import { type Expression, type NormalizedLayout } from '@json-layout/vocabulary'
import { makeSkeletonTree, type SkeletonTree } from './skeleton-tree'
import { type Display } from '../state/utils/display'

export type { SkeletonTree } from './skeleton-tree'
export type { SkeletonNode } from './skeleton-node'

export type CompiledExpression = (data: any, context: Record<string, any>, mode: string, display: Display) => any

export interface CompileOptions {
  ajv?: Ajv
  code?: boolean
}

export interface CompiledLayout {
  ajv?: Ajv
  schema?: SchemaObject
  skeletonTree: SkeletonTree
  validates: Record<string, ValidateFunction>
  normalizedLayouts: Record<string, NormalizedLayout>
  expressions: CompiledExpression[]
}

const expressionsParams = ['data', 'context', 'mode', 'display']

const clone = rfdc()
const exprEvalParser = new ExprEvalParser()

export function compile (_schema: object, options: CompileOptions = {}): CompiledLayout {
  const schema = <SchemaObject>clone(_schema)

  let ajv = options.ajv
  if (!ajv) {
    const ajvOpts: AjvOptions = { strict: false, allErrors: true }
    if (options.code) ajvOpts.code = { source: true, esm: true }
    ajv = new Ajv(ajvOpts)
    addFormats(ajv)
    ajvErrors(ajv)
  }
  if (!('$id' in schema)) {
    schema.$id = '_jl'
  }

  const validatePointers: string[] = []
  const normalizedLayouts: Record<string, NormalizedLayout> = {}
  const expressionsDefinitions: Expression[] = []

  // TODO: produce a resolved/normalized version of the schema
  // useful to get predictable schemaPath properties in errors and to have proper handling of default values
  const skeletonTree = makeSkeletonTree(schema, ajv, validatePointers, normalizedLayouts, expressionsDefinitions, `${schema.$id}#`, 'main')

  ajv.addSchema(schema)

  const uriResolver = ajv.opts.uriResolver
  const validates: Record<string, ValidateFunction> = {}
  for (const pointer of validatePointers) {
    const fullPointer = uriResolver.resolve(schema.$id as string, pointer)
    validates[pointer] = ajv.compile({ $ref: fullPointer })
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

  return { ajv, schema, skeletonTree, validates, normalizedLayouts, expressions }
}
