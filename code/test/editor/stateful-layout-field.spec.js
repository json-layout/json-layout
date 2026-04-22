import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { EditorState } from '@codemirror/state'
import { compile, StatefulLayout } from '@json-layout/core'
import {
  statefulLayoutField,
  setStatefulLayoutEffect
} from '../../src/editor/stateful-layout-field.js'

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

describe('statefulLayoutField', () => {
  it('defaults to null when unconfigured', () => {
    const state = EditorState.create({ extensions: [statefulLayoutField] })
    assert.equal(state.field(statefulLayoutField), null)
  })

  it('initializes to a value via .init()', async () => {
    const sl = await newSL({ type: 'object', properties: { a: { type: 'string' } } }, { a: 'x' })
    const state = EditorState.create({
      extensions: [statefulLayoutField.init(() => sl)]
    })
    assert.equal(state.field(statefulLayoutField), sl)
  })

  it('updates when a transaction includes setStatefulLayoutEffect', async () => {
    const a = await newSL({ type: 'object', properties: { a: { type: 'string' } } }, { a: 'x' })
    const b = await newSL({ type: 'object', properties: { b: { type: 'integer' } } }, { b: 1 })
    const initial = EditorState.create({
      extensions: [statefulLayoutField.init(() => a)]
    })
    const next = initial.update({ effects: setStatefulLayoutEffect.of(b) }).state
    assert.equal(next.field(statefulLayoutField), b)
  })

  it('preserves the reference across unrelated transactions', async () => {
    const sl = await newSL({ type: 'object', properties: { a: { type: 'string' } } }, { a: 'x' })
    const state = EditorState.create({
      doc: '{}',
      extensions: [statefulLayoutField.init(() => sl)]
    })
    const after = state.update({ changes: { from: 0, to: 0, insert: ' ' } }).state
    assert.equal(after.field(statefulLayoutField), sl)
  })
})
