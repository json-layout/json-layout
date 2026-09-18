/**
 * @file Compilation of schemas into layouts, cached across sessions.
 */

import { compile } from '@json-layout/core'

import { unwrapEnvelope } from './envelope.js'

/** @typedef {import('./types.js').LayoutSpec} LayoutSpec */
/** @typedef {import('@json-layout/core').CompiledLayout} CompiledLayout */

/**
 * Keyed by the `schema` function itself, so every session built on the same function
 * shares one compilation until the version that function reports changes. A new
 * closure gets its own entry, and dropping the function lets the entry be collected.
 * Inside an entry, one compilation per set of compile options: a locale or a message
 * override changes what `compile` produces, so sessions that differ there must not
 * share it.
 * @type {WeakMap<Function, { version: unknown, compiled: Map<string, CompiledLayout> }>}
 */
let cache = new WeakMap()

/**
 * Stable ids for the option values there is nothing to compare by value: an ajv
 * instance, a markdown renderer, a component implementation.
 * @type {WeakMap<object, string>}
 */
let identities = new WeakMap()
let nextIdentity = 0

/**
 * @param {object} value
 * @returns {string}
 */
function identityOf (value) {
  let identity = identities.get(value)
  if (identity === undefined) {
    identity = `#${nextIdentity++}`
    identities.set(value, identity)
  }
  return identity
}

/**
 * A key equal for two sets of compile options that compile to the same layout. Plain
 * objects and arrays are compared by content, so two sessions passing equal option
 * literals share one compilation; anything else is compared by identity, which is
 * conservative: a distinct ajv instance simply gets its own compilation.
 * @param {unknown} value
 * @returns {string}
 */
function optionsKey (value) {
  if (typeof value === 'function') return identityOf(value)
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'undefined'
  if (Array.isArray(value)) return `[${value.map(optionsKey).join(',')}]`
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) return identityOf(/** @type {object} */(value))
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${optionsKey(/** @type {any} */(value)[key])}`).join(',')}}`
}

/**
 * Compile a schema, or return the layout the consumer already holds. A schema
 * function that returns the same version twice is compiled once per set of compile
 * options.
 * @param {LayoutSpec} spec
 * @returns {Promise<CompiledLayout>}
 */
export async function resolveCompiledLayout (spec) {
  if (spec.layout) return spec.layout
  if (typeof spec.schema !== 'function') {
    throw new Error('a session needs either a compiled layout or a schema function')
  }
  const { value: schema, version } = unwrapEnvelope(await spec.schema(), 'schema')
  let entry = cache.get(spec.schema)
  // Equal versions include both being undefined: a function that reports no version
  // is treated as stable, which is what a test fixture or a bundled schema is. A new
  // version makes every compilation of that schema stale, whatever the options were.
  if (!entry || entry.version !== version) {
    entry = { version, compiled: new Map() }
    cache.set(spec.schema, entry)
  }
  const key = optionsKey(spec.compileOptions ?? {})
  const cached = entry.compiled.get(key)
  if (cached) return cached
  const compiled = compile(/** @type {object} */(schema), spec.compileOptions)
  entry.compiled.set(key, compiled)
  return compiled
}

/**
 * Drop every cached compilation.
 */
export function clearLayoutCache () {
  cache = new WeakMap()
  identities = new WeakMap()
}
