import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { compile, StatefulLayout } from '../src/index.js'
import nock from 'nock'
import fetch from 'node-fetch'

// @ts-ignore
global.fetch = fetch

describe('Lists with items fetching', () => {
  const defaultOptions = { debounceInputMs: 0 }

  it('should fill a simple array from layout.items', async () => {
    const compiledLayout = compile({
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
  })

  it('should fill a simple array from URL fetch', async () => {
    let nockScope = nock('http://test.com')
      .get('/req1')
      .reply(200, [{ key: 'val1' }, { key: 'val2' }])
    const compiledLayout = compile({
      type: 'object',
      properties: {
        arr1: {
          type: 'array',
          // eslint-disable-next-line no-template-curly-in-string
          layout: { comp: 'list', getItems: { url: 'http://test.com/${parent.data.str1}' } },
          items: { type: 'object', properties: { key: { type: 'string' }, str2: { type: 'string' } } }
        },
        str1: { type: 'string' }
      }
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions, {
      str1: 'req1',
      arr1: []
    })
    let arrNode = statefulLayout.stateTree.root.children?.[0]
    assert.ok(arrNode)
    assert.equal(arrNode.loading, true)
    assert.deepEqual(arrNode.data, undefined)
    await new Promise(resolve => setTimeout(resolve, 10))
    assert.ok(nockScope.isDone())
    arrNode = statefulLayout.stateTree.root.children?.[0]
    assert.ok(arrNode)
    assert.equal(arrNode.loading, undefined)
    assert.deepEqual(arrNode.data, [{ key: 'val1' }, { key: 'val2' }])
    const item1Node = arrNode.children?.[1]
    assert.ok(item1Node)
    const str2Node = item1Node.children?.[1]
    assert.ok(str2Node)
    assert.equal(str2Node.fullKey, '/arr1/1/str2')
    statefulLayout.input(str2Node, 'STR 2')
    arrNode = statefulLayout.stateTree.root.children?.[0]
    assert.ok(arrNode)
    assert.equal(arrNode.loading, undefined)
    assert.deepEqual(arrNode.data, [{ key: 'val1' }, { key: 'val2', str2: 'STR 2' }])

    nockScope = nock('http://test.com')
      .get('/req2')
      .reply(200, [{ key: 'val2' }, { key: 'val3' }])
    const strNode = statefulLayout.stateTree.root.children?.[1]
    assert.ok(strNode)
    statefulLayout.input(strNode, 'req2')
    arrNode = statefulLayout.stateTree.root.children?.[0]
    assert.ok(arrNode)
    assert.equal(arrNode.loading, true)
    await new Promise(resolve => setTimeout(resolve, 10))
    assert.ok(nockScope.isDone())
    arrNode = statefulLayout.stateTree.root.children?.[0]
    assert.ok(arrNode)
    assert.equal(arrNode.loading, undefined)
    assert.deepEqual(arrNode.data, [{ key: 'val2', str2: 'STR 2' }, { key: 'val3' }])
  })
})
