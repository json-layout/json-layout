import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { jsonFormatAdapter } from '../src/json/adapter.js'
import * as publicBarrel from '../src/json/index.js'
import * as rootBarrel from '../src/index.js'

describe('jsonFormatAdapter', () => {
  it('exposes all five FormatAdapter methods', () => {
    assert.equal(typeof jsonFormatAdapter.parse, 'function')
    assert.equal(typeof jsonFormatAdapter.pathToRange, 'function')
    assert.equal(typeof jsonFormatAdapter.offsetToPath, 'function')
    assert.equal(typeof jsonFormatAdapter.scaffold, 'function')
    assert.equal(typeof jsonFormatAdapter.insertProperty, 'function')
  })

  it('round-trips a value via parse and pathToRange', () => {
    const text = '{"greeting": "hi"}'
    assert.deepEqual(jsonFormatAdapter.parse(text), { greeting: 'hi' })
    const range = jsonFormatAdapter.pathToRange(text, '/greeting')
    assert.ok(range)
    assert.equal(text.slice(range.from, range.to), '"hi"')
  })

  it('maps a cursor offset back to the path it came from', () => {
    const text = '{"greeting": "hi"}'
    const loc = jsonFormatAdapter.offsetToPath(text, 14) // inside "hi"
    assert.deepEqual(loc, { path: '/greeting', at: 'value' })
  })

  it('inserts a property that parses back as the requested object shape', () => {
    const text = '{"a": 1}'
    const op = jsonFormatAdapter.insertProperty(text, '', 'b', 2)
    const result = text.slice(0, op.from) + op.insert + text.slice(op.to)
    assert.deepEqual(jsonFormatAdapter.parse(result), { a: 1, b: 2 })
  })
})

describe('barrel exports', () => {
  it('exports jsonFormatAdapter and all five functions from @json-layout/code/json', () => {
    assert.equal(typeof publicBarrel.jsonFormatAdapter, 'object')
    assert.equal(typeof publicBarrel.parse, 'function')
    assert.equal(typeof publicBarrel.pathToRange, 'function')
    assert.equal(typeof publicBarrel.offsetToPath, 'function')
    assert.equal(typeof publicBarrel.scaffold, 'function')
    assert.equal(typeof publicBarrel.insertProperty, 'function')
  })

  it('forwards json/ exports through the root barrel', () => {
    assert.equal(typeof rootBarrel.jsonFormatAdapter, 'object')
    assert.equal(typeof rootBarrel.parse, 'function')
  })
})
