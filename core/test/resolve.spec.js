import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { compile, StatefulLayout } from '../src/index.js'
import { resolveNode } from '../src/utils/resolve.js'

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
