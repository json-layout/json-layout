import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { EditorState } from '@codemirror/state'
import { compile } from '@json-layout/core'
import { compiledLayoutField, setCompiledLayoutEffect } from '../../src/editor/compiled-layout-field.js'

describe('compiledLayoutField', () => {
  it('defaults to null when unconfigured', () => {
    const state = EditorState.create({
      extensions: [compiledLayoutField]
    })
    assert.equal(state.field(compiledLayoutField), null)
  })

  it('initializes to a value via .init()', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: { a: { type: 'string' } }
    })
    const state = EditorState.create({
      extensions: [compiledLayoutField.init(() => compiledLayout)]
    })
    assert.equal(state.field(compiledLayoutField), compiledLayout)
  })

  it('updates when a transaction includes setCompiledLayoutEffect', async () => {
    const a = await compile({ type: 'object', properties: { a: { type: 'string' } } })
    const b = await compile({ type: 'object', properties: { b: { type: 'integer' } } })
    const initial = EditorState.create({
      extensions: [compiledLayoutField.init(() => a)]
    })
    const next = initial.update({ effects: setCompiledLayoutEffect.of(b) }).state
    assert.equal(next.field(compiledLayoutField), b)
  })

  it('preserves the value across unrelated transactions', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: { a: { type: 'string' } }
    })
    const state = EditorState.create({
      doc: '{}',
      extensions: [compiledLayoutField.init(() => compiledLayout)]
    })
    const after = state.update({ changes: { from: 0, to: 0, insert: ' ' } }).state
    assert.equal(after.field(compiledLayoutField), compiledLayout)
  })
})
