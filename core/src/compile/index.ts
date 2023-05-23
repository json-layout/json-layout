// compile is a soft wrapper around compileRaw
// the difference being that the result of compile is meant to be usable
// while the result of compileRaw is serializable

import { type SchemaObject } from 'json-schema-traverse'
import Ajv, { type ValidateFunction } from 'ajv'
import addFormats from 'ajv-formats'
import rfdc from 'rfdc'
// import Debug from 'debug'
import { type NormalizedLayout } from '@json-layout/vocabulary'
import { compileRaw, type LayoutTree } from './raw'

export * from './raw'
export * from './serialize'

const clone = rfdc()

// const debug = Debug('json-layout:compile')

export interface CompileOptions {
  ajv?: Ajv
}

export interface CompiledLayout {
  tree: LayoutTree
  validates: Record<string, ValidateFunction>
  normalizedLayouts: Record<string, NormalizedLayout>
}

export function compile (_schema: object, options: CompileOptions = {}): CompiledLayout {
  const schema = <SchemaObject>clone(_schema)

  let ajv = options.ajv
  if (!ajv) {
    ajv = new Ajv({ strict: false, allErrors: true })
    addFormats(ajv)
  }
  const uriResolver = ajv.opts.uriResolver

  const compiledRaw = compileRaw(schema, { ajv })
  if (!('$id' in schema)) {
    schema.$id = '_json_layout_main'
  }
  ajv.addSchema(schema)

  const validates: Record<string, ValidateFunction> = {}
  for (const pointer of compiledRaw.validates) {
    const fullPointer = uriResolver.resolve(schema.$id as string, pointer)
    validates[pointer] = ajv.compile({ $ref: fullPointer })
  }

  return {
    tree: compiledRaw.tree,
    normalizedLayouts: compiledRaw.normalizedLayouts,
    validates
  }
}
