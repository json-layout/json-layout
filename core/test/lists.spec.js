import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { compile, StatefulLayout } from '../src/index.js'
import { getNodeBuilder } from './utils/state-tree.js'

describe('Lists management', () => {
  const defaultOptions = { debounceInputMs: 0 }

  it('should manage array of strings as a list if requested', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: { arr1: { type: 'array', layout: 'list', items: { type: 'string', minLength: 2 } } }
    })
    const mainTree = compiledLayout.skeletonTrees[compiledLayout.mainTree]
    const root = compiledLayout.skeletonNodes[mainTree.root]
    assert.equal(root.children?.length, 1)
    const children = root.children.map(c => compiledLayout.skeletonNodes[c])
    assert.ok(!children[0].children)
    assert.equal(children[0].childrenTrees?.length, 1)
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions, {
      arr1: ['Str 1', 'Str 2', 'a']
    })
    const arrNode = statefulLayout.stateTree.root.children?.[0]
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
    assert.equal(arrNode2.children?.[0].data, 'test')
  })

  it('should manage array of dates as a list', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: { arr1: { type: 'array', items: { type: 'string', format: 'date' } } }
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions, {
      arr1: []
    })
    assert.equal(statefulLayout.valid, true)
    const getNode = getNodeBuilder(statefulLayout)
    assert.equal(getNode().layout.comp, 'section')
    assert.equal(getNode('arr1').layout.comp, 'list')
    statefulLayout.input(getNode('arr1'), [undefined])
    assert.deepEqual(statefulLayout.data, { arr1: [null] })
    assert.equal(statefulLayout.valid, false)
    assert.equal(getNode('arr1.0').error, 'must be string')
    assert.equal(getNode('arr1.0').layout.label, '')
  })

  it('should manage array of objects as a list', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: { arr1: { type: 'array', items: { type: 'object', properties: { str1: { type: 'string' } } } } }
    })
    const mainTree = compiledLayout.skeletonTrees[compiledLayout.mainTree]
    const root = compiledLayout.skeletonNodes[mainTree.root]
    assert.equal(root.children?.length, 1)
    const children = root.children.map(c => compiledLayout.skeletonNodes[c])
    assert.ok(!children[0].children)
    assert.equal(children[0].childrenTrees?.length, 1)
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions, {
      arr1: [{ str1: 'val1' }]
    })
    const arrNode = statefulLayout.stateTree.root.children?.[0]
    assert.ok(arrNode)
    assert.equal(arrNode.layout.comp, 'list')
    assert.deepEqual(arrNode.data, [{ str1: 'val1' }])

    // push empty item before editing it
    statefulLayout.input(arrNode, [{ str1: 'val1' }, undefined])
    statefulLayout.activateItem(arrNode, 1)
    assert.deepEqual(statefulLayout.data, { arr1: [{ str1: 'val1' }, {}] })
  })

  it('should manage array of objects as a list in menu/dialog edition mode', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        arr1: {
          type: 'array',
          layout: {
            listEditMode: 'dialog'
          },
          items: { type: 'object', properties: { str1: { type: 'string' } } }
        }
      }
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions, {
      arr1: [{ str1: 'val1' }]
    })
    const getNode = getNodeBuilder(statefulLayout)
    const arrNode = getNode('arr1')
    assert.ok(arrNode)
    assert.equal(arrNode.layout.comp, 'list')
    assert.deepEqual(arrNode.data, [{ str1: 'val1' }])

    // push empty item before editing it
    statefulLayout.input(arrNode, [{ str1: 'val1' }, undefined])
    statefulLayout.activateItem(arrNode, 1)
    assert.deepEqual(statefulLayout.data, { arr1: [{ str1: 'val1' }, {}] })
    const roNode = getNode('arr1.1')
    assert.equal(roNode.options.summary, true)
    const editNode = getNode('arr1').children?.[2]
    assert.ok(editNode)
    assert.equal(editNode.options.summary, false)
    assert.equal(editNode.key, 1)
    assert.ok(editNode.children?.[0])
    statefulLayout.input(editNode.children[0], 'val2')
    assert.deepEqual(statefulLayout.data, { arr1: [{ str1: 'val1' }, { str1: 'val2' }] })
  })

  it('should manage array of objects with oneOf as a list in menu/dialog edition mode', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        arr1: {
          type: 'array',
          layout: {
            listEditMode: 'dialog'
          },
          items: {
            type: 'object',
            oneOf: [
              {
                properties: {
                  type: { type: 'string', const: 'case1' },
                  str1: { type: 'string' }
                }
              },
              {
                required: ['str2'],
                properties: {
                  type: { type: 'string', const: 'case2' },
                  str2: { type: 'string' }
                }
              }
            ]
          }
        }
      }
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions, {
      arr1: [{ str1: 'val1' }]
    })
    const getNode = getNodeBuilder(statefulLayout)
    assert.equal(getNode('arr1').layout.comp, 'list')
    assert.equal(getNode('arr1').children?.length, 1)

    // edit 1rst item
    statefulLayout.activateItem(getNode('arr1'), 0)
    let children = getNode('arr1').children
    assert.equal(children?.length, 2)
    assert.equal(children[0].key, children[1].key)
    assert.equal(children[0].data, children[1].data)
    assert.equal(children[0].options.summary, true)
    assert.equal(children[1].options.summary, false)
    assert.equal(children[0].children?.[0].key, '$oneOf')
    assert.equal(children[0].children?.[0].children?.[0].key, 0)
    assert.equal(children[1].children?.[0].key, '$oneOf')
    assert.equal(children[1].children?.[0].children?.[0].key, 0)

    // activate second item of oneOf inside the active/edited array item
    statefulLayout.activateItem(children[1].children?.[0], 1)
    children = getNode('arr1').children
    assert.equal(children?.length, 2)
    assert.equal(children[0].children?.[0].children?.[0].key, 1)
    assert.equal(children[1].children?.[0].children?.[0].key, 1)
  })
})
