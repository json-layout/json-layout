import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { compile, StatefulLayout } from '@json-layout/core'
import { getDynamicCandidates } from '../../src/shared/completion/dynamic-candidates.js'

const defaultOptions = { debounceInputMs: 0 }

describe('getDynamicCandidates', () => {
  it('returns candidates from an enum field', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        color: { type: 'string', enum: ['red', 'green', 'blue'] }
      }
    })
    const statefulLayout = new StatefulLayout(
      compiledLayout,
      compiledLayout.skeletonTrees[compiledLayout.mainTree],
      defaultOptions,
      { color: 'red' }
    )
    const items = await getDynamicCandidates(statefulLayout, '/color')
    assert.equal(items.length, 3)
    assert.deepEqual(items.map(i => i.value), ['red', 'green', 'blue'])
  })

  it('returns [] for an unknown path instead of throwing', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: { a: { type: 'string' } }
    })
    const statefulLayout = new StatefulLayout(
      compiledLayout,
      compiledLayout.skeletonTrees[compiledLayout.mainTree],
      defaultOptions,
      { a: 'x' }
    )
    const items = await getDynamicCandidates(statefulLayout, '/missing')
    assert.deepEqual(items, [])
  })

  it('forwards the optional query argument', async () => {
    // Validate only that the call shape accepts a query; the upstream tool
    // does the actual filtering for enum-backed nodes (no-op here).
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        color: { type: 'string', enum: ['red', 'green', 'blue'] }
      }
    })
    const statefulLayout = new StatefulLayout(
      compiledLayout,
      compiledLayout.skeletonTrees[compiledLayout.mainTree],
      defaultOptions,
      { color: 'red' }
    )
    const items = await getDynamicCandidates(statefulLayout, '/color', 'r')
    assert.ok(Array.isArray(items))
  })
})
