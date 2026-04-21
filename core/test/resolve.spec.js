import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { compile, StatefulLayout } from '../src/index.js'
import { resolveNode, resolveSkeletonNode, lookupNormalizedLayout } from '../src/utils/resolve.js'

const defaultOptions = { debounceInputMs: 0 }

describe('resolveNode', () => {
  it('should return root for empty or "/" path', async () => {
    const compiledLayout = await compile({ type: 'object', properties: { a: { type: 'string' } } })
    const statefulLayout = new StatefulLayout(
      compiledLayout,
      compiledLayout.skeletonTrees[compiledLayout.mainTree],
      defaultOptions,
      { a: 'x' }
    )
    const root = statefulLayout.stateTree.root
    assert.equal(resolveNode(root, ''), root)
    assert.equal(resolveNode(root, '/'), root)
  })

  it('should resolve an object property by name', async () => {
    const compiledLayout = await compile({ type: 'object', properties: { a: { type: 'string' } } })
    const statefulLayout = new StatefulLayout(
      compiledLayout,
      compiledLayout.skeletonTrees[compiledLayout.mainTree],
      defaultOptions,
      { a: 'hello' }
    )
    const node = resolveNode(statefulLayout.stateTree.root, '/a')
    assert.equal(node?.data, 'hello')
  })

  it('should resolve an array index as number', async () => {
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
      { arr: ['one', 'two'] }
    )
    const node = resolveNode(statefulLayout.stateTree.root, '/arr/1')
    assert.equal(node?.data, 'two')
  })

  it('should return undefined for unknown path', async () => {
    const compiledLayout = await compile({ type: 'object', properties: { a: { type: 'string' } } })
    const statefulLayout = new StatefulLayout(
      compiledLayout,
      compiledLayout.skeletonTrees[compiledLayout.mainTree],
      defaultOptions,
      { a: 'x' }
    )
    assert.equal(resolveNode(statefulLayout.stateTree.root, '/b'), undefined)
  })
})

describe('resolveSkeletonNode', () => {
  it('should return the main tree root for empty or "/" path', async () => {
    const compiledLayout = await compile({ type: 'object', properties: { a: { type: 'string' } } })
    const mainTree = compiledLayout.skeletonTrees[compiledLayout.mainTree]
    const rootNode = compiledLayout.skeletonNodes[mainTree.root]
    assert.equal(resolveSkeletonNode(compiledLayout, ''), rootNode)
    assert.equal(resolveSkeletonNode(compiledLayout, '/'), rootNode)
  })

  it('should resolve a nested property', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        outer: {
          type: 'object',
          properties: { inner: { type: 'string' } }
        }
      }
    })
    const node = resolveSkeletonNode(compiledLayout, '/outer/inner')
    assert.ok(node)
    assert.equal(node?.key, 'inner')
  })

  it('should resolve an array item pointer', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        arr: { type: 'array', layout: 'list', items: { type: 'string' } }
      }
    })
    // Array items share the same skeleton regardless of index.
    const arrayNode = resolveSkeletonNode(compiledLayout, '/arr')
    assert.ok(arrayNode)
    assert.equal(arrayNode?.key, 'arr')
    const itemNode = resolveSkeletonNode(compiledLayout, '/arr/0')
    assert.ok(itemNode)
  })

  it('should return undefined for unknown path', async () => {
    const compiledLayout = await compile({ type: 'object', properties: { a: { type: 'string' } } })
    assert.equal(resolveSkeletonNode(compiledLayout, '/b'), undefined)
  })
})

describe('lookupNormalizedLayout', () => {
  it('should return the normalized layout for root', async () => {
    const compiledLayout = await compile({ type: 'object', properties: { a: { type: 'string' } } })
    const layout = lookupNormalizedLayout(compiledLayout, '')
    assert.ok(layout)
    // The root is an object section; its pointer is the tree root's pointer.
    const mainTree = compiledLayout.skeletonTrees[compiledLayout.mainTree]
    const rootNode = compiledLayout.skeletonNodes[mainTree.root]
    assert.equal(layout, compiledLayout.normalizedLayouts[rootNode.pointer])
  })

  it('should return the normalized layout for a nested leaf', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: { a: { type: 'string', title: 'A title' } }
    })
    const layout = lookupNormalizedLayout(compiledLayout, '/a')
    assert.ok(layout)
    // schema `title` normalizes to `label` on field-level comp objects
    const leaf = /** @type {any} */(layout)
    assert.equal(leaf.label, 'A title')
  })

  it('should return undefined for unknown path', async () => {
    const compiledLayout = await compile({ type: 'object', properties: { a: { type: 'string' } } })
    assert.equal(lookupNormalizedLayout(compiledLayout, '/missing'), undefined)
  })
})
