import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { compile, StatefulLayout } from '../src/index.js'
import { getNodeBuilder } from './utils/state-tree.js'

describe('Management of pattern properties', () => {
  const defaultOptions = { debounceInputMs: 0 }

  it('should display pattern properties in a list', async () => {
    const compiledLayout = await compile({
      type: 'object',
      title: 'Pattern properties',
      patternProperties: {
        '.*': { type: 'string' }
      }
    })
    const statefulLayout = new StatefulLayout(
      compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree],
      defaultOptions,
      {}
    )
    assert.ok(statefulLayout.valid)
    assert.deepEqual(statefulLayout.data, {})
    const root = statefulLayout.stateTree.root
    assert.ok(root)
    assert.equal(root.layout.comp, 'section')
    assert.equal(root.layout.title, undefined)
    assert.equal(root.children?.length, 1)
    const patternPropertiesList = root.children[0]
    assert.equal(patternPropertiesList.layout.title, 'Pattern properties')
    assert.equal(patternPropertiesList.key, '$patternProperties')
    assert.equal(patternPropertiesList.layout.comp, 'list')
    assert.equal(patternPropertiesList.children?.length, 0)
    statefulLayout.input(patternPropertiesList, { aKey: null })
    // assert.deepEqual(statefulLayout.data, { aKey: null })
    const patternPropertiesList2 = statefulLayout.stateTree.root?.children?.[0]
    assert.equal(patternPropertiesList2?.children?.length, 1)
    assert.equal(patternPropertiesList2.children[0].key, 'aKey')
    assert.equal(patternPropertiesList2.children[0].data, null)
    assert.equal(patternPropertiesList2.children[0].layout.label, '')
    statefulLayout.input(patternPropertiesList2.children[0], 'another value')
    assert.deepEqual(statefulLayout.data, { aKey: 'another value' })
    statefulLayout.input(patternPropertiesList2, {})
    assert.deepEqual(statefulLayout.data, {})
  })

  it('should manage additionalProperties alongside patternProperties', async () => {
    const compiledLayout = await compile({
      type: 'object',
      title: 'Pattern properties',
      properties: {
        str1: {
          type: 'string'
        }
      },
      patternProperties: {
        'prefix1_(.*)': { type: 'string' },
        'prefix2_(.*)': { type: 'number' }
      }
    })
    const statefulLayout = new StatefulLayout(
      compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree],
      { ...defaultOptions, removeAdditional: true },
      {
        str1: 'Str 1',
        prefix1_ok: 'Pattern 1',
        prefix2_ok: 11,
        prefix2_ko: 'ko',
        extra1: 'Extra 1'
      }
    )
    const getNode = getNodeBuilder(statefulLayout)
    assert.equal(statefulLayout.valid, false)
    assert.deepEqual(statefulLayout.data, {
      str1: 'Str 1',
      prefix1_ok: 'Pattern 1',
      prefix2_ok: 11,
      prefix2_ko: 'ko'
    })
    assert.equal(getNode()?.layout.comp, 'section')
    assert.equal(getNode(['$patternProperties'])?.layout.comp, 'list')
    assert.equal(getNode(['$patternProperties', 'prefix1_ok'])?.layout.comp, 'text-field')
    assert.equal(getNode(['$patternProperties', 'prefix2_ok'])?.layout.comp, 'number-field')
    assert.equal(getNode(['$patternProperties', 'prefix2_ko'])?.layout.comp, 'number-field')
    assert.equal(getNode(['$patternProperties', 'prefix2_ko'])?.error, 'must be number')
    statefulLayout.input(getNode(['$patternProperties', 'prefix2_ko']), 22)
    assert.equal(statefulLayout.valid, true)
    assert.deepEqual(statefulLayout.data, {
      str1: 'Str 1',
      prefix1_ok: 'Pattern 1',
      prefix2_ok: 11,
      prefix2_ko: 22
    })
    statefulLayout.input(getNode(['$patternProperties']), {
      prefix1_ok: 'Pattern 1',
      prefix2_ok: 11
    })
    assert.deepEqual(statefulLayout.data, {
      str1: 'Str 1',
      prefix1_ok: 'Pattern 1',
      prefix2_ok: 11
    })
  })

  it('should manage patterProperties values as string arrays', async () => {
    const compiledLayout = await compile({
      type: 'object',
      title: 'Pattern properties',
      description: 'Pattern properties help',
      patternPropertiesLayout: {
        messages: {
          addItem: 'Input a key'
        }
      },
      patternProperties: {
        '.*': { type: 'array', items: { type: 'string' } }
      }
    })
    const statefulLayout = new StatefulLayout(
      compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree],
      defaultOptions,
      {}
    )
    const getNode = getNodeBuilder(statefulLayout)
    assert.ok(statefulLayout.valid)
    assert.deepEqual(statefulLayout.data, {})
    assert.equal(getNode(['$patternProperties']).layout.title, 'Pattern properties')
    assert.equal(getNode(['$patternProperties']).layout.help, undefined)
    assert.equal(statefulLayout.stateTree.root.layout.title, undefined)
    assert.equal(statefulLayout.stateTree.root.layout.help, '<p>Pattern properties help</p>')
    statefulLayout.input(getNode(['$patternProperties']), {
      aKey: ['value1', 'value2']
    })
    assert.deepEqual(statefulLayout.data, { aKey: ['value1', 'value2'] })
    statefulLayout.input(getNode(['$patternProperties', 'aKey']), ['value3', 'value2'])
    assert.deepEqual(statefulLayout.data, { aKey: ['value3', 'value2'] })

    statefulLayout.input(getNode(['$patternProperties']), {
      aKey: ['value3', 'value2'],
      aKey2: undefined
    })
    assert.deepEqual(statefulLayout.data, { aKey: ['value3', 'value2'], aKey2: [] })
  })

  it('should manage patterProperties with keys from layout.items', async () => {
    const compiledLayout = await compile({
      type: 'object',
      title: 'Pattern properties',
      patternPropertiesLayout: {
        items: ['key1', 'key2']
      },
      patternProperties: {
        '.*': { type: 'string' }
      }
    })
    const statefulLayout = new StatefulLayout(
      compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree],
      defaultOptions,
      {}
    )
    const getNode = getNodeBuilder(statefulLayout)
    const node = getNode('$patternProperties')

    const items = await statefulLayout.getItems(node)
    assert.deepEqual(items, [
      { value: 'key1', key: 'key1', title: 'key1' },
      { value: 'key2', key: 'key2', title: 'key2' }
    ])
  })
})
