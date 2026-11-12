import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { compile } from '../src/compile/index.js'
import { serialize } from '../src/compile/serialize.js'
import { StatefulLayout } from '../src/state/index.js'
import { WebMCP } from '../src/webmcp/index.js'
import { collectErrors, collectScopedErrors } from '../src/webmcp/errors.js'
import { resolveNode } from '../src/webmcp/resolve.js'
import { getCase } from '../webmcp-eval/cases/index.js'

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

describe('webmcp keys a write could not store', () => {
  it('should report the unknown keys of an item editArray adds, first', async () => {
    const { run } = setup({ elements: [] })
    const text = await run('editArray', { path: '/elements', action: 'add', value: { type: 'title', text: 'Agenda' } })
    assert.match(text, /^NOT STORED: 1 key\(s\) match no field of this form and were dropped: \/elements\/0\/text — check the field names with describeState\n/, text)
  })

  it('should start a setData answer with what was not stored', async () => {
    const { run } = setup({ elements: [] })
    const text = await run('setData', { data: { elements: [{ type: 'title', title: 'T' }] } })
    assert.match(text, /^NOT STORED: 1 key\(s\) match no field of this form and were dropped: \/elements\/0\/title/, text)
    assert.ok(text.indexOf('NOT STORED') < text.indexOf('valid'), text)
  })

  it('should not report a key the schema declares but the form does not show', async () => {
    // portals checks-r1: a block's uuid (no component) was reported as matching no field, and
    // rev-r1: a title's anchor.inToc, a field hidden while the anchor is off
    const schema = {
      type: 'object',
      properties: {
        elements: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              uuid: { type: 'string', layout: 'none' },
              content: { type: 'string' },
              anchor: { type: 'object', properties: { enabled: { type: 'boolean' }, inToc: { type: 'boolean', layout: { if: 'parent.data?.enabled' } } } }
            }
          }
        }
      }
    }
    const { layout, run } = setup({ elements: [] }, schema)
    const added = await run('editArray', { path: '/elements', action: 'add', value: { uuid: 'u9', content: 'x', anchor: { enabled: false, inToc: false } } })
    assert.doesNotMatch(added, /match no field/, added)
    const written = await run('setData', { data: { elements: [{ uuid: 'u8', content: 'y', anchor: { enabled: false, inToc: false } }] } })
    assert.doesNotMatch(written, /match no field/, written)
    assert.equal(/** @type {any} */(layout.data).elements[0].uuid, 'u8')
  })

  it('should not count as stored a key it dropped', async () => {
    // eval portal-config-multi: data keyed by a layout segment ({ 'comp-1': ... }) was reported
    // dropped and stored in the same answer
    const { run } = setup({ name: 'x' }, { type: 'object', additionalProperties: false, properties: { name: { type: 'string' } } })
    const text = await run('setData', { data: { 'comp-1': { socialShares: ['bluesky'] } } })
    assert.match(text, /^NOT STORED: 1 key\(s\) match no field of this form and were dropped: \/comp-1/, text)
    assert.doesNotMatch(text, /stored 1 key/, text)
  })

  it('should say a key it keeps without a field is kept and saved', async () => {
    // "were ignored by it" read as not stored, and the key was saved with the page
    const { run } = setup({ name: 'x' }, { type: 'object', properties: { name: { type: 'string' } } })
    const text = await run('setData', { data: { name: 'y', extra: 1 } })
    assert.match(text, /^1 key\(s\) match no field of this form: they are kept in the data as given and saved with it, but no field shows or checks them: \/extra/, text)
  })
})

describe('webmcp errors of a discriminated union in a list', () => {
  it('should not report the other options\' errors against an item not being edited', async () => {
    // portals rev-r1 page-avec-donnees: "/elements/2: must NOT have additional properties:
    // interactions", from the title and text options, and the agent offered to remove it
    const { layout, run } = setup({ elements: [{ type: 'title', content: 'a' }, { type: 'text', content: 'b' }] })
    await run('editArray', { path: '/elements', action: 'add', value: { type: 'dataset-table' } })
    const text = await run('setFieldValue', { path: '/elements/0/content', value: 'x' })
    const errors = collectErrors(layout)
    assert.deepEqual(errors.map((e) => e.message), ['required information'], JSON.stringify(errors))
    assert.doesNotMatch(text, /additional properties|chose one/, text)
  })
})

describe('webmcp editArray add with its option chosen', () => {
  it('should name the option rather than list them all', async () => {
    const { run } = setup({ elements: [] })
    const text = await run('editArray', { path: '/elements', action: 'add', value: { type: 'text', content: 'x' } })
    assert.match(text, /- variant 1: Text \(active\), one of 3 options \(describeState \/elements\/0\/\$oneOf to list them\)/, text)
    assert.doesNotMatch(text, /variant 2: /, text)
    // the list was not printed: an add without a value still prints it
    const bare = await run('editArray', { path: '/elements', action: 'add' })
    assert.match(bare, /variant 2: /, bare)
  })
})

describe('webmcp read of a field a condition hides', () => {
  it('should say the field is hidden, not missing', async () => {
    const { run } = setup({ theme: { assisted: true, colors: { primary: '#000000' } } }, {
      type: 'object',
      properties: {
        theme: {
          type: 'object',
          properties: {
            assisted: { type: 'boolean' },
            colors: { type: 'object', layout: { if: '!parent.data?.assisted' }, properties: { primary: { type: 'string' } } }
          }
        }
      }
    })
    const text = await run('getData', { path: '/theme/colors/primary' })
    assert.match(text, /^Error: hidden field at path: \/theme\/colors\/primary\. The value exists in the data but its field is not shown in the form right now: a condition hides it/, text)
  })
})

describe('webmcp typed values of a list of suggestions', () => {
  const columnsSchema = {
    type: 'object',
    properties: {
      cols: {
        type: 'array',
        items: { type: 'string' },
        layout: { comp: 'autocomplete', multiple: true, getItems: { url: 'http://example.com/columns', itemsResults: 'data.results', itemKey: 'item.key', itemTitle: 'item.title', itemValue: 'item.key' } }
      },
      commune: {
        type: 'string',
        layout: { getItems: { url: 'http://example.com/communes', itemsResults: 'data.results', itemKey: 'item.code', itemTitle: 'item.label', itemValue: 'item.code' } }
      }
    }
  }
  /** @param {string} url */
  const fetch = async (url) => url.includes('columns')
    ? { results: [{ key: 'nom', title: 'nom' }, { key: 'commune', title: 'commune' }, { key: 'type', title: 'type' }] }
    : { results: [{ code: '44109', label: 'Nantes' }] }

  it('should accept values the list holds under their own name', async () => {
    // portals rev-r2: ["nom","commune","type"] were the columns, and were refused twice as
    // "not among the suggestions"
    const { webmcp, run } = setup({}, columnsSchema, { fetch })
    const text = await run('setFieldValue', { path: '/cols', value: ['nom', 'commune', 'type'] })
    assert.doesNotMatch(text, /not among the suggestions/, text)
    assert.deepEqual(webmcp.unpickedValues(), [])
  })

  it('should still tell a code typed from memory', async () => {
    const { run } = setup({}, columnsSchema, { fetch })
    const text = await run('setFieldValue', { path: '/commune', value: '44109' })
    assert.equal(text.match(/not among the suggestions/g)?.length, 1, text)
  })
})

describe('webmcp writes an approval reviewer can read', () => {
  const pickSchema = {
    type: 'object',
    properties: {
      // an object value, which no call can spell: only the index picks it
      dataset: { type: 'object', properties: { id: { type: 'string' }, title: { type: 'string' } }, layout: { getItems: { url: 'http://example.com/datasets', itemsResults: 'data.results', itemKey: 'item.id', itemTitle: 'item.title' } } }
    }
  }
  const fetch = async () => ({ results: [{ id: 'sim-suivi', title: 'Suivi des demandes' }, { id: 'sim-equip', title: 'Équipements sportifs' }] })

  it('should check the title given with a suggestionIndex', async () => {
    // portals rev-r1: `suggestionIndex: 0` alone was judged unsure twice, "nothing proves
    // index 0 is Équipements sportifs": the reviewer never sees getFieldSuggestions' answer
    const { layout, run } = setup({}, pickSchema, { fetch })
    const listed = await run('getFieldSuggestions', { path: '/dataset' })
    assert.match(listed, /apply with suggestionIndex=1, suggestionTitle="Équipements sportifs"/, listed)
    const wrong = await run('setFieldValue', { path: '/dataset', suggestionIndex: 0, suggestionTitle: 'Équipements sportifs' })
    assert.match(wrong, /^Error: suggestion 0 of \/dataset is "Suivi des demandes", not "Équipements sportifs"; nothing was written/, wrong)
    assert.equal(/** @type {any} */(layout.data).dataset?.id, undefined)
    await run('setFieldValue', { path: '/dataset', suggestionIndex: 1, suggestionTitle: 'Équipements sportifs' })
    assert.equal(/** @type {any} */(layout.data).dataset.id, 'sim-equip')
  })

  it('should check the item a positional path names', async () => {
    // portals rev-r1/r2: a write on /elements/1 right after an add was judged "could name
    // another item", and a person refused a correct one
    const { layout, run } = setup({ elements: [{ type: 'title', uuid: 'u0', content: 'a' }, { type: 'text', uuid: 'u1', content: 'b' }] })
    const wrong = await run('setFieldValue', { path: '/elements/1/content', value: 'x', item: { uuid: 'u0' } })
    assert.match(wrong, /^Error: the item at \/elements\/1 does not match "item": uuid is "u1", not "u0"\. Nothing was written/, wrong)
    assert.equal(/** @type {any} */(layout.data).elements[1].content, 'b')
    await run('setFieldValue', { path: '/elements/1/content', value: 'x', item: { uuid: 'u1', type: 'text' } })
    assert.equal(/** @type {any} */(layout.data).elements[1].content, 'x')
  })

  it('should check the item editArray removes or moves', async () => {
    const { layout, run } = setup({ elements: [{ type: 'title', uuid: 'u0' }, { type: 'text', uuid: 'u1' }] })
    const wrong = await run('editArray', { path: '/elements', action: 'remove', index: 0, item: { uuid: 'u1' } })
    assert.match(wrong, /^Error: the item at \/elements\/0 does not match "item"/, wrong)
    assert.equal(/** @type {any} */(layout.data).elements.length, 2)
    await run('editArray', { path: '/elements', action: 'move', from: 1, to: 0, item: { uuid: 'u1' } })
    assert.deepEqual(/** @type {any} */(layout.data).elements.map((/** @type {any} */ e) => e.uuid), ['u1', 'u0'])
  })

  it('should refuse a guard on a path in no list item', async () => {
    const { run } = setup({ name: 'x' }, { type: 'object', properties: { name: { type: 'string' } } })
    const text = await run('setFieldValue', { path: '/name', value: 'y', item: { uuid: 'u0' } })
    assert.match(text, /^Error: "item" checks the list item a write applies to, and \/name is in no list item/, text)
  })
})

/**
 * The layout as production ships it: compiled at build time, serialized, without the raw schema.
 * @param {any} schema
 * @param {any} [options]
 * @param {string} name
 */
async function compileBuildTime (schema, options, name) {
  const code = (await serialize(compile(schema, options))) + '\nexport default compiledLayout;'
  mkdirSync(resolve('tmp'), { recursive: true })
  const file = resolve(`tmp/webmcp-portal-blocks-${name}.js`)
  writeFileSync(file, code)
  return (await import(file)).default
}

describe('webmcp errors of union branches reached through $ref', () => {
  for (const compileMode of ['runtime', 'build-time']) {
    it(`should report only the errors of the chart type and data preparation chosen (${compileMode})`, async () => {
    // eval charts (session arm): "form has 140 other error(s)" and "/chart/config: must NOT
    // have additional properties: groupBy" while one field was missing. ajv reports a branch
    // that is a $ref at its definition, so the union it was reached through is not in its path.
      const evalCase = getCase('charts')
      const compiled = compileMode === 'runtime' ? compile(evalCase.schema, evalCase.compileOptions) : await compileBuildTime(evalCase.schema, evalCase.compileOptions, 'charts')
      if (compileMode === 'build-time') assert.ok(!compiled.schema, 'the shipped layout has no raw schema to read branches from')
      const data = {
        datasets: [{ id: 'd1', href: 'http://example.com/datasets/d1', title: 'Air', schema: [{ key: 'nom_com', type: 'string' }, { key: 'valeur', type: 'number' }] }],
        chart: { type: 'bar', config: { type: 'aggsBased', groupBy: { type: 'value', field: 'nom_com' }, valueCalc: { type: 'metric', metric: 'avg' } } }
      }
      const layout = new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree], { context: evalCase.context ?? {}, validateOn: 'input', fetch: async () => { throw new Error('offline') } }, data)
      assert.ok(layout.validationErrors.length > 100, 'ajv reports every branch of every union')
      assert.deepEqual(collectErrors(layout), [
        { path: '/$allOf-1/chart/$oneOf/1/config/$oneOf/2/valueCalc/$oneOf', message: 'required information' },
        { path: '/$allOf-1/chart/$oneOf/1/config/$oneOf/2/valueCalc/$oneOf/1/field', message: 'required information' }
      ])
      // a write elsewhere counts the errors it lists: "3 other error(s)" above two listed ones
      // came from a node echo the list drops
      const title = /** @type {any} */(resolveNode(layout.stateTree.root, '/$allOf-2/title'))
      assert.ok(title, 'the title field exists')
      const scoped = collectScopedErrors(layout, title)
      assert.equal(scoped.otherErrors, 2)
      assert.equal(scoped.elsewhere?.length, 2)
    })
  }
})

describe('webmcp describeState of an item not added yet', () => {
  it('should give each option its discriminator value', async () => {
    // eval choropleth and portal-page (session): the options of an item not added yet were
    // listed by label only, and agents wrote { type: "0" } or { type: "Deux colonnes" }
    const { run } = setup({ elements: [] })
    const text = await run('describeState', { path: '/elements/0' })
    assert.match(text, /^not in the form yet/, text)
    assert.match(text, /- variant 0: Title \(type="title"\)/, text)
    assert.match(text, /- variant 2: Dataset table \(type="dataset-table"\)/, text)
  })
})
