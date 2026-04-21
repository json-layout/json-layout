import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { insertProperty } from '../src/json/insert-property.js'

/**
 * Helper: apply an edit op to source text and return the resulting string.
 * @param {string} text
 * @param {{from: number, to: number, insert: string}} op
 * @returns {string}
 */
function apply (text, op) {
  return text.slice(0, op.from) + op.insert + text.slice(op.to)
}

describe('insertProperty', () => {
  it('inserts into an empty object on a single line', () => {
    const text = '{}'
    const op = insertProperty(text, '', 'greeting', 'hello')
    assert.equal(apply(text, op), '{"greeting": "hello"}')
  })

  it('appends to a single-line object with existing properties', () => {
    const text = '{"a": 1}'
    const op = insertProperty(text, '', 'b', 2)
    assert.equal(apply(text, op), '{"a": 1, "b": 2}')
  })

  it('appends to a multi-line object matching the indent of the first property', () => {
    const text = '{\n  "a": 1\n}'
    const op = insertProperty(text, '', 'b', 2)
    assert.equal(apply(text, op), '{\n  "a": 1,\n  "b": 2\n}')
  })

  it('appends inside a nested object', () => {
    const text = '{\n  "outer": {\n    "a": 1\n  }\n}'
    const op = insertProperty(text, '/outer', 'b', 2)
    assert.equal(apply(text, op), '{\n  "outer": {\n    "a": 1,\n    "b": 2\n  }\n}')
  })

  it('scaffolds a nested object value with matching indent', () => {
    const text = '{\n  "a": 1\n}'
    const op = insertProperty(text, '', 'nested', { x: 1, y: 2 })
    const result = apply(text, op)
    assert.equal(
      result,
      '{\n  "a": 1,\n  "nested": {\n    "x": 1,\n    "y": 2\n  }\n}'
    )
  })

  it('returns an empty insert for an unknown objectPath', () => {
    const text = '{"a": 1}'
    const op = insertProperty(text, '/missing', 'x', 1)
    assert.deepEqual(op, { from: 0, to: 0, insert: '' })
  })

  it('returns an empty insert when objectPath points to a non-object', () => {
    const text = '{"a": [1, 2]}'
    const op = insertProperty(text, '/a', 'x', 1)
    assert.deepEqual(op, { from: 0, to: 0, insert: '' })
  })
})
