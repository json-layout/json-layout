import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { compile, StatefulLayout } from '../src/index.js'

const defaultOptions = { debounceInputMs: 0 }

describe('coerceTypes ajv option', () => {
  it('should coerce a scalar value into a single-element array', async () => {
    const compiledLayout = compile({
      type: 'object',
      properties: {
        tags: { type: 'array', items: { type: 'string' } }
      }
    }, { ajvOptions: { coerceTypes: 'array' } })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions)

    statefulLayout.data = { tags: 'single' }
    assert.deepEqual(statefulLayout.data, { tags: ['single'] })
    assert.ok(statefulLayout.valid)
  })

  it('should coerce a string to a number', async () => {
    const compiledLayout = compile({
      type: 'object',
      properties: {
        age: { type: 'integer' }
      }
    }, { ajvOptions: { coerceTypes: 'array' } })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions)

    statefulLayout.data = { age: '42' }
    assert.deepEqual(statefulLayout.data, { age: 42 })
    assert.ok(statefulLayout.valid)
  })

  it('should not coerce when the option is not set', async () => {
    const compiledLayout = compile({
      type: 'object',
      properties: {
        tags: { type: 'array', items: { type: 'string' } }
      }
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions)

    statefulLayout.data = { tags: 'single' }
    // without coercion, the data stays as-is and validation fails
    assert.deepEqual(statefulLayout.data, { tags: 'single' })
    assert.ok(!statefulLayout.valid)
  })

  it('should not trigger unnecessary re-iterations when data is already valid', async () => {
    const compiledLayout = compile({
      type: 'object',
      properties: {
        tags: { type: 'array', items: { type: 'string' } },
        name: { type: 'string' }
      }
    }, { ajvOptions: { coerceTypes: 'array' } })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions)

    // data is already correct types, no coercion needed
    statefulLayout.data = { tags: ['a', 'b'], name: 'test' }
    assert.deepEqual(statefulLayout.data, { tags: ['a', 'b'], name: 'test' })
    assert.ok(statefulLayout.valid)
  })
})
