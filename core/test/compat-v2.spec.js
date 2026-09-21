import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'

import { v2compat } from '../src/compat/v2.js'
import { compile } from '../src/compile/index.js'

describe('vjsf v2 compatibility layer', () => {
  it('translates x-fromUrl and its item keywords into layout.getItems', () => {
    const schema = v2compat({
      type: 'object',
      properties: {
        dataset: {
          type: 'object',
          title: 'Jeu de données',
          'x-fromUrl': 'https://example.com/datasets?q={q}',
          'x-itemsProp': 'results',
          'x-itemTitle': 'title',
          'x-itemKey': 'id'
        }
      }
    })

    const layout = schema.properties.dataset.layout
    assert.deepEqual(layout.getItems.url, { type: 'js-tpl', expr: 'https://example.com/datasets?q={q}', pure: true })
    assert.equal(layout.getItems.itemsResults, 'data["results"]')
    assert.equal(layout.getItems.itemTitle, 'data["title"]')
    assert.equal(layout.getItems.itemKey, 'data["id"]')

    for (const gone of ['x-fromUrl', 'x-itemsProp', 'x-itemTitle', 'x-itemKey']) {
      assert.equal(gone in schema.properties.dataset, false, `${gone} should be consumed`)
    }
  })

  it('translates x-if into a layout condition', () => {
    const schema = v2compat({
      type: 'object',
      properties: {
        mode: { type: 'string' },
        detail: { type: 'string', 'x-if': 'mode === "advanced"' }
      }
    })

    assert.equal('x-if' in schema.properties.detail, false)
    assert.ok(schema.properties.detail.layout.if, 'a condition should be produced')
  })

  it('leaves the source schema untouched', () => {
    const source = { type: 'object', properties: { a: { type: 'string', 'x-display': 'textarea' } } }
    v2compat(source)
    assert.equal(source.properties.a['x-display'], 'textarea')
  })

  it('produces a schema compile accepts', () => {
    const schema = v2compat({
      type: 'object',
      properties: {
        label: { type: 'string', 'x-display': 'textarea' },
        dataset: {
          type: 'object',
          'x-fromUrl': 'https://example.com/datasets',
          'x-itemsProp': 'results',
          'x-itemTitle': 'title'
        }
      }
    })

    // The point of the layer: the same schema compiled raw keeps the vendor keywords and
    // renders as a plain section, which is the failure the webmcp eval recorded.
    assert.doesNotThrow(() => compile(schema))
  })
})
