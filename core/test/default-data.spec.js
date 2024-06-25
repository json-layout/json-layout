import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { compile, StatefulLayout } from '../src/index.js'

describe('default data management', () => {
  const defaultOptions = { debounceInputMs: 0 }

  it('should create empty root object', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: { str1: { type: 'string' } }
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions, null)

    assert.deepEqual(statefulLayout.data, {})
  })

  it('should create empty root string', async () => {
    const compiledLayout = await compile({
      type: 'string'
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions, null)
    assert.equal(statefulLayout.stateTree.root.layout.defaultData, '')
    assert.equal(statefulLayout.data, '')
  })

  it('should not recreate empty root object', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: { str1: { type: 'string' } }
    })
    const initialData = {}
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions, initialData)

    assert.equal(statefulLayout.data, initialData)
  })

  it('should fill default values when data is empty', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: { str1: { type: 'string', default: 'String 1' } }
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions, {})

    assert.deepEqual(statefulLayout.data, { str1: 'String 1' })

    // reuse default value if property is emptied
    assert.ok(statefulLayout.stateTree.root.children)
    statefulLayout.input(statefulLayout.stateTree.root.children?.[0], '')
    assert.deepEqual(statefulLayout.data, { str1: 'String 1' })

    statefulLayout.input(statefulLayout.stateTree.root.children?.[0], 'test')
    assert.deepEqual(statefulLayout.data, { str1: 'test' })
  })

  it('should fill default values when data is missing', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: { str1: { type: 'string', default: 'String 1' } }
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], { ...defaultOptions, defaultOn: 'missing' }, {})

    // console.log(JSON.stringify(statefulLayout.data, null, 2))
    assert.deepEqual(statefulLayout.data, { str1: 'String 1' })

    // DO NOT reuse default value if property is emptied
    assert.ok(statefulLayout.stateTree.root.children)
    statefulLayout.input(statefulLayout.stateTree.root.children?.[0], '')
    assert.deepEqual(statefulLayout.data, { str1: '' })

    statefulLayout.input(statefulLayout.stateTree.root.children?.[0], 'test')
    assert.deepEqual(statefulLayout.data, { str1: 'test' })
  })

  /* it.only('should use expression to fill default values', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: { str1: { type: 'string', layout: { defaultData: 'String 1' } } }
    })
  }) */

  it('should use default data on root object', async () => {
    const compiledLayout = await compile({
      type: 'object',
      default: { str1: 'String 1' },
      properties: { str1: { type: 'string' } }
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions, {})

    assert.deepEqual(statefulLayout.data, { str1: 'String 1' })
  })

  it('should use empty value as default data for root simple types', async () => {
    const compiledLayout = await compile({
      type: 'string'
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions)

    assert.deepEqual(statefulLayout.data, '')
  })

  it('should use default data when adding new item to array', async () => {
    const compiledLayout = await compile({
      type: 'array',
      items: {
        type: 'object',
        default: { str1: 'String 1' },
        properties: { str1: { type: 'string' } }
      }
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions)

    assert.deepEqual(statefulLayout.data, [])

    statefulLayout.input(statefulLayout.stateTree.root, [undefined])

    assert.deepEqual(statefulLayout.data, [{ str1: 'String 1' }])
  })
})
