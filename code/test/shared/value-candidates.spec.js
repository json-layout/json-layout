import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { compile, lookupNormalizedLayout } from '@json-layout/core'
import { getValueCandidates } from '../../src/shared/completion/value-candidates.js'

describe('getValueCandidates', () => {
  it('returns candidates from an enum', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        color: { type: 'string', enum: ['red', 'green', 'blue'] }
      }
    })
    const layout = lookupNormalizedLayout(compiledLayout, '/color')
    const items = getValueCandidates(layout)
    assert.equal(items.length, 3)
    assert.deepEqual(items.map(i => i.value), ['red', 'green', 'blue'])
    assert.ok(items.every(i => typeof i.title === 'string'))
  })

  it('returns candidates from oneOf const values', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        level: {
          type: 'string',
          oneOf: [
            { const: 'low', title: 'Low' },
            { const: 'high', title: 'High' }
          ]
        }
      }
    })
    const layout = lookupNormalizedLayout(compiledLayout, '/level')
    const items = getValueCandidates(layout)
    assert.deepEqual(items.map(i => i.value), ['low', 'high'])
    assert.deepEqual(items.map(i => i.title), ['Low', 'High'])
  })

  it('returns an empty array for a layout without items', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        name: { type: 'string' }
      }
    })
    const layout = lookupNormalizedLayout(compiledLayout, '/name')
    assert.deepEqual(getValueCandidates(layout), [])
  })

  it('returns an empty array when passed undefined', () => {
    assert.deepEqual(getValueCandidates(undefined), [])
  })

  it('skips header entries', () => {
    const fakeLayout = /** @type {any} */({
      items: [
        { header: true, title: 'Group 1' },
        { value: 'a', title: 'A', key: 'a' },
        { header: true, title: 'Group 2' },
        { value: 'b', title: 'B', key: 'b' }
      ]
    })
    const items = getValueCandidates(fakeLayout)
    assert.equal(items.length, 2)
    assert.deepEqual(items.map(i => i.value), ['a', 'b'])
  })
})
