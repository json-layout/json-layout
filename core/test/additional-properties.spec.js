import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { compile, StatefulLayout } from '../src/index.js'

describe('Management of additional properties', () => {
  const defaultOptions = { debounceInputMs: 0 }

  it('should keep additional properties by default', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        str1: { type: 'string' }
      }
    })
    const statefulLayout = new StatefulLayout(
      compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree],
      defaultOptions,
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
      compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree],
      defaultOptions,
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
      compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree],
      defaultOptions,
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
      compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree],
      { ...defaultOptions, removeAdditional: 'unknown' },
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
      compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree],
      { ...defaultOptions, removeAdditional: 'unknown' },
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
      compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree],
      { ...defaultOptions, removeAdditional: 'unknown' },
      { str1: 'str1', str2: 'str2', str3: 'str3' }
    )
    assert.ok(statefulLayout.valid)
    assert.deepEqual(statefulLayout.data, { str1: 'str1', str2: 'str2' })
  })

  it('should support different values of removeAdditional option on different parts of the schema', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        obj1: {
          type: 'object',
          properties: {
            str1: { type: 'string' }
          }
        },
        obj2: {
          type: 'object',
          layout: {
            removeAdditional: false
          },
          properties: {
            str1: { type: 'string' }
          }
        }
      }
    })
    const statefulLayout = new StatefulLayout(
      compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree],
      { ...defaultOptions, removeAdditional: 'unknown' },
      { obj1: { str1: 'str1', str2: 'str2' }, obj2: { str1: 'str1', str2: 'str2' } }
    )
    assert.ok(statefulLayout.valid)
    assert.deepEqual(statefulLayout.data, { obj1: { str1: 'str1' }, obj2: { str1: 'str1', str2: 'str2' } })
  })
  // A chart editor switched from a bar chart to a pie chart: the nested config of the bar kept a
  // property the pie's config rejects, and the form stayed invalid on a property nobody could see.
  // The configs are shared definitions, so the errors they raise do not point inside the oneOf.
  it('should remove a nested property rejected by the newly chosen option of a oneOf', async () => {
    const compiledLayout = await compile({
      type: 'object',
      discriminator: { propertyName: 'type' },
      oneOf: [{
        title: 'Bar',
        required: ['type'],
        additionalProperties: false,
        properties: { type: { const: 'bar' }, config: { $ref: '#/$defs/barConfig' }, horizontal: { type: 'boolean' } }
      }, {
        title: 'Pie',
        required: ['type'],
        additionalProperties: false,
        properties: { type: { const: 'pie' }, config: { $ref: '#/$defs/pieConfig' } }
      }],
      $defs: {
        barConfig: { type: 'object', additionalProperties: false, properties: { field: { type: 'string' }, color: { type: 'string' } } },
        pieConfig: { type: 'object', additionalProperties: false, properties: { field: { type: 'string' }, colors: { type: 'string' } } }
      }
    })
    const statefulLayout = new StatefulLayout(
      compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree],
      { ...defaultOptions, removeAdditional: 'error' },
      { type: 'bar', horizontal: true, config: { field: 'f', color: 'red' } }
    )
    assert.ok(statefulLayout.valid)
    const oneOf = statefulLayout.stateTree.root.children?.find(c => c.key === '$oneOf')
    assert.ok(oneOf)
    statefulLayout.activateItem(oneOf, 1)
    assert.deepEqual(statefulLayout.data, { type: 'pie', config: { field: 'f' } })
    assert.ok(statefulLayout.valid)
  })
})
