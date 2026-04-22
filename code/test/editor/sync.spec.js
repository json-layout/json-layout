import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { EditorState } from '@codemirror/state'
import { compile, StatefulLayout } from '@json-layout/core'
import { jsonFormatAdapter } from '../../src/json/adapter.js'
import { compiledLayoutField } from '../../src/editor/compiled-layout-field.js'
import { statefulLayoutField } from '../../src/editor/stateful-layout-field.js'
import { syncStatefulLayoutData, runCommittedSync } from '../../src/editor/sync.js'
import { setDiagnosticsEffect } from '@codemirror/lint'

const defaultOptions = { debounceInputMs: 0, initialValidation: 'always' }

/**
 * @param {unknown} schema
 * @param {unknown} data
 */
async function newSL (schema, data) {
  const compiled = await compile(/** @type {any} */(schema))
  return new StatefulLayout(
    compiled,
    compiled.skeletonTrees[compiled.mainTree],
    defaultOptions,
    data
  )
}

describe('syncStatefulLayoutData', () => {
  it('assigns parsed data on success and returns true', async () => {
    const sl = await newSL({ type: 'object', properties: { name: { type: 'string' } } }, { name: 'old' })
    const ok = syncStatefulLayoutData(sl, jsonFormatAdapter, '{"name": "new"}')
    assert.equal(ok, true)
    assert.deepEqual(sl.data, { name: 'new' })
  })

  it('returns false and leaves data unchanged on parse error', async () => {
    const sl = await newSL({ type: 'object', properties: { name: { type: 'string' } } }, { name: 'frozen' })
    const before = sl.data
    const ok = syncStatefulLayoutData(sl, jsonFormatAdapter, '{"name": frozen')
    assert.equal(ok, false)
    assert.deepEqual(sl.data, before)
  })
})

describe('runCommittedSync', () => {
  /**
   * @param {string} doc
   * @param {any} compiledLayout
   * @param {any} sl
   */
  function makeState (doc, compiledLayout, sl) {
    return EditorState.create({
      doc,
      extensions: [
        compiledLayoutField.init(() => compiledLayout),
        ...(sl ? [statefulLayoutField.init(() => sl)] : [statefulLayoutField])
      ]
    })
  }

  it('is a no-op when no StatefulLayout is on the state', async () => {
    const compiled = await compile({ type: 'object', properties: { a: { type: 'string' } } })
    const state = makeState('{"a": "x"}', compiled, null)
    /** @type {any[]} */
    const dispatched = []
    runCommittedSync(state, (tr) => dispatched.push(tr))
    assert.equal(dispatched.length, 0)
  })

  it('dispatches setDiagnostics with schema errors on valid JSON', async () => {
    const compiled = await compile({
      type: 'object',
      properties: { age: { type: 'integer', minimum: 0 } }
    })
    const sl = new StatefulLayout(
      compiled,
      compiled.skeletonTrees[compiled.mainTree],
      defaultOptions,
      { age: 0 }
    )
    const state = makeState('{"age": -1}', compiled, sl)
    /** @type {any[]} */
    const dispatched = []
    runCommittedSync(state, (tr) => dispatched.push(tr))
    assert.equal(dispatched.length, 1)
    const effects = /** @type {any} */(dispatched[0]).effects
    const setDiagEffect = Array.isArray(effects)
      ? effects.find((e) => e.is(setDiagnosticsEffect))
      : (effects && effects.is(setDiagnosticsEffect) ? effects : null)
    assert.ok(setDiagEffect, 'expected a setDiagnosticsEffect in the dispatched transaction')
    assert.ok(setDiagEffect.value.length >= 1, 'expected at least one diagnostic')
    assert.equal(setDiagEffect.value[0].severity, 'error')
  })

  it('dispatches setDiagnostics with [] when data is valid', async () => {
    const compiled = await compile({
      type: 'object',
      properties: { name: { type: 'string' } }
    })
    const sl = new StatefulLayout(
      compiled,
      compiled.skeletonTrees[compiled.mainTree],
      defaultOptions,
      { name: 'ok' }
    )
    const state = makeState('{"name": "ok"}', compiled, sl)
    /** @type {any[]} */
    const dispatched = []
    runCommittedSync(state, (tr) => dispatched.push(tr))
    assert.equal(dispatched.length, 1)
    const effects = /** @type {any} */(dispatched[0]).effects
    const setDiagEffect = Array.isArray(effects)
      ? effects.find((e) => e.is(setDiagnosticsEffect))
      : (effects && effects.is(setDiagnosticsEffect) ? effects : null)
    assert.ok(setDiagEffect)
    assert.deepEqual(setDiagEffect.value, [])
  })

  it('does not dispatch on parse error (freeze-at-last-good)', async () => {
    const compiled = await compile({ type: 'object', properties: { a: { type: 'string' } } })
    const sl = new StatefulLayout(
      compiled,
      compiled.skeletonTrees[compiled.mainTree],
      defaultOptions,
      { a: 'frozen' }
    )
    const state = makeState('{"a": frozen', compiled, sl)
    /** @type {any[]} */
    const dispatched = []
    runCommittedSync(state, (tr) => dispatched.push(tr))
    assert.equal(dispatched.length, 0)
    assert.deepEqual(sl.data, { a: 'frozen' })
  })
})
