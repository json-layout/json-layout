import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { parse } from '../src/json/parser.js'

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
