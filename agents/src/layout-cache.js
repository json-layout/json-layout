/**
 * @file Compilation of schemas into layouts, cached across sessions.
 */

import { compile } from '@json-layout/core'

import { unwrapEnvelope } from './envelope.js'

/** @typedef {import('@json-layout/core').CompiledLayout} CompiledLayout */
/** @typedef {import('@json-layout/core').PartialCompileOptions} PartialCompileOptions */

/**
 * Keyed by the `schema` function itself, so every session built on the same function
 * shares one compilation until the version that function reports changes. A new
 * closure gets its own entry, and dropping the function lets the entry be collected.
 * @type {WeakMap<Function, { version: unknown, compiled: CompiledLayout }>}
 */
let cache = new WeakMap()

/**
 * Compile a schema, or return the layout the consumer already holds. A schema
 * function that returns the same version twice is compiled once.
 * @param {object} spec
 * @param {CompiledLayout} [spec.layout] - already compiled; wins over `schema`
 * @param {() => unknown} [spec.schema] - returns a schema, or `{ schema, version }`
 * @param {PartialCompileOptions} [spec.compileOptions]
 * @returns {Promise<CompiledLayout>}
 */
export async function resolveCompiledLayout (spec) {
  if (spec.layout) return spec.layout
  if (typeof spec.schema !== 'function') {
    throw new Error('a session needs either a compiled layout or a schema function')
  }
  const { value: schema, version } = unwrapEnvelope(await spec.schema(), 'schema')
  const cached = cache.get(spec.schema)
  // Equal versions include both being undefined: a function that reports no version
  // is treated as stable, which is what a test fixture or a bundled schema is.
  if (cached && cached.version === version) return cached.compiled
  const compiled = compile(schema, spec.compileOptions)
  cache.set(spec.schema, { version, compiled })
  return compiled
}

/**
 * Drop every cached compilation.
 */
export function clearLayoutCache () {
  cache = new WeakMap()
}
