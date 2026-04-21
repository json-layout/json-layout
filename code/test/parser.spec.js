import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { parse, pathToRange } from '../src/json/parser.js'

describe('parse', () => {
  it('parses a primitive value', () => {
    assert.equal(parse('42'), 42)
    assert.equal(parse('"hello"'), 'hello')
    assert.equal(parse('true'), true)
    assert.equal(parse('null'), null)
  })

  it('parses an object', () => {
    assert.deepEqual(parse('{"a":1,"b":"two"}'), { a: 1, b: 'two' })
  })

  it('parses an array', () => {
    assert.deepEqual(parse('[1,2,3]'), [1, 2, 3])
  })

  it('throws SyntaxError on invalid JSON', () => {
    assert.throws(() => parse('{not valid}'), SyntaxError)
  })
})

describe('pathToRange', () => {
  it('returns the whole-document range for root path', () => {
    const text = '{"a":1}'
    assert.deepEqual(pathToRange(text, ''), { from: 0, to: 7 })
    assert.deepEqual(pathToRange(text, '/'), { from: 0, to: 7 })
  })

  it('resolves an object property value', () => {
    const text = '{"a":1,"b":"two"}'
    assert.deepEqual(pathToRange(text, '/a'), { from: 5, to: 6 })
    assert.deepEqual(pathToRange(text, '/b'), { from: 11, to: 16 })
  })

  it('resolves a nested property', () => {
    const text = '{"outer":{"inner":42}}'
    assert.deepEqual(pathToRange(text, '/outer/inner'), { from: 18, to: 20 })
  })

  it('resolves an array index', () => {
    const text = '["a","b","c"]'
    assert.deepEqual(pathToRange(text, '/0'), { from: 1, to: 4 })
    assert.deepEqual(pathToRange(text, '/2'), { from: 9, to: 12 })
  })

  it('resolves an object inside an array', () => {
    const text = '[{"a":1},{"b":2}]'
    assert.deepEqual(pathToRange(text, '/1/b'), { from: 14, to: 15 })
  })

  it('returns null for unknown path', () => {
    const text = '{"a":1}'
    assert.equal(pathToRange(text, '/missing'), null)
    assert.equal(pathToRange(text, '/a/deep'), null)
  })

  it('returns null for non-JSON text', () => {
    assert.equal(pathToRange('not json', ''), null)
  })

  it('handles whitespace between tokens', () => {
    const text = '{\n  "a": 1,\n  "b": 2\n}'
    const range = pathToRange(text, '/b')
    assert.ok(range)
    assert.equal(text.slice(range.from, range.to), '2')
  })
})
