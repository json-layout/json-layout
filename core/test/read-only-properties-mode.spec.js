import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { compile, StatefulLayout } from '../src/index.js'

describe('Management of readOnly properties from schema', () => {
  const defaultOptions = { debounceInputMs: 0 }

  it('should keep readOnly properties by default', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        str1: { type: 'string' },
        str2: { type: 'string', readOnly: true }
      }
    })
    const statefulLayout = new StatefulLayout(
      compiledLayout, compiledLayout.skeletonTree,
      defaultOptions,
      { str1: 'str1', str2: 'str2' }
    )
    assert.ok(statefulLayout.valid)
    assert.deepEqual(statefulLayout.data, { str1: 'str1', str2: 'str2' })
    assert.equal(statefulLayout.stateTree.root.children?.length, 2)
    assert.equal(statefulLayout.stateTree.root.children[1].options.readOnly, true)
  })

  it('should hide readOnly properties if requested', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        str1: { type: 'string' },
        str2: { type: 'string', readOnly: true }
      }
    })
    const statefulLayout = new StatefulLayout(
      compiledLayout, compiledLayout.skeletonTree,
      { ...defaultOptions, readOnlyPropertiesMode: 'hide' },
      { str1: 'str1', str2: 'str2' }
    )
    assert.ok(statefulLayout.valid)
    assert.deepEqual(statefulLayout.data, { str1: 'str1', str2: 'str2' })
    assert.equal(statefulLayout.stateTree.root.children?.length, 1)
    assert.equal(statefulLayout.stateTree.root.children[0].key, 'str1')
  })

  it('should remove readOnly properties if requested', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        str1: { type: 'string' },
        str2: { type: 'string', readOnly: true }
      }
    })
    const statefulLayout = new StatefulLayout(
      compiledLayout, compiledLayout.skeletonTree,
      { ...defaultOptions, readOnlyPropertiesMode: 'remove' },
      { str1: 'str1', str2: 'str2' }
    )
    assert.ok(statefulLayout.valid)
    assert.deepEqual(statefulLayout.data, { str1: 'str1' })
    assert.equal(statefulLayout.stateTree.root.children?.length, 1)
    assert.equal(statefulLayout.stateTree.root.children[0].key, 'str1')
  })
})
