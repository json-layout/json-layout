import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { compile } from '@json-layout/core'
import { getVariantCandidates } from '../../src/shared/completion/variant-candidates.js'

describe('getVariantCandidates', () => {
  it('returns one candidate per oneOf variant', async () => {
    const compiledLayout = await compile({
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
    const candidates = getVariantCandidates(compiledLayout, '/value')
    assert.equal(candidates.length, 2)
    assert.deepEqual(candidates.map(c => c.title), ['Alpha', 'Beta'])
    assert.deepEqual(candidates[0].value, { a: 'A' })
    assert.deepEqual(candidates[1].value, { b: 1 })
  })

  it('fills the discriminator property on each variant', async () => {
    const compiledLayout = await compile({
      type: 'object',
      required: ['value'],
      properties: {
        value: {
          discriminator: { propertyName: 'kind' },
          required: ['kind'],
          oneOf: [
            {
              title: 'Alpha',
              properties: { kind: { const: 'alpha' }, a: { type: 'string', default: 'A' } },
              required: ['a']
            },
            {
              title: 'Beta',
              properties: { kind: { const: 'beta' }, b: { type: 'integer', default: 2 } },
              required: ['b']
            }
          ]
        }
      }
    })
    const candidates = getVariantCandidates(compiledLayout, '/value')
    assert.equal(candidates.length, 2)
    const alpha = /** @type {any} */(candidates[0].value)
    const beta = /** @type {any} */(candidates[1].value)
    assert.equal(alpha.kind, 'alpha')
    assert.equal(alpha.a, 'A')
    assert.equal(beta.kind, 'beta')
    assert.equal(beta.b, 2)
  })

  it('returns [] for a node with no variant trees', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: { a: { type: 'string' } }
    })
    assert.deepEqual(getVariantCandidates(compiledLayout, '/a'), [])
    assert.deepEqual(getVariantCandidates(compiledLayout, ''), [])
  })

  it('returns [] for an unknown path', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: { a: { type: 'string' } }
    })
    assert.deepEqual(getVariantCandidates(compiledLayout, '/missing'), [])
  })
})
