import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { compile, StatefulLayout } from '../src/index.js'

describe.only('Management of pattern properties', () => {
  const defaultOptions = { debounceInputMs: 0 }

  it.only('should display pattern properties in a list', async () => {
    const compiledLayout = await compile({
      type: 'object',
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
    assert.equal(root.children?.length, 1)
    const patternPropertiesList = root.children[0]
    assert.equal(patternPropertiesList.key, '$patternProperties')
    assert.equal(patternPropertiesList.layout.comp, 'list')
    assert.equal(patternPropertiesList.children?.length, 0)
    statefulLayout.input(patternPropertiesList, { aKey: 'aValue' })
    const patternPropertiesList2 = statefulLayout.stateTree.root?.children?.[0]
    assert.equal(patternPropertiesList2?.children?.length, 2)
    assert.equal(patternPropertiesList2.children[0].key, 0)
    assert.equal(patternPropertiesList2.children[1].key, 'aKey')
    assert.equal(patternPropertiesList2.children[1].data, 'aValue')
    statefulLayout.input(patternPropertiesList2.children[0], 'another key')
    assert.deepEqual(statefulLayout.data, { 'another key': 'aValue' })
    statefulLayout.input(patternPropertiesList2.children[1], 'another value')
    assert.deepEqual(statefulLayout.data, { 'another key': 'another value' })
  })
})
