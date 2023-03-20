/*
TODO:
  - traverse json schema
  - create a normalized layout keyword for each level based on schema and optional layout annotation
  - validate the normalized layout (json schema + custom assertion like the fact the the children keys match reality)
  - compile all partial schemas necessary for the stateful layout
  - optionally suggest serializing the result to js, serialization would include (serialization could also include types compiled from the schema)
*/

import { type SchemaObject } from 'json-schema-traverse'
import type traverse from 'json-schema-traverse'
import Ajv, { type ValidateFunction } from 'ajv'
import addFormats from 'ajv-formats'
import rfdc from 'rfdc'
// import Debug from 'debug'
import { type NormalizedLayout } from '../normalized-layout'
import { compileRaw } from './compile-raw'

const clone = rfdc()

// const debug = Debug('json-layout:compile')

export interface CompileOptions {
  ajv?: Ajv
}

export interface StatefulLayoutSkeleton {
  key: string
  layout: string // reference to a layout object in the normalizedLayouts store
  validate?: string // optional reference to a validate function in the validates store
  children?: StatefulLayoutSkeleton[]
  item?: StatefulLayoutSkeleton
}

export interface CompiledLayout {
  skeleton: StatefulLayoutSkeleton
  validates: Record<string, ValidateFunction>
  normalizedLayouts: Record<string, NormalizedLayout>
}

export function compile (_schema: object, options: CompileOptions = {}): CompiledLayout {
  const schema = <SchemaObject>clone(_schema)

  let ajv = options.ajv
  if (!ajv) {
    ajv = new Ajv({ strict: false })
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
    skeleton: compiledRaw.skeleton,
    normalizedLayouts: compiledRaw.normalizedLayouts,
    validates
  }
}
