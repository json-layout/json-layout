/* eslint-disable no-template-curly-in-string */
import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import nock from 'nock'
import fetch from 'node-fetch'
import { compile, StatefulLayout } from '../src/index.js'

// @ts-ignore
global.fetch = fetch

describe('get select items', () => {
  const defaultOptions = { debounceInputMs: 0 }

  it('should manage a select with enum', async () => {
    const compiledLayout = await compile({
      type: 'string',
      enum: ['val1', 'val2']
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions, {})
    assert.equal(statefulLayout.stateTree.root.layout.comp, 'select')
    const items = await statefulLayout.getItems(statefulLayout.stateTree.root)
    assert.deepEqual(items, [
      { title: 'val1', key: 'val1', value: 'val1' },
      { title: 'val2', key: 'val2', value: 'val2' }
    ])

    // when the node is mutated its cache key is not mutated and items are not recreated
    statefulLayout.input(statefulLayout.stateTree.root, 'val1')
    const items2 = await statefulLayout.getItems(statefulLayout.stateTree.root)
    assert.equal(items, items2)

    const items3 = await statefulLayout.getItems(statefulLayout.stateTree.root, 'val1')
    assert.equal(items3.length, 1)
    assert.equal(items3[0], items[0])
  })

  it('should manage a combobox with examples', async () => {
    const compiledLayout = await compile({
      type: 'string',
      examples: ['val1', 'val2']
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions, {})
    assert.equal(statefulLayout.stateTree.root.layout.comp, 'combobox')
    const items = await statefulLayout.getItems(statefulLayout.stateTree.root)
    assert.deepEqual(items, [
      { title: 'val1', key: 'val1', value: 'val1' },
      { title: 'val2', key: 'val2', value: 'val2' }
    ])
  })

  it('should manage a select with items', async () => {
    const compiledLayout = await compile({
      type: 'string',
      layout: { items: ['val1', 'val2'] }
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions, {})
    assert.equal(statefulLayout.stateTree.root.layout.comp, 'select')
    const items = await statefulLayout.getItems(statefulLayout.stateTree.root)
    assert.deepEqual(items, [
      { title: 'val1', key: 'val1', value: 'val1' },
      { title: 'val2', key: 'val2', value: 'val2' }
    ])
  })

  it('should manage a select with getItems as a simple expression', async () => {
    const compiledLayout = await compile({ type: 'string', layout: { getItems: 'options.context.items' } })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], { ...defaultOptions, context: { items: ['val1', 'val2'] } }, {})
    assert.equal(statefulLayout.stateTree.root.layout.comp, 'select')
    const items = await statefulLayout.getItems(statefulLayout.stateTree.root)
    assert.deepEqual(items, [
      { title: 'val1', key: 'val1', value: 'val1' },
      { title: 'val2', key: 'val2', value: 'val2' }
    ])
  })

  it('should manage a select with getItems as a more complex expression', async () => {
    const compiledLayout = await compile({ type: 'string', layout: { getItems: 'options.context.items.map(item => ({title: item.toUpperCase(), key: item, value: item}))' } })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], { ...defaultOptions, context: { items: ['val1', 'val2'] } }, {})
    assert.equal(statefulLayout.stateTree.root.layout.comp, 'select')
    const items = await statefulLayout.getItems(statefulLayout.stateTree.root)
    assert.deepEqual(items, [
      { title: 'VAL1', key: 'val1', value: 'val1' },
      { title: 'VAL2', key: 'val2', value: 'val2' }
    ])
  })

  it('should manage a select with getItems as fetch instruction with search params and headers', async () => {
    const compiledLayout = await compile({
      type: 'string',
      layout: {
        getItems: {
          url: 'http://${options.context.domain}/test',
          searchParams: {
            se: 'options.context.searchParam'
          },
          headers: {
            'x-apiKey': '"test"'
          },
          itemsResults: 'data.results',
          itemTitle: 'data.toUpperCase()'
        }
      }
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], { ...defaultOptions, context: { domain: 'test.com', searchParam: 'test' } }, {})
    assert.equal(statefulLayout.stateTree.root.layout.comp, 'select')
    const nockScope = nock('http://test.com')
      .get('/test')
      .query({ se: 'test' })
      .matchHeader('x-apiKey', 'test')
      .reply(200, { results: ['val1', 'val2'] })
    const items = await statefulLayout.getItems(statefulLayout.stateTree.root)
    assert.ok(nockScope.isDone())
    assert.deepEqual(items, [
      { title: 'VAL1', key: 'val1', value: 'val1' },
      { title: 'VAL2', key: 'val2', value: 'val2' }
    ])

    // when the node is mutated its cache key is not mutated and items are not recreated
    statefulLayout.input(statefulLayout.stateTree.root, 'val1')
    const items2 = await statefulLayout.getItems(statefulLayout.stateTree.root)
    assert.equal(items, items2)

    // the q parameter is transmitted in the URL so cache still works
    const items3 = await statefulLayout.getItems(statefulLayout.stateTree.root, 'val1')
    assert.equal(items3.length, 1)
    assert.equal(items3[0], items[0])
  })

  it('should manage a autocomplete with getItems as fetch url with q param', async () => {
    const compiledLayout = await compile({ type: 'string', layout: { getItems: { url: 'http://${options.context.domain}/test?query={q}' } } })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], { ...defaultOptions, context: { domain: 'test.com' } }, {})
    assert.equal(statefulLayout.stateTree.root.layout.comp, 'autocomplete')
    let nockScope = nock('http://test.com')
      .get('/test')
      .reply(200, ['val1', 'val2'])
    let items = await statefulLayout.getItems(statefulLayout.stateTree.root)
    assert.ok(nockScope.isDone())
    assert.deepEqual(items, [
      { title: 'val1', key: 'val1', value: 'val1' },
      { title: 'val2', key: 'val2', value: 'val2' }
    ])

    // when the node is mutated its cache key is not mutated and items are not recreated
    statefulLayout.input(statefulLayout.stateTree.root, 'val1')
    const items2 = await statefulLayout.getItems(statefulLayout.stateTree.root)
    assert.equal(items, items2)

    nockScope = nock('http://test.com')
      .get('/test?query=val1')
      .reply(200, ['val1'])
    items = await statefulLayout.getItems(statefulLayout.stateTree.root, 'val1')
    assert.ok(nockScope.isDone())
    assert.deepEqual(items, [
      { title: 'val1', key: 'val1', value: 'val1' }
    ])
  })

  it('should manage a autocomplete with getItems as relative fetch url with q param', async () => {
    const compiledLayout = await compile({ type: 'string', layout: { getItems: { url: 'test?query={q}' } } })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], {
      ...defaultOptions,
      fetchBaseURL: '/base/'
    }, {})
    assert.equal(statefulLayout.stateTree.root.layout.comp, 'autocomplete')
    let nockScope = nock('http://test.com')
      .get('/base/test')
      .reply(200, ['val1', 'val2'])
    let items = await statefulLayout.getItems(statefulLayout.stateTree.root)
    assert.ok(nockScope.isDone())
    assert.deepEqual(items, [
      { title: 'val1', key: 'val1', value: 'val1' },
      { title: 'val2', key: 'val2', value: 'val2' }
    ])

    // when the node is mutated its cache key is not mutated and items are not recreated
    statefulLayout.input(statefulLayout.stateTree.root, 'val1')
    const items2 = await statefulLayout.getItems(statefulLayout.stateTree.root)
    assert.equal(items, items2)

    nockScope = nock('http://test.com')
      .get('/base/test?query=val1')
      .reply(200, ['val1'])
    items = await statefulLayout.getItems(statefulLayout.stateTree.root, 'val1')
    assert.ok(nockScope.isDone())
    assert.deepEqual(items, [
      { title: 'val1', key: 'val1', value: 'val1' }
    ])
  })

  it('should manage a autocomplete with getItems as fetch url without q param', async () => {
    const compiledLayout = await compile({ type: 'string', layout: { comp: 'autocomplete', getItems: { url: 'http://${options.context.domain}/test' } } })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], { ...defaultOptions, context: { domain: 'test.com' } }, {})
    assert.equal(statefulLayout.stateTree.root.layout.comp, 'autocomplete')
    const nockScope = nock('http://test.com')
      .get('/test')
      .reply(200, ['val1', 'val2'])
    let items = await statefulLayout.getItems(statefulLayout.stateTree.root)
    assert.ok(nockScope.isDone())
    assert.deepEqual(items, [
      { title: 'val1', key: 'val1', value: 'val1' },
      { title: 'val2', key: 'val2', value: 'val2' }
    ])

    items = await statefulLayout.getItems(statefulLayout.stateTree.root, 'val1')
    assert.deepEqual(items, [
      { title: 'val1', key: 'val1', value: 'val1' }
    ])
  })

  it('should manage a select with getItems as fetch instruction inside an object', async () => {
    const compiledLayout = await compile({
      type: 'object',
      layout: { getItems: { url: 'http://${options.context.domain}/test', itemsResults: 'data.results', itemKey: 'data.prop1', itemTitle: 'data.prop2.toUpperCase()' } }
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], { ...defaultOptions, removeAdditional: 'unknown', context: { domain: 'test.com' } }, {})
    assert.equal(statefulLayout.stateTree.root.layout.comp, 'select')
    const nockScope = nock('http://test.com')
      .get('/test')
      .reply(200, { results: [{ prop1: 'val1', prop2: 'val1' }, { prop1: 'val2', prop2: 'val2' }] })
    const items = await statefulLayout.getItems(statefulLayout.stateTree.root)
    assert.ok(nockScope.isDone())
    assert.deepEqual(items, [
      { title: 'VAL1', key: 'val1', value: { prop1: 'val1', prop2: 'val1' } },
      { title: 'VAL2', key: 'val2', value: { prop1: 'val2', prop2: 'val2' } }
    ])
  })

  it('should manage a select and remove additional properties from result', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        prop1: { type: 'string' },
        prop2: { type: 'string' }
      },
      layout: { getItems: { url: 'http://${options.context.domain}/test', itemsResults: 'data.results', itemKey: 'item.prop1', itemTitle: 'item.prop2' } }
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], { ...defaultOptions, removeAdditional: 'unknown', context: { domain: 'test.com' } }, {})
    assert.equal(statefulLayout.stateTree.root.layout.comp, 'select')
    const nockScope = nock('http://test.com')
      .get('/test')
      .reply(200, { results: [{ prop1: 'val1', prop2: 'val1', ignoreProp: 'val1' }, { prop1: 'val2', prop2: 'val2', ignoreProp: 'val2' }] })
    const items = await statefulLayout.getItems(statefulLayout.stateTree.root)
    assert.ok(nockScope.isDone())
    assert.deepEqual(items, [
      { title: 'val1', key: 'val1', value: { prop1: 'val1', prop2: 'val1', ignoreProp: 'val1' } },
      { title: 'val2', key: 'val2', value: { prop1: 'val2', prop2: 'val2', ignoreProp: 'val2' } }
    ])
    statefulLayout.input(statefulLayout.stateTree.root, items[0].value)
    assert.deepEqual(statefulLayout.data, { prop1: 'val1', prop2: 'val1' })
  })

  it('should manage a multiple select', async () => {
    const compiledLayout = await compile({
      type: 'array',
      layout: { getItems: { url: 'http://${options.context.domain}/test', itemsResults: 'data.results', itemKey: 'item.prop1', itemTitle: 'item.prop2' } },
      items: {
        type: 'object'
      }
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], { ...defaultOptions, removeAdditional: 'unknown', context: { domain: 'test.com' } }, {})
    assert.equal(statefulLayout.stateTree.root.layout.comp, 'select')
    const nockScope = nock('http://test.com')
      .get('/test')
      .reply(200, { results: [{ prop1: 'val1', prop2: 'val1', unknownProp: 'val1' }, { prop1: 'val2', prop2: 'val2', unknownProp: 'val2' }] })
    const items = await statefulLayout.getItems(statefulLayout.stateTree.root)
    assert.ok(nockScope.isDone())
    assert.deepEqual(items, [
      { title: 'val1', key: 'val1', value: { prop1: 'val1', prop2: 'val1', unknownProp: 'val1' } },
      { title: 'val2', key: 'val2', value: { prop1: 'val2', prop2: 'val2', unknownProp: 'val2' } }
    ])
    statefulLayout.input(statefulLayout.stateTree.root, [items[0].value])
    assert.equal(statefulLayout.valid, true)
    assert.deepEqual(statefulLayout.data, [{ prop1: 'val1', prop2: 'val1', unknownProp: 'val1' }])
  })

  it('should manage a multiple select and remove additional properties from result', async () => {
    const compiledLayout = await compile({
      type: 'array',
      layout: { getItems: { url: 'http://${options.context.domain}/test', itemsResults: 'data.results', itemKey: 'item.prop1', itemTitle: 'item.prop2' } },
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          prop1: { type: 'string' },
          prop2: { type: 'string' }
        }
      }
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], { ...defaultOptions, context: { domain: 'test.com' } }, {})
    assert.equal(statefulLayout.stateTree.root.layout.comp, 'select')
    const nockScope = nock('http://test.com')
      .get('/test')
      .reply(200, { results: [{ prop1: 'val1', prop2: 'val1', ignoreProp: 'val1' }, { prop1: 'val2', prop2: 'val2', ignoreProp: 'val2' }] })
    const items = await statefulLayout.getItems(statefulLayout.stateTree.root)
    assert.ok(nockScope.isDone())
    assert.deepEqual(items, [
      { title: 'val1', key: 'val1', value: { prop1: 'val1', prop2: 'val1', ignoreProp: 'val1' } },
      { title: 'val2', key: 'val2', value: { prop1: 'val2', prop2: 'val2', ignoreProp: 'val2' } }
    ])
    statefulLayout.input(statefulLayout.stateTree.root, [items[0].value])
    assert.equal(statefulLayout.valid, true)
    assert.deepEqual(statefulLayout.data, [{ prop1: 'val1', prop2: 'val1' }])
  })

  it('should use fetchOptions option as a RequestInit object', async () => {
    const compiledLayout = await compile({
      type: 'string',
      layout: { comp: 'autocomplete', getItems: { url: 'http://test.com/test' } }
    })
    const statefulLayout = new StatefulLayout(
      compiledLayout,
      compiledLayout.skeletonTrees[compiledLayout.mainTree],
      {
        ...defaultOptions,
        fetchOptions: { headers: { test: 'test header' } }
      },
      {})
    const nockScope = nock('http://test.com', { reqheaders: { test: 'test header' } })
      .get('/test')
      .reply(200, ['val1', 'val2'])
    const items = await statefulLayout.getItems(statefulLayout.stateTree.root)
    assert.ok(nockScope.isDone())
    assert.deepEqual(items, [
      { title: 'val1', key: 'val1', value: 'val1' },
      { title: 'val2', key: 'val2', value: 'val2' }
    ])
  })

  it('should use fetchOptions option as a function returning a RequestInit object', async () => {
    const compiledLayout = await compile({
      type: 'string',
      layout: { comp: 'autocomplete', getItems: { url: 'http://test.com/test' } }
    })
    const statefulLayout = new StatefulLayout(
      compiledLayout,
      compiledLayout.skeletonTrees[compiledLayout.mainTree],
      {
        ...defaultOptions,
        fetchOptions: (url) => ({ headers: { test: 'test header ' + url.host } })
      },
      {})
    const nockScope = nock('http://test.com', { reqheaders: { test: 'test header test.com' } })
      .get('/test')
      .reply(200, ['val1', 'val2'])
    const items = await statefulLayout.getItems(statefulLayout.stateTree.root)
    assert.ok(nockScope.isDone())
    assert.deepEqual(items, [
      { title: 'val1', key: 'val1', value: 'val1' },
      { title: 'val2', key: 'val2', value: 'val2' }
    ])
  })
})
