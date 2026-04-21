import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { scaffold } from '../src/json/scaffold.js'

describe('scaffold', () => {
  it('returns a single-line value unchanged', () => {
    assert.equal(scaffold('hello', { column: 0, unit: '  ' }), '"hello"')
    assert.equal(scaffold(42, { column: 0, unit: '  ' }), '42')
    assert.equal(scaffold(true, { column: 0, unit: '  ' }), 'true')
    assert.equal(scaffold(null, { column: 0, unit: '  ' }), 'null')
    assert.equal(scaffold([], { column: 0, unit: '  ' }), '[]')
    assert.equal(scaffold({}, { column: 0, unit: '  ' }), '{}')
  })

  it('pretty-prints an object at column 0 using the indent unit', () => {
    assert.equal(
      scaffold({ a: 1 }, { column: 0, unit: '  ' }),
      '{\n  "a": 1\n}'
    )
  })

  it('prefixes every line after the first with column spaces', () => {
    assert.equal(
      scaffold({ a: 1 }, { column: 4, unit: '  ' }),
      '{\n      "a": 1\n    }'
    )
  })

  it('handles nested objects with deeper indent', () => {
    assert.equal(
      scaffold({ outer: { inner: 'x' } }, { column: 2, unit: '  ' }),
      '{\n    "outer": {\n      "inner": "x"\n    }\n  }'
    )
  })

  it('handles arrays of values', () => {
    assert.equal(
      scaffold(['a', 'b'], { column: 2, unit: '  ' }),
      '[\n    "a",\n    "b"\n  ]'
    )
  })

  it('uses a tab unit', () => {
    assert.equal(
      scaffold({ a: 1 }, { column: 0, unit: '\t' }),
      '{\n\t"a": 1\n}'
    )
  })
})
