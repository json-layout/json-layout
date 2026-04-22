import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { EditorState } from '@codemirror/state'
import { compile, StatefulLayout } from '@json-layout/core'
import { computeDynamicCompletions } from '../../src/editor/completion.js'
import { compiledLayoutField } from '../../src/editor/compiled-layout-field.js'
import { statefulLayoutField } from '../../src/editor/stateful-layout-field.js'

const defaultOptions = { debounceInputMs: 0, initialValidation: 'always' }

/**
 * @param {string} doc
 * @param {unknown} schema
 * @param {unknown} data
 */
async function stateFor (doc, schema, data) {
  const compiled = await compile(/** @type {any} */(schema))
  const sl = new StatefulLayout(
    compiled,
    compiled.skeletonTrees[compiled.mainTree],
    defaultOptions,
    data
  )
  return EditorState.create({
    doc,
    extensions: [
      compiledLayoutField.init(() => compiled),
      statefulLayoutField.init(() => sl)
    ]
  })
}

describe('computeDynamicCompletions', () => {
  it('returns null when no StatefulLayout is on the state', async () => {
    const compiled = await compile({ type: 'object', properties: { a: { type: 'string' } } })
    const state = EditorState.create({
      doc: '{"a": ""}',
      extensions: [compiledLayoutField.init(() => compiled), statefulLayoutField]
    })
    const result = await computeDynamicCompletions(state, 8)
    assert.equal(result, null)
  })

  it('returns candidates at a value position with a getItems enum', async () => {
    const schema = {
      type: 'object',
      properties: {
        color: {
          type: 'string',
          enum: ['red', 'green', 'blue']
        }
      }
    }
    const state = await stateFor('{"color": ""}', schema, { color: '' })
    // pos 11 is inside the empty string value.
    const result = await computeDynamicCompletions(state, 11)
    assert.ok(result, 'expected a completion result for the getItems field')
    const labels = result.options.map((o) => o.label).sort()
    assert.deepEqual(labels, ['blue', 'green', 'red'])
  })

  it('returns null at a key position', async () => {
    const schema = {
      type: 'object',
      properties: {
        color: { type: 'string', enum: ['red'] }
      }
    }
    const state = await stateFor('{"": ""}', schema, {})
    // pos 2 is inside the empty key.
    const result = await computeDynamicCompletions(state, 2)
    assert.equal(result, null)
  })

  it('returns null when the path has no getItems', async () => {
    const schema = {
      type: 'object',
      properties: { plain: { type: 'string' } }
    }
    const state = await stateFor('{"plain": ""}', schema, { plain: '' })
    const result = await computeDynamicCompletions(state, 11)
    assert.equal(result, null)
  })
})
