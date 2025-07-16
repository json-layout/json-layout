import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { compile, StatefulLayout } from '../src/index.js'
import nock from 'nock'
import fetch from 'node-fetch'
import { getNodeBuilder } from './utils/state-tree.js'

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

  it('should fill an array based on a dependency in a oneOf', async () => {
    nock('http://test.com')
      .persist()
      .get('/schema')
      .reply(200, [{ key: 'prop1' }, { key: 'prop2' }])
      .get('/icons')
      .reply(200, [{ name: 'icon1' }, { name: 'icon2' }])
      .get('/values_agg?field=prop1')
      .reply(200, { aggs: [{ value: 'val_1' }, { value: 'val_2' }] })
      .get('/values_agg?field=prop2')
      .reply(200, { aggs: [{ value: 'val_a' }, { value: 'val_b' }] })

    const compiledLayout = compile({
      type: 'object',
      oneOf: [
        {
          additionalProperties: false,
          properties: {
            type: { const: 'icon-single' },
            icon: { $ref: '#/$defs/icon' }
          }
        },
        {
          required: ['field'],
          properties: {
            type: { const: 'icon-multiple' },
            field: {
              type: 'string',
              layout: { getItems: { url: 'http://test.com/schema', itemKey: 'data.key', } }
            }
          },
          dependencies: {
            field: {
              properties: {
                icons: {
                  type: 'array',
                  layout: {
                    comp: 'list',
                    getItems: {
                      // eslint-disable-next-line no-template-curly-in-string
                      url: 'http://test.com/values_agg?field=${parent.data.field}',
                      itemKey: 'data.value',
                      itemsResults: 'data.aggs'
                    }
                  },
                  items: {
                    type: 'object',
                    properties: {
                      value: { type: 'string', layout: 'none' },
                      icon: { $ref: '#/$defs/icon' }
                    }
                  }
                }
              }
            }
          }
        }
      ],
      default: { type: 'icon-single', icon: { name: 'map-marker', } },
      $defs: {
        icon: {
          type: 'object',
          layout: { getItems: { url: 'http://test.com/icons', itemKey: 'data.name' } },
          properties: {
            name: { type: 'string' }
          },
          default: { name: 'map-marker' }
        }
      }
    })

    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], { updateOn: 'blur' }, {
      str1: 'req1',
      arr1: []
    })
    const getNode = getNodeBuilder(statefulLayout)
    assert.ok(statefulLayout.valid)
    assert.deepEqual(statefulLayout.data, { type: 'icon-single', icon: { name: 'map-marker', } })

    // switch to multiple icons mode
    statefulLayout.activateItem(getNode('$oneOf'), 1)
    const fields = await statefulLayout.getItems(getNode('$oneOf.1.field'))

    // select field, icons whould be filled
    statefulLayout.input(getNode('$oneOf.1.field'), fields[0].value)
    assert.equal(getNode('$oneOf.1.$deps-field.icons').children?.length, 0)
    await new Promise(resolve => setTimeout(resolve, 10))
    assert.equal(getNode('$oneOf.1.$deps-field.icons').children?.length, 2)
    assert.deepEqual(getNode('$oneOf.1.$deps-field.icons.0').data, { value: 'val_1', icon: { name: 'map-marker' } })

    // select other field, icons whould be re-filled
    statefulLayout.input(getNode('$oneOf.1.field'), fields[1].value)
    await new Promise(resolve => setTimeout(resolve, 10))
    assert.equal(getNode('$oneOf.1.$deps-field.icons').children?.length, 2)
    assert.deepEqual(getNode('$oneOf.1.$deps-field.icons.0').data, { value: 'val_a', icon: { name: 'map-marker' } })

    // back to single icon mode
    statefulLayout.activateItem(getNode('$oneOf'), 0)
    assert.deepEqual(statefulLayout.data, { type: 'icon-single', icon: { name: 'map-marker', } })

    // back to multiple icons mode
    statefulLayout.activateItem(getNode('$oneOf'), 1)

    // select field, icons whould be re-filled
    statefulLayout.input(getNode('$oneOf.1.field'), fields[1].value)
    assert.equal(getNode('$oneOf.1.$deps-field.icons').children?.length, 0)
    await new Promise(resolve => setTimeout(resolve, 10))
    assert.equal(getNode('$oneOf.1.$deps-field.icons').children?.length, 2)
    assert.deepEqual(getNode('$oneOf.1.$deps-field.icons.0').data, { value: 'val_a', icon: { name: 'map-marker' } })

    nock.cleanAll()
  })
})
