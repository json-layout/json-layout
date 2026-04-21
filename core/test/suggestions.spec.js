import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { compile, StatefulLayout } from '../src/index.js'
import { getFieldSuggestions } from '../src/utils/suggestions.js'

const defaultOptions = { debounceInputMs: 0 }

describe('getFieldSuggestions', () => {
  it('returns enum items for a select-style leaf', async () => {
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
    const result = await getFieldSuggestions(statefulLayout, { path: '/color' })
    assert.ok(Array.isArray(result.items))
    assert.equal(result.items.length, 3)
    assert.deepEqual(result.items.map(i => i.value), ['red', 'green', 'blue'])
  })

  it('throws when path is unknown', async () => {
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
    await assert.rejects(
      getFieldSuggestions(statefulLayout, { path: '/missing' }),
      /node not found at path: \/missing/
    )
  })
})
