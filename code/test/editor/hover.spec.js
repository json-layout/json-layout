import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { EditorState } from '@codemirror/state'
import { compile } from '@json-layout/core'
import { computeHover } from '../../src/editor/hover.js'
import { compiledLayoutField } from '../../src/editor/compiled-layout-field.js'
import { jsonLayoutExtensions } from '../../src/editor/extensions.js'

/**
 * @param {string} doc
 * @param {unknown} schema
 */
async function stateFor (doc, schema) {
  const compiledLayout = await compile(/** @type {any} */(schema))
  return EditorState.create({
    doc,
    extensions: jsonLayoutExtensions(compiledLayout)
  })
}

describe('computeHover', () => {
  it('returns null when the state carries no compiled layout', () => {
    const state = EditorState.create({
      doc: '{}',
      extensions: [compiledLayoutField]
    })
    assert.equal(computeHover(state, 1), null)
  })

  it('returns a tooltip descriptor on a leaf with a title', async () => {
    const doc = '{"name": "Ada"}'
    const state = await stateFor(doc, {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          title: 'Full name',
          description: 'Given + family'
        }
      }
    })
    const tip = computeHover(state, 10)
    assert.ok(tip, 'expected a tooltip descriptor')
    assert.equal(typeof tip?.pos, 'number')
    assert.equal(tip?.above, true)
    assert.equal(typeof tip?.create, 'function')
  })

  it('returns null on a path with no authored title/description/help', async () => {
    const doc = '{"x": 1}'
    const state = await stateFor(doc, {
      type: 'object',
      properties: { x: { type: 'integer' } }
    })
    assert.equal(computeHover(state, 6), null)
  })

  it('returns a tooltip descriptor for a help-only leaf', async () => {
    const doc = '{"n": 1}'
    const state = await stateFor(doc, {
      type: 'object',
      properties: { n: { type: 'integer', layout: { help: 'Between 0 and 100' } } }
    })
    const tip = computeHover(state, 6)
    assert.ok(tip, 'help-only leaf should still produce a tooltip')
  })

  it('returns null when offset is outside any resolvable token', async () => {
    const state = await stateFor('garbage', {
      type: 'object',
      properties: { a: { type: 'string' } }
    })
    assert.equal(computeHover(state, 3), null)
  })
})
