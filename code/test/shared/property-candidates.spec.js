import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { compile } from '@json-layout/core'
import { getPropertyCandidates } from '../../src/shared/completion/property-candidates.js'

describe('getPropertyCandidates', () => {
  it('returns one candidate per property with required flag', async () => {
    const compiledLayout = await compile({
      type: 'object',
      required: ['a'],
      properties: {
        a: { type: 'string', title: 'A title' },
        b: { type: 'integer', description: 'B desc' }
      }
    })
    const candidates = getPropertyCandidates(compiledLayout, '')
    assert.equal(candidates.length, 2)

    const a = candidates.find(c => c.key === 'a')
    assert.ok(a)
    assert.equal(a?.required, true)
    assert.equal(a?.title, 'A title')

    const b = candidates.find(c => c.key === 'b')
    assert.ok(b)
    assert.equal(b?.required, false)
    assert.equal(b?.description, 'B desc')
  })

  it('orders required properties before optional ones, then alphabetically', async () => {
    const compiledLayout = await compile({
      type: 'object',
      required: ['zeta', 'alpha'],
      properties: {
        beta: { type: 'string' },
        alpha: { type: 'string' },
        zeta: { type: 'string' },
        delta: { type: 'string' }
      }
    })
    const candidates = getPropertyCandidates(compiledLayout, '')
    assert.deepEqual(candidates.map(c => c.key), ['alpha', 'zeta', 'beta', 'delta'])
  })

  it('filters out existingKeys', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: { a: { type: 'string' }, b: { type: 'integer' } }
    })
    const candidates = getPropertyCandidates(compiledLayout, '', ['a'])
    assert.deepEqual(candidates.map(c => c.key), ['b'])
  })

  it('resolves a nested object path', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        outer: {
          type: 'object',
          required: ['inner'],
          properties: { inner: { type: 'string', default: 'x' } }
        }
      }
    })
    const candidates = getPropertyCandidates(compiledLayout, '/outer')
    assert.equal(candidates.length, 1)
    assert.equal(candidates[0].key, 'inner')
    assert.equal(candidates[0].required, true)
    assert.equal(candidates[0].defaultValue, 'x')
  })

  it('uses scaffoldDefault for each property defaultValue', async () => {
    const compiledLayout = await compile({
      type: 'object',
      required: ['nested'],
      properties: {
        nested: {
          type: 'object',
          required: ['inner'],
          properties: { inner: { type: 'string', default: 'v' } }
        }
      }
    })
    const candidates = getPropertyCandidates(compiledLayout, '')
    const nested = candidates.find(c => c.key === 'nested')
    assert.ok(nested)
    assert.deepEqual(nested?.defaultValue, { inner: 'v' })
  })

  it('returns [] when path does not resolve to an object node', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: { a: { type: 'string' } }
    })
    assert.deepEqual(getPropertyCandidates(compiledLayout, '/missing'), [])
    assert.deepEqual(getPropertyCandidates(compiledLayout, '/a'), [])
  })

  it('ignores skeleton children whose key is internal (starts with $)', async () => {
    // oneOf under a property creates $ref-shaped internal skeleton children;
    // the caller of getPropertyCandidates should never see them surfaced as
    // real property names.
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        value: {
          oneOf: [
            { type: 'object', properties: { a: { type: 'string' } } },
            { type: 'object', properties: { b: { type: 'integer' } } }
          ]
        }
      }
    })
    const candidates = getPropertyCandidates(compiledLayout, '')
    const keys = candidates.map(c => c.key)
    assert.ok(!keys.some(k => k.startsWith('$')), `unexpected internal keys: ${JSON.stringify(keys)}`)
  })
})
