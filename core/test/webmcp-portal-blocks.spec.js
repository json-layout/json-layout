import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { compile } from '../src/compile/index.js'
import { StatefulLayout } from '../src/state/index.js'
import { WebMCP } from '../src/webmcp/index.js'

// The shape of data-fair portals' page form, where the judged agent runs of 2026-11-10/12
// found these: blocks of a discriminated union, edited in dialogs, an item default that
// generates an id, defaults filled on load.
const blockSchema = {
  type: 'object',
  properties: {
    elements: {
      type: 'array',
      layout: { listEditMode: 'dialog' },
      items: {
        type: 'object',
        layout: { getDefaultData: "{ uuid: 'generated', type: 'text' }" },
        discriminator: { propertyName: 'type' },
        oneOf: [
          {
            title: 'Title',
            additionalProperties: false,
            required: ['type'],
            properties: { type: { const: 'title' }, uuid: { type: 'string', layout: 'none' }, content: { type: 'string' } }
          },
          {
            title: 'Text',
            additionalProperties: false,
            required: ['type'],
            properties: { type: { const: 'text' }, uuid: { type: 'string', layout: 'none' }, content: { type: 'string' } }
          },
          {
            title: 'Dataset table',
            additionalProperties: false,
            required: ['type', 'dataset'],
            properties: {
              type: { const: 'dataset-table' },
              uuid: { type: 'string', layout: 'none' },
              dataset: { type: 'string' },
              interactions: { type: 'boolean', default: false }
            }
          }
        ]
      }
    }
  }
}

/**
 * @param {unknown} data
 * @param {any} [schema]
 * @param {any} [options]
 */
function setup (data, schema = blockSchema, options = {}) {
  const compiled = compile(schema)
  const layout = new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree], { validateOn: 'input', debounceInputMs: 0, ...options }, data)
  const webmcp = new WebMCP(layout, { screen: false })
  const tools = webmcp.getTools()
  /**
   * @param {string} name
   * @param {any} args
   * @returns {Promise<string>}
   */
  const run = async (name, args) => {
    const result = await /** @type {any} */(tools.find((t) => t.name === name)).execute(args)
    return result.content.map((/** @type {any} */ c) => c.text).join('')
  }
  return { layout, webmcp, run }
}

describe('webmcp list edited in dialogs, data replaced by a shorter list', () => {
  it('should not put back the item that was being edited past the new end', async () => {
    // the dialog's copy of the activated item was built at its index whatever the data: with
    // its getDefaultData it wrote a new block, with a generated uuid, into the saved page
    const { layout, run } = setup({ elements: [{ type: 'title', content: 'a' }, { type: 'text', content: 'b' }] })
    await run('editArray', { path: '/elements', action: 'add', value: { type: 'title', content: 'c' } })
    await run('setData', { data: { elements: [{ type: 'title', content: 'x' }, { type: 'text', content: 'y' }] } })
    assert.deepEqual(/** @type {any} */(layout.data).elements, [{ type: 'title', content: 'x' }, { type: 'text', content: 'y' }])
  })
})
