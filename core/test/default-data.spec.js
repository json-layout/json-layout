import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { compile, StatefulLayout } from '../src/index.js'
import { getNodeBuilder } from './utils/state-tree.js'

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
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions, { str1: '' })
    assert.deepEqual(statefulLayout.data, { str1: 'String 1' })
  })

  it('should fill default values when data is empty after blur', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: { str1: { type: 'string', default: 'String 1' } }
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions, {})

    assert.deepEqual(statefulLayout.data, { str1: 'String 1' })

    // reuse default value if property is emptied, but only after blur
    assert.ok(statefulLayout.stateTree.root.children)
    statefulLayout.input(statefulLayout.stateTree.root.children?.[0], '')
    assert.deepEqual(statefulLayout.data, {})
    statefulLayout.blur(statefulLayout.stateTree.root.children?.[0])
    assert.deepEqual(statefulLayout.data, { str1: 'String 1' })

    statefulLayout.input(statefulLayout.stateTree.root.children?.[0], 'test')
    assert.deepEqual(statefulLayout.data, { str1: 'test' })
  })

  it('should fill default values when data is empty after blur with debounce', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: { str1: { type: 'string', default: 'String 1' } }
    })
    const statefulLayout = new StatefulLayout(
      compiledLayout,
      compiledLayout.skeletonTrees[compiledLayout.mainTree],
      { ...defaultOptions, debounceInputMs: 300 },
      {}
    )

    assert.deepEqual(statefulLayout.data, { str1: 'String 1' })

    // reuse default value if property is emptied, but only after blur
    assert.ok(statefulLayout.stateTree.root.children)
    statefulLayout.input(statefulLayout.stateTree.root.children?.[0], 'val')
    assert.deepEqual(statefulLayout.data, { str1: 'String 1' }) // not yet changed
    await new Promise((resolve) => setTimeout(resolve, 300))
    assert.deepEqual(statefulLayout.data, { str1: 'val' }) // changed after debounce

    statefulLayout.input(statefulLayout.stateTree.root.children?.[0], '')
    statefulLayout.blur(statefulLayout.stateTree.root.children?.[0])
    assert.deepEqual(statefulLayout.data, { str1: 'String 1' }) // changed and default data applied after debounce
    // changed after blur and default value is applied
    assert.deepEqual(statefulLayout.data, { str1: 'String 1' })

    statefulLayout.input(statefulLayout.stateTree.root.children?.[0], 'test')
    await new Promise((resolve) => setTimeout(resolve, 300))
    assert.deepEqual(statefulLayout.data, { str1: 'test' })
  })

  it('should fill default values when data in nested object is empty', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        obj1: {
          type: 'object',
          properties: {
            str1: { type: 'string', default: 'String 1' }
          }
        }
      }
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions, {})

    assert.deepEqual(statefulLayout.data, { obj1: { str1: 'String 1' } })
  })

  it('should fill default values when data in tuples is empty', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        arr1: {
          type: 'array',
          items: [{
            type: 'object',
            properties: {
              str1: { type: 'string', default: 'String 1' }
            }
          }]
        }
      }
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions, {})

    assert.deepEqual(statefulLayout.data, { arr1: [{ str1: 'String 1' }] })
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

  it('should fill new object with default data when adding new item to array with allOf items', async () => {
    const compiledLayout = await compile({
      type: 'object',
      allOf: [{
        str1: { type: 'string' },
      }, {
        properties: {
          array1: {
            type: 'array',
            items: {
              type: 'object',
              properties: { str2: { type: 'string', default: 'Str 2' } }
            }
          }
        }
      }, {
        str2: { type: 'string' }
      }]
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions)
    const getNode = getNodeBuilder(statefulLayout)

    assert.deepEqual(statefulLayout.data, {})
    assert.equal(statefulLayout.valid, true)

    statefulLayout.input(getNode('$allOf-1.array1'), [undefined])

    assert.deepEqual(statefulLayout.data, { array1: [{ str2: 'Str 2' }] })
  })

  it('should not insert an empty object as default data for a select node', async () => {
    const compiledLayout = await compile({
      type: 'object',
      required: ['select1'],
      properties: {
        select1: {
          type: 'object',
          // eslint-disable-next-line no-template-curly-in-string
          layout: { getItems: { url: 'http://${options.context.domain}/test', itemsResults: 'data.results', itemKey: 'item.prop1', itemTitle: 'item.prop2' } }
        }
      }
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], { ...defaultOptions, removeAdditional: 'unknown', context: { domain: 'test.com' } }, {})
    assert.deepEqual(statefulLayout.data, {})
  })

  it('should use default value as a placeholder based on useDefault option', async () => {
    const compiledLayout = await compile({
      type: 'string',
      default: 'String 1'
    }, { useDefault: 'placeholder' })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions, null)
    assert.equal(statefulLayout.stateTree.root.layout.placeholder, 'default: String 1')
    assert.equal(statefulLayout.data, '')
  })

  it('should ignore default value based on useDefault option', async () => {
    const compiledLayout = await compile({
      type: 'string',
      default: 'String 1'
    }, { useDefault: false })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions, null)
    assert.equal(statefulLayout.stateTree.root.layout.placeholder, undefined)
    assert.equal(statefulLayout.data, '')
  })

  it('should use false as default value for a required boolean', async () => {
    const compiledLayout = await compile({
      type: 'object',
      required: ['bool'],
      properties: {
        bool: {
          type: 'boolean'
        }
      }
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions, null)
    assert.deepEqual(statefulLayout.data, { bool: false })
  })
})
