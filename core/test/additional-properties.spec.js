import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { compile, StatefulLayout } from '../src/index.js'

describe('Management of additional properties', () => {
  it('should keep additional properties by default', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        str1: { type: 'string' }
      }
    })
    const statefulLayout = new StatefulLayout(
      compiledLayout, compiledLayout.skeletonTree,
      {},
      { str1: 'str1', str2: 'str2' }
    )
    assert.ok(statefulLayout.valid)
    assert.deepEqual(statefulLayout.data, { str1: 'str1', str2: 'str2' })
  })

  it('should remove additional property if it is rejected by the schema', async () => {
    const compiledLayout = await compile({
      type: 'object',
      additionalProperties: false,
      properties: {
        str1: { type: 'string' }
      }
    })
    const statefulLayout = new StatefulLayout(
      compiledLayout, compiledLayout.skeletonTree,
      {},
      { str1: 'str1', str2: 'str2' }
    )
    assert.ok(statefulLayout.valid)
    assert.deepEqual(statefulLayout.data, { str1: 'str1' })
  })

  it('should also remove property based on unevaluatedProperties keyword', async () => {
    const compiledLayout = await compile({
      type: 'object',
      unevaluatedProperties: false,
      properties: {
        str1: { type: 'string' }
      }
    })
    const statefulLayout = new StatefulLayout(
      compiledLayout, compiledLayout.skeletonTree,
      {},
      { str1: 'str1', str2: 'str2' }
    )
    assert.ok(statefulLayout.valid)
    assert.deepEqual(statefulLayout.data, { str1: 'str1' })
  })

  it('should remove additional property if option is activated', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        str1: { type: 'string' }
      }
    })
    const statefulLayout = new StatefulLayout(
      compiledLayout, compiledLayout.skeletonTree,
      { removeAdditional: 'unknown' },
      { str1: 'str1', str2: 'str2' }
    )
    assert.ok(statefulLayout.valid)
    assert.deepEqual(statefulLayout.data, { str1: 'str1' })
  })

  it('should not remove properties that are defined in a allOf', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        str1: { type: 'string' }
      },
      allOf: [{
        properties: {
          str2: { type: 'string' }
        }
      }]
    })
    const statefulLayout = new StatefulLayout(
      compiledLayout, compiledLayout.skeletonTree,
      { removeAdditional: 'unknown' },
      { str1: 'str1', str2: 'str2', str3: 'str3' }
    )
    assert.ok(statefulLayout.valid)
    assert.deepEqual(statefulLayout.data, { str1: 'str1', str2: 'str2' })
  })

  it('should not remove properties that are defined in a oneOf', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        str1: { type: 'string' }
      },
      oneOf: [{
        properties: {
          str2: { type: 'string' }
        }
      }]
    })
    const statefulLayout = new StatefulLayout(
      compiledLayout, compiledLayout.skeletonTree,
      { removeAdditional: 'unknown' },
      { str1: 'str1', str2: 'str2', str3: 'str3' }
    )
    assert.ok(statefulLayout.valid)
    assert.deepEqual(statefulLayout.data, { str1: 'str1', str2: 'str2' })
  })
})
