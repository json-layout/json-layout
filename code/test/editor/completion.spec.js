import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { EditorState } from '@codemirror/state'
import { compile } from '@json-layout/core'
import { computeCompletions } from '../../src/editor/completion.js'
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

describe('computeCompletions', () => {
  it('returns null when no compiled layout is on the state', () => {
    const state = EditorState.create({
      doc: '{}',
      extensions: [compiledLayoutField]
    })
    assert.equal(computeCompletions(state, 1, true), null)
  })

  it('returns enum value candidates at a value position', async () => {
    const doc = '{"color": ""}'
    const state = await stateFor(doc, {
      type: 'object',
      properties: { color: { type: 'string', enum: ['red', 'green', 'blue'] } }
    })
    const result = computeCompletions(state, 11, false)
    assert.ok(result, 'expected completions at /color value position')
    const labels = result.options.map((o) => o.label)
    assert.deepEqual(labels, ['red', 'green', 'blue'])
  })

  it('returns property-name candidates at a key position', async () => {
    const doc = '{"":""}'
    const state = await stateFor(doc, {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string' },
        age: { type: 'integer' }
      }
    })
    const result = computeCompletions(state, 2, false)
    assert.ok(result, 'expected completions at key position')
    const labels = result.options.map((o) => o.label).sort()
    assert.deepEqual(labels, ['age', 'name'])
  })

  it('returns property-name candidates at a structural position in an empty object', async () => {
    const doc = '{ }'
    const state = await stateFor(doc, {
      type: 'object',
      properties: { a: { type: 'string' } }
    })
    const result = computeCompletions(state, 1, false)
    assert.ok(result, 'expected completions at structural position')
    const labels = result.options.map((o) => o.label)
    assert.deepEqual(labels, ['a'])
  })

  it('returns variant candidates at a oneOf value position', async () => {
    const doc = '{"value": {}}'
    const state = await stateFor(doc, {
      type: 'object',
      required: ['value'],
      properties: {
        value: {
          oneOf: [
            { title: 'Alpha', type: 'object', required: ['a'], properties: { a: { type: 'string', default: 'A' } } },
            { title: 'Beta', type: 'object', required: ['b'], properties: { b: { type: 'integer', default: 1 } } }
          ]
        }
      }
    })
    const result = computeCompletions(state, 11, false)
    assert.ok(result, 'expected variant candidates at /value position')
    const titles = result.options.map((o) => o.label)
    assert.ok(titles.includes('Alpha'))
    assert.ok(titles.includes('Beta'))
  })

  it('filters out existing keys at a key position', async () => {
    const doc = '{"a": 1, "": 2}'
    const state = await stateFor(doc, {
      type: 'object',
      properties: {
        a: { type: 'string' },
        b: { type: 'integer' }
      }
    })
    const result = computeCompletions(state, 10, false)
    assert.ok(result, 'expected completions at key position')
    const labels = result.options.map((o) => o.label)
    assert.deepEqual(labels, ['b'])
  })

  it('returns null when offsetToPath yields no actionable position', async () => {
    const compiledLayout = await compile({ type: 'object', properties: { a: { type: 'string' } } })
    const state = EditorState.create({
      doc: 'total garbage',
      extensions: jsonLayoutExtensions(compiledLayout)
    })
    const result = computeCompletions(state, 5, false)
    assert.equal(result, null)
  })

  it('places the completion range INSIDE the string quotes with bare apply text', async () => {
    const doc = '{"color": ""}'
    const state = await stateFor(doc, {
      type: 'object',
      properties: { color: { type: 'string', enum: ['red', 'green', 'blue'] } }
    })
    // Cursor between the two value quotes.
    const result = computeCompletions(state, 11, false)
    assert.ok(result, 'expected completions at /color value position')
    // Range must start AFTER the opening quote (offset 11), not on it (10) -
    // otherwise CM filters every candidate against the query '"'.
    assert.equal(result.from, 11)
    assert.equal(result.to, 11)
    const red = result.options.find((o) => o.label === 'red')
    assert.ok(red, 'red candidate missing')
    // Inside a string the apply text is the bare value, not a JSON literal.
    assert.equal(red.apply, 'red')
  })

  it('places range correctly when cursor is mid-word inside a string value', async () => {
    const doc = '{"color": "re"}'
    const state = await stateFor(doc, {
      type: 'object',
      properties: { color: { type: 'string', enum: ['red', 'green', 'blue'] } }
    })
    const result = computeCompletions(state, 13, false) // cursor after "re"
    assert.ok(result)
    assert.equal(result.from, 11)
    assert.equal(result.to, 13)
    assert.equal(result.options.find((o) => o.label === 'red')?.apply, 'red')
  })

  it('property candidates scaffold default values in their apply text', async () => {
    const doc = '{}'
    const state = await stateFor(doc, {
      type: 'object',
      properties: {
        cfg: {
          type: 'object',
          required: ['enabled'],
          properties: { enabled: { type: 'boolean', default: true } }
        }
      }
    })
    const result = computeCompletions(state, 1, false)
    assert.ok(result)
    const cfg = result.options.find((o) => o.label === 'cfg')
    assert.ok(cfg, 'cfg candidate missing')
    const applyText = typeof cfg.apply === 'string' ? cfg.apply : ''
    assert.ok(applyText.includes('"cfg"'), `apply missing key: ${applyText}`)
    assert.ok(applyText.includes('"enabled"'), `apply missing scaffolded child: ${applyText}`)
    assert.ok(applyText.includes('true'), `apply missing scaffolded value: ${applyText}`)
  })
})
