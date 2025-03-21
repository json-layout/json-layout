import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { compile, StatefulLayout } from '../src/index.js'

describe.only('Lists with items fetching', () => {
  const defaultOptions = { debounceInputMs: 0 }

  it('should manage array of strings as a list if requested', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: { arr1: { type: 'array', layout: { comp: 'list', items: ['val1', 'val2'] }, items: { type: 'string' } } }
    })
    const mainTree = compiledLayout.skeletonTrees[compiledLayout.mainTree]
    const root = compiledLayout.skeletonNodes[mainTree.root]
    assert.equal(root.children?.length, 1)
    const children = root.children.map(c => compiledLayout.skeletonNodes[c])
    assert.ok(!children[0].children)
    assert.equal(children[0].childrenTrees?.length, 1)
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions, {
      arr1: []
    })
    let arrNode = statefulLayout.stateTree.root.children?.[0]
    assert.ok(arrNode)
    assert.equal(arrNode.layout.comp, 'list')
    assert.equal(arrNode.loading, true)
    assert.deepEqual(arrNode.data, undefined)
    await new Promise(resolve => setTimeout(resolve, 1))
    arrNode = statefulLayout.stateTree.root.children?.[0]
    assert.ok(arrNode)
    assert.equal(arrNode.loading, undefined)
    assert.deepEqual(arrNode.data, ['val1', 'val2'])
    /* const arrNode = statefulLayout.stateTree.root.children?.[0]
    assert.ok(arrNode)
    assert.equal(arrNode.layout.comp, 'list')
    assert.deepEqual(arrNode.data, ['Str 1', 'Str 2', 'a'])

    assert.equal(arrNode.children?.length, 3)
    assert.equal(arrNode.children?.[0].key, 0)
    assert.equal(arrNode.children?.[0].data, 'Str 1')
    assert.equal(arrNode.children?.[0].layout.comp, 'text-field')
    assert.equal(arrNode.children?.[1].key, 1)
    assert.equal(arrNode.children?.[1].data, 'Str 2')

    assert.equal(statefulLayout.stateTree.valid, false)
    assert.equal(arrNode.children?.[2].error, 'must NOT be shorter than 2 characters')

    statefulLayout.input(arrNode.children[0], 'test')
    const arrNode2 = statefulLayout.stateTree.root.children?.[0]
    assert.ok(arrNode2)
    assert.notEqual(arrNode, arrNode2)
    assert.equal(arrNode2.children?.[0].data, 'test') */
  })
})
