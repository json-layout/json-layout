import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { compile, StatefulLayout } from '../src/index.js'
import nock from 'nock'
import fetch from 'node-fetch'
import { getNodeBuilder } from './utils/state-tree.js'

// @ts-ignore
global.fetch = fetch

// Poll until no node in the state tree is still loading — i.e. every asynchronous
// getItems fetch has resolved and been applied. Replaces the arbitrary setTimeout
// waits that raced the fetch and made these tests flaky under load.
const waitForSettled = async (statefulLayout, timeoutMs = 2000) => {
  const isLoading = (node) => !!node && (node.loading === true || (node.children ?? []).some(isLoading))
  const start = Date.now()
  while (isLoading(statefulLayout.stateTree.root)) {
    if (Date.now() - start > timeoutMs) throw new Error('timeout waiting for layout to settle (loading never cleared)')
    await new Promise(resolve => setTimeout(resolve, 5))
  }
}

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
    await waitForSettled(statefulLayout)
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
    await waitForSettled(statefulLayout)
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
    await waitForSettled(statefulLayout)
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
          unevaluatedProperties: false,
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

    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], { updateOn: 'blur' })
    const getNode = getNodeBuilder(statefulLayout)
    assert.ok(statefulLayout.valid)
    assert.deepEqual(statefulLayout.data, { type: 'icon-single', icon: { name: 'map-marker', } })

    // switch to multiple icons mode
    statefulLayout.activateItem(getNode('$oneOf'), 1)
    const fields = await statefulLayout.getItems(getNode('$oneOf.1.field'))

    // select field, icons whould be filled
    statefulLayout.input(getNode('$oneOf.1.field'), fields[0].value)
    assert.equal(getNode('$oneOf.1.$deps-field.icons').children?.length, 0)
    await waitForSettled(statefulLayout)
    assert.equal(getNode('$oneOf.1.$deps-field.icons').children?.length, 2)
    assert.deepEqual(getNode('$oneOf.1.$deps-field.icons.0').data, { value: 'val_1', icon: { name: 'map-marker' } })

    // select other field, icons whould be re-filled
    statefulLayout.input(getNode('$oneOf.1.field'), fields[1].value)
    await waitForSettled(statefulLayout)
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
    await waitForSettled(statefulLayout)
    assert.equal(getNode('$oneOf.1.$deps-field.icons').children?.length, 2)
    assert.deepEqual(getNode('$oneOf.1.$deps-field.icons.0').data, { value: 'val_a', icon: { name: 'map-marker' } })
    assert.deepEqual(statefulLayout.data, {
      type: 'icon-multiple',
      field: 'prop2',
      icons: [
        { value: 'val_a', icon: { name: 'map-marker' } },
        { value: 'val_b', icon: { name: 'map-marker' } }
      ]
    })

    assert.deepEqual(getNode('$oneOf.1').skeleton.propertyKeys, ['type', 'field', 'icons'])

    nock.cleanAll()
  })

  describe('produceListData merge behavior', () => {
    /**
     * Build a stateful layout whose `arr1` array is filled by `getItems` from
     * `http://test.com/${parent.data.str1}`. The schema items have a `key`
     * (used as itemKey by default) and a `local` field that is locally editable.
     * Optionally extends the array layout with extra options (e.g. listActions).
     * @param {object} initialData
     * @param {Record<string, any>} [extraArrayLayout]
     */
    const buildLayout = (initialData, extraArrayLayout = {}) => {
      const compiledLayout = compile({
        type: 'object',
        properties: {
          arr1: {
            type: 'array',
            // eslint-disable-next-line no-template-curly-in-string
            layout: { comp: 'list', getItems: { url: 'http://test.com/${parent.data.str1}' }, ...extraArrayLayout },
            items: { type: 'object', properties: { key: { type: 'string' }, local: { type: 'string' } } }
          },
          str1: { type: 'string' }
        }
      })
      return new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], { debounceInputMs: 0 }, initialData)
    }

    it('preserves the full local data object on a matching key (current behavior)', async () => {
      nock('http://test.com').get('/req1').reply(200, [{ key: 'val1', local: 'from-server' }, { key: 'val2', local: 'from-server' }])
      const statefulLayout = buildLayout({
        str1: 'req1',
        arr1: [{ key: 'val1', local: 'edited-locally' }, { key: 'val2' }]
      })
      await waitForSettled(statefulLayout)
      const arrNode = statefulLayout.stateTree.root.children?.[0]
      assert.ok(arrNode)
      // local edits win over server values; the new item.value is discarded for matching keys
      assert.deepEqual(arrNode.data, [{ key: 'val1', local: 'edited-locally' }, { key: 'val2' }])
      nock.cleanAll()
    })

    it('uses getItems order, not local order, when listActions does not include sort (current behavior)', async () => {
      nock('http://test.com').get('/req1').reply(200, [{ key: 'val1' }, { key: 'val2' }, { key: 'val3' }])
      const statefulLayout = buildLayout({
        str1: 'req1',
        arr1: [{ key: 'val3' }, { key: 'val1' }, { key: 'val2' }]
      })
      await waitForSettled(statefulLayout)
      const arrNode = statefulLayout.stateTree.root.children?.[0]
      assert.ok(arrNode)
      assert.deepEqual(arrNode.data, [{ key: 'val1' }, { key: 'val2' }, { key: 'val3' }])
      nock.cleanAll()
    })

    it('drops items absent from a fresh getItems result (current behavior)', async () => {
      nock('http://test.com').get('/req1').reply(200, [{ key: 'val1' }, { key: 'val2' }])
      const statefulLayout = buildLayout({
        str1: 'req1',
        arr1: [{ key: 'val1' }, { key: 'val2' }, { key: 'val3', local: 'edited-locally' }]
      })
      await waitForSettled(statefulLayout)
      const arrNode = statefulLayout.stateTree.root.children?.[0]
      assert.ok(arrNode)
      // val3 is gone even though it had local edits — getItems is the source of truth for membership
      assert.deepEqual(arrNode.data, [{ key: 'val1' }, { key: 'val2' }])
      nock.cleanAll()
    })

    it('appends items new to a getItems result (current behavior)', async () => {
      nock('http://test.com').get('/req1').reply(200, [{ key: 'val1' }, { key: 'val2' }, { key: 'val3' }])
      const statefulLayout = buildLayout({
        str1: 'req1',
        arr1: [{ key: 'val1', local: 'edited-locally' }]
      })
      await waitForSettled(statefulLayout)
      const arrNode = statefulLayout.stateTree.root.children?.[0]
      assert.ok(arrNode)
      assert.deepEqual(arrNode.data, [{ key: 'val1', local: 'edited-locally' }, { key: 'val2' }, { key: 'val3' }])
      nock.cleanAll()
    })

    it('preserves local order across a re-fetch when listActions includes sort', async () => {
      nock('http://test.com')
        .get('/req1').reply(200, [{ key: 'val1' }, { key: 'val2' }, { key: 'val3' }])
        .get('/req2').reply(200, [{ key: 'val1' }, { key: 'val2' }, { key: 'val3' }])
      const statefulLayout = buildLayout({
        str1: 'req1',
        arr1: [{ key: 'val3' }, { key: 'val1', local: 'edited-locally' }, { key: 'val2' }]
      }, { listActions: ['edit', 'sort'] })
      await waitForSettled(statefulLayout)
      let arrNode = statefulLayout.stateTree.root.children?.[0]
      assert.ok(arrNode)
      // local order is kept on the first fetch when keys match
      assert.deepEqual(arrNode.data, [{ key: 'val3' }, { key: 'val1', local: 'edited-locally' }, { key: 'val2' }])

      // trigger a re-fetch by changing the parent dep
      const strNode = statefulLayout.stateTree.root.children?.[1]
      assert.ok(strNode)
      statefulLayout.input(strNode, 'req2')
      await waitForSettled(statefulLayout)
      arrNode = statefulLayout.stateTree.root.children?.[0]
      assert.ok(arrNode)
      assert.deepEqual(arrNode.data, [{ key: 'val3' }, { key: 'val1', local: 'edited-locally' }, { key: 'val2' }])
      nock.cleanAll()
    })

    it('appends new keys at the end while preserving local order (sort enabled)', async () => {
      nock('http://test.com').get('/req1').reply(200, [{ key: 'val1' }, { key: 'val2' }, { key: 'val3' }])
      const statefulLayout = buildLayout({
        str1: 'req1',
        arr1: [{ key: 'val2' }, { key: 'val1' }]
      }, { listActions: ['edit', 'sort'] })
      await waitForSettled(statefulLayout)
      const arrNode = statefulLayout.stateTree.root.children?.[0]
      assert.ok(arrNode)
      assert.deepEqual(arrNode.data, [{ key: 'val2' }, { key: 'val1' }, { key: 'val3' }])
      nock.cleanAll()
    })

    it('drops removed keys while preserving local order (sort enabled)', async () => {
      nock('http://test.com').get('/req1').reply(200, [{ key: 'val1' }, { key: 'val2' }])
      const statefulLayout = buildLayout({
        str1: 'req1',
        arr1: [{ key: 'val3' }, { key: 'val1' }, { key: 'val2' }]
      }, { listActions: ['edit', 'sort'] })
      await waitForSettled(statefulLayout)
      const arrNode = statefulLayout.stateTree.root.children?.[0]
      assert.ok(arrNode)
      assert.deepEqual(arrNode.data, [{ key: 'val1' }, { key: 'val2' }])
      nock.cleanAll()
    })

    it('falls back to getItems order on the very first fetch when no local data exists (sort enabled)', async () => {
      nock('http://test.com').get('/req1').reply(200, [{ key: 'val1' }, { key: 'val2' }, { key: 'val3' }])
      const statefulLayout = buildLayout({
        str1: 'req1',
        arr1: []
      }, { listActions: ['edit', 'sort'] })
      await waitForSettled(statefulLayout)
      const arrNode = statefulLayout.stateTree.root.children?.[0]
      assert.ok(arrNode)
      assert.deepEqual(arrNode.data, [{ key: 'val1' }, { key: 'val2' }, { key: 'val3' }])
      nock.cleanAll()
    })

    it('replaces local data on key match when listActions has no "edit" and listEditMode is not "inline" (capability B)', async () => {
      nock('http://test.com').get('/req1').reply(200, [{ key: 'val1', local: 'from-server' }, { key: 'val2', local: 'from-server' }])
      // default listEditMode for object items is 'inline-single', not 'inline'
      const statefulLayout = buildLayout({
        str1: 'req1',
        arr1: [{ key: 'val1', local: 'edited-locally' }, { key: 'val2', local: 'edited-locally' }]
      }, { listActions: ['delete'] })
      await waitForSettled(statefulLayout)
      const arrNode = statefulLayout.stateTree.root.children?.[0]
      assert.ok(arrNode)
      // server values win over local because items can't be edited (no "edit" action, listEditMode != "inline")
      assert.deepEqual(arrNode.data, [{ key: 'val1', local: 'from-server' }, { key: 'val2', local: 'from-server' }])
      nock.cleanAll()
    })

    it('preserves local data on key match when listEditMode is "inline" even without an edit action (capability B inactive)', async () => {
      nock('http://test.com').get('/req1').reply(200, [{ key: 'val1', local: 'from-server' }])
      const statefulLayout = buildLayout({
        str1: 'req1',
        arr1: [{ key: 'val1', local: 'edited-locally' }]
      }, { listActions: ['delete'], listEditMode: 'inline' })
      await waitForSettled(statefulLayout)
      const arrNode = statefulLayout.stateTree.root.children?.[0]
      assert.ok(arrNode)
      // listEditMode 'inline' makes items editable even without the 'edit' action, so local wins
      assert.deepEqual(arrNode.data, [{ key: 'val1', local: 'edited-locally' }])
      nock.cleanAll()
    })

    it('combines sort and replaceData: preserves local order while replacing values on match', async () => {
      nock('http://test.com').get('/req1').reply(200, [
        { key: 'val1', local: 'srv-1' },
        { key: 'val2', local: 'srv-2' },
        { key: 'val3', local: 'srv-3' }
      ])
      const statefulLayout = buildLayout({
        str1: 'req1',
        arr1: [
          { key: 'val3', local: 'old-3' },
          { key: 'val1', local: 'old-1' },
          { key: 'val2', local: 'old-2' }
        ]
      }, { listActions: ['sort'] })
      await waitForSettled(statefulLayout)
      const arrNode = statefulLayout.stateTree.root.children?.[0]
      assert.ok(arrNode)
      // local order preserved; server values applied to each matching key
      assert.deepEqual(arrNode.data, [
        { key: 'val3', local: 'srv-3' },
        { key: 'val1', local: 'srv-1' },
        { key: 'val2', local: 'srv-2' }
      ])
      nock.cleanAll()
    })
  })
})
