import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { resolveDataPath, isNodeModified } from '../src/state/utils/modified.js'
import { compile, StatefulLayout } from '../src/index.js'

describe('Modified tracking utilities', () => {
  describe('resolveDataPath', () => {
    it('should resolve root path', () => {
      const data = { a: 1, b: 2 }
      assert.deepEqual(resolveDataPath(data, ''), data)
    })

    it('should resolve nested path', () => {
      const data = { a: { b: { c: 42 } } }
      assert.equal(resolveDataPath(data, '/a/b/c'), 42)
    })

    it('should resolve array index path', () => {
      const data = { arr: [10, 20, 30] }
      assert.equal(resolveDataPath(data, '/arr/1'), 20)
    })

    it('should return undefined for missing path', () => {
      const data = { a: 1 }
      assert.equal(resolveDataPath(data, '/b/c'), undefined)
    })

    it('should return undefined when data is undefined', () => {
      assert.equal(resolveDataPath(undefined, '/a'), undefined)
    })

    it('should return undefined when data is null', () => {
      assert.equal(resolveDataPath(null, '/a'), undefined)
    })
  })

  describe('isNodeModified', () => {
    it('should return false for equal primitive values', () => {
      assert.equal(isNodeModified('hello', 'hello'), false)
    })

    it('should return true for different primitive values', () => {
      assert.equal(isNodeModified('hello', 'world'), true)
    })

    it('should return false for reference-equal objects', () => {
      const obj = { a: 1 }
      assert.equal(isNodeModified(obj, obj), false)
    })

    it('should return false for deep-equal objects', () => {
      assert.equal(isNodeModified({ a: 1 }, { a: 1 }), false)
    })

    it('should return true for different objects', () => {
      assert.equal(isNodeModified({ a: 1 }, { a: 2 }), true)
    })

    it('should return true for undefined vs value', () => {
      assert.equal(isNodeModified(undefined, 'hello'), true)
    })

    it('should return true for value vs undefined', () => {
      assert.equal(isNodeModified('hello', undefined), true)
    })

    it('should return false when both undefined', () => {
      assert.equal(isNodeModified(undefined, undefined), false)
    })
  })
})

describe('Modified tracking integration', () => {
  const defaultOptions = { debounceInputMs: 0 }

  it('should have undefined modified flags when savedData is not provided', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: { str1: { type: 'string' } }
    })
    const statefulLayout = new StatefulLayout(
      compiledLayout,
      compiledLayout.skeletonTrees[compiledLayout.mainTree],
      defaultOptions,
      { str1: 'hello' }
    )
    assert.equal(statefulLayout.stateTree.root.modified, undefined)
    assert.equal(statefulLayout.stateTree.root.childModified, undefined)
    assert.equal(statefulLayout.stateTree.root.children?.[0].modified, undefined)
    assert.equal(statefulLayout.modified, false)
  })

  it('should detect modified leaf', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        str1: { type: 'string' },
        str2: { type: 'string' }
      }
    })
    const savedData = { str1: 'hello', str2: 'world' }
    const currentData = { str1: 'changed', str2: 'world' }
    const statefulLayout = new StatefulLayout(
      compiledLayout,
      compiledLayout.skeletonTrees[compiledLayout.mainTree],
      defaultOptions,
      currentData,
      savedData
    )
    assert.equal(statefulLayout.stateTree.root.children?.[0].modified, true)
    assert.equal(statefulLayout.stateTree.root.children?.[1].modified, false)
    assert.equal(statefulLayout.stateTree.root.childModified, true)
    assert.equal(statefulLayout.modified, true)
  })

  it('should detect no modifications when data equals savedData', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        str1: { type: 'string' },
        str2: { type: 'string' }
      }
    })
    const statefulLayout = new StatefulLayout(
      compiledLayout,
      compiledLayout.skeletonTrees[compiledLayout.mainTree],
      defaultOptions,
      { str1: 'hello', str2: 'world' },
      { str1: 'hello', str2: 'world' }
    )
    assert.equal(statefulLayout.stateTree.root.children?.[0].modified, false)
    assert.equal(statefulLayout.stateTree.root.children?.[1].modified, false)
    assert.equal(statefulLayout.stateTree.root.childModified, false)
    assert.equal(statefulLayout.modified, false)
  })

  it('should bubble childModified through nested objects', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        nested: {
          type: 'object',
          properties: {
            deep: { type: 'string' }
          }
        }
      }
    })
    const statefulLayout = new StatefulLayout(
      compiledLayout,
      compiledLayout.skeletonTrees[compiledLayout.mainTree],
      defaultOptions,
      { nested: { deep: 'changed' } },
      { nested: { deep: 'original' } }
    )
    const nestedNode = statefulLayout.stateTree.root.children?.[0]
    const deepNode = nestedNode?.children?.[0]
    assert.equal(deepNode?.modified, true)
    assert.equal(nestedNode?.childModified, true)
    assert.equal(nestedNode?.modified, false)
    assert.equal(statefulLayout.stateTree.root.childModified, true)
    assert.equal(statefulLayout.modified, true)
  })

  it('should mark array as modified when contents differ, without flagging children', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        arr: { type: 'array', layout: 'list', items: { type: 'string' } }
      }
    })
    const statefulLayout = new StatefulLayout(
      compiledLayout,
      compiledLayout.skeletonTrees[compiledLayout.mainTree],
      defaultOptions,
      { arr: ['a', 'b', 'c'] },
      { arr: ['a', 'b'] }
    )
    const arrNode = statefulLayout.stateTree.root.children?.[0]
    assert.equal(arrNode?.modified, true)
    assert.equal(arrNode?.childModified, true)
    // children should NOT have individual modified flags (savedData suppressed)
    assert.equal(arrNode?.children?.[0].modified, undefined)
    assert.equal(arrNode?.children?.[1].modified, undefined)
    assert.equal(arrNode?.children?.[2].modified, undefined)
  })

  it('should drill into array children when array is unchanged', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        arr: {
          type: 'array',
          layout: 'list',
          items: {
            type: 'object',
            properties: { name: { type: 'string' } }
          }
        }
      }
    })
    const savedData = { arr: [{ name: 'Alice' }, { name: 'Bob' }] }
    const currentData = { arr: [{ name: 'Alice' }, { name: 'Bob' }] }
    const statefulLayout = new StatefulLayout(
      compiledLayout,
      compiledLayout.skeletonTrees[compiledLayout.mainTree],
      defaultOptions,
      currentData,
      savedData
    )
    const arrNode = statefulLayout.stateTree.root.children?.[0]
    assert.equal(arrNode?.modified, false)
    assert.equal(arrNode?.childModified, false)
    assert.equal(arrNode?.children?.[0].children?.[0].modified, false)
  })

  it('should mark oneOf as modified when variant differs', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        value: {
          oneOf: [
            { type: 'string' },
            { type: 'integer' }
          ]
        }
      }
    })
    const statefulLayout = new StatefulLayout(
      compiledLayout,
      compiledLayout.skeletonTrees[compiledLayout.mainTree],
      defaultOptions,
      { value: 'hello' },
      { value: 42 }
    )
    assert.equal(statefulLayout.modified, true)
  })

  it('should recalculate modified flags when savedData is updated', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: { str1: { type: 'string' } }
    })
    const statefulLayout = new StatefulLayout(
      compiledLayout,
      compiledLayout.skeletonTrees[compiledLayout.mainTree],
      defaultOptions,
      { str1: 'current' },
      { str1: 'original' }
    )
    assert.equal(statefulLayout.stateTree.root.children?.[0].modified, true)
    assert.equal(statefulLayout.modified, true)

    statefulLayout.savedData = { str1: 'current' }
    assert.equal(statefulLayout.stateTree.root.children?.[0].modified, false)
    assert.equal(statefulLayout.modified, false)
  })

  it('should treat null savedData as active (comparing against null)', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: { str1: { type: 'string' } }
    })
    const statefulLayout = new StatefulLayout(
      compiledLayout,
      compiledLayout.skeletonTrees[compiledLayout.mainTree],
      defaultOptions,
      { str1: 'hello' },
      null
    )
    assert.equal(statefulLayout.stateTree.root.children?.[0].modified, true)
    assert.equal(statefulLayout.modified, true)
  })

  it('should update modified flags after user input', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        str1: { type: 'string' },
        str2: { type: 'string' }
      }
    })
    const savedData = { str1: 'hello', str2: 'world' }
    const statefulLayout = new StatefulLayout(
      compiledLayout,
      compiledLayout.skeletonTrees[compiledLayout.mainTree],
      defaultOptions,
      { str1: 'hello', str2: 'world' },
      savedData
    )
    assert.equal(statefulLayout.modified, false)

    statefulLayout.input(statefulLayout.stateTree.root.children[0], 'changed')
    assert.equal(statefulLayout.stateTree.root.children[0].modified, true)
    assert.equal(statefulLayout.stateTree.root.children[1].modified, false)
    assert.equal(statefulLayout.modified, true)

    statefulLayout.input(statefulLayout.stateTree.root.children[0], 'hello')
    assert.equal(statefulLayout.stateTree.root.children[0].modified, false)
    assert.equal(statefulLayout.modified, false)
  })
})
