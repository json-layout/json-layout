import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'

import { runChecks } from '../webmcp-eval/checks.js'

const one = (check, data, start = data) => runChecks([check], data, start)[0]

describe('runChecks', () => {
  it('equals passes on a matching value', () => {
    assert.equal(one({ path: '/a/b', equals: 'x' }, { a: { b: 'x' } }).ok, true)
  })

  it('equals fails quoting the actual value', () => {
    const r = one({ path: '/a/b', equals: 'x' }, { a: { b: 'y' } })
    assert.equal(r.ok, false)
    assert.match(r.detail, /"y"/)
  })

  it('equals fails with "missing" when the path does not exist', () => {
    const r = one({ path: '/a/c', equals: 'x' }, { a: { b: 'x' } })
    assert.equal(r.ok, false)
    assert.match(r.detail, /missing/)
  })

  it('equals keeps a leading zero string from matching a number', () => {
    assert.equal(one({ path: '/p', equals: '0612345678' }, { p: '0612345678' }).ok, true)
    assert.equal(one({ path: '/p', equals: '0612345678' }, { p: 612345678 }).ok, false)
  })

  it('equals matches an expected string to an actual number', () => {
    assert.equal(one({ path: '/c', equals: '44190' }, { c: 44190 }).ok, true)
  })

  it('values compares as a set, from an array or a split string', () => {
    const check = { path: '/t', values: ['a', 'b'] }
    assert.equal(one(check, { t: ['b', 'a', 'a'] }).ok, true)
    assert.equal(one(check, { t: 'a, b' }).ok, true)
    assert.equal(one({ ...check, separator: ';' }, { t: 'a;b' }).ok, true)
    assert.equal(one(check, { t: ['a'] }).ok, false)
  })

  it('unchangedExcept ignores excluded pointers and names the first other difference', () => {
    const start = { x: 1, y: 1 }
    assert.equal(one({ unchangedExcept: ['/x'] }, { x: 2, y: 1 }, start).ok, true)
    const r = one({ unchangedExcept: ['/x'] }, { x: 1, y: 2 }, start)
    assert.equal(r.ok, false)
    assert.match(r.detail, /\/y/)
  })

  it('unchangedExcept handles array item pointers', () => {
    const start = { list: ['a', 'b'] }
    const check = { unchangedExcept: ['/list/1'] }
    assert.equal(one(check, { list: ['a', 'B'] }, start).ok, true)
    assert.equal(one(check, { list: ['A', 'b'] }, start).ok, false)
  })

  it('contains passes when one item matches partially', () => {
    const data = { rows: [{ id: 1, n: { a: 1, b: 2 } }, { id: 2, n: { a: 3 } }] }
    assert.equal(one({ path: '/rows', contains: { id: 1, n: { a: 1 } } }, data).ok, true)
  })

  it('contains fails when no item matches', () => {
    const data = { rows: [{ id: 1 }, { id: 2 }] }
    assert.equal(one({ path: '/rows', contains: { id: 3 } }, data).ok, false)
  })

  it('contains fails with a detail when the path is not an array', () => {
    const r = one({ path: '/rows', contains: { id: 1 } }, { rows: { id: 1 } })
    assert.equal(r.ok, false)
    assert.match(r.detail, /not an array/)
  })

  it('reads own properties only', () => {
    assert.equal(one({ path: '/constructor', equals: Object }, {}).ok, false)
    assert.equal(one({ path: '/a/toString', equals: 'x' }, { a: {} }).detail, '/a/toString is missing')
    assert.equal(one({ path: '/list', contains: { constructor: Object } }, { list: [{}] }).ok, false)
  })

  it('absent passes on a missing key and a removed array tail', () => {
    assert.equal(one({ path: '/a/b', absent: true }, { a: {} }).ok, true)
    assert.equal(one({ path: '/list/2', absent: true }, { list: ['a', 'b'] }).ok, true)
  })

  it('absent fails quoting the value when present', () => {
    const r = one({ path: '/a', absent: true }, { a: 0 })
    assert.equal(r.ok, false)
    assert.equal(r.detail, 'got 0')
    assert.equal(r.label, '/a is absent')
  })

  it('length passes on the expected array length', () => {
    const r = one({ path: '/list', length: 2 }, { list: ['a', 'b'] })
    assert.equal(r.ok, true)
    assert.equal(r.label, '/list has length 2')
  })

  it('length fails with the actual length, or when not an array or missing', () => {
    assert.equal(one({ path: '/list', length: 2 }, { list: ['a'] }).detail, 'got length 1')
    assert.match(one({ path: '/list', length: 2 }, { list: 'ab' }).detail, /not an array/)
    assert.equal(one({ path: '/list', length: 0 }, {}).detail, '/list is missing')
  })
})
