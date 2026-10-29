import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'

import { compile } from '../src/compile/index.js'
import { StatefulLayout } from '../src/state/index.js'
import { WebMCP } from '../src/webmcp/index.js'
import { getCase } from '../webmcp-eval/cases/index.js'
import { caseFetch, FIXTURE_BASE_URL } from '../webmcp-eval/remote.js'

/**
 * @param {Record<string, any>} tools
 * @param {string} name
 * @param {any} args
 * @returns {Promise<string>}
 */
const run = async (tools, name, args) => {
  const res = await tools[name].execute(args)
  return res.content.map((/** @type {any} */ p) => p.text ?? '').join('')
}

/**
 * The data-fair line case, its commune referential served offline as the eval does.
 * @param {Record<string, unknown>} [data]
 */
const lineForm = (data = {}) => {
  const evalCase = getCase('data-fair-line')
  const compiled = compile(evalCase.schema)
  const layout = new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree], {
    validateOn: 'input',
    debounceInputMs: 0,
    fetch: caseFetch(evalCase),
    fetchBaseURL: FIXTURE_BASE_URL
  }, structuredClone(data))
  const webmcp = new WebMCP(layout, { dataTitle: evalCase.title })
  return { layout, webmcp, tools: Object.fromEntries(webmcp.getTools().map((t) => [t.name, t])) }
}

describe('webmcp suggestions a write does not touch', () => {
  it('should keep a referential list across a setData of other fields', async () => {
    // round 2, data-fair-line--session r1 and r2: suggestions on /commune, a setData of the
    // other fields, and the index the agent held was refused as dropped
    const { tools, layout } = lineForm()
    const listed = await run(tools, 'getFieldSuggestions', { path: '/commune', query: 'Sébastien' })
    const index = listed.match(/\[(\d+)\] 44190/)?.[1]
    assert.ok(index !== undefined, listed)
    await run(tools, 'setData', { data: { nom: 'Dojo des Grands Bois', siret: '52348761900017' } })
    const applied = await run(tools, 'setFieldValue', { path: '/commune', suggestionIndex: Number(index) })
    assert.ok(!applied.startsWith('Error'), applied)
    assert.equal(/** @type {any} */(layout.data).commune, '44190')
  })

  it('should drop the list of a path whose value the setData changed', async () => {
    const { tools } = lineForm()
    await run(tools, 'getFieldSuggestions', { path: '/commune', query: 'Sébastien' })
    await run(tools, 'setData', { data: { commune: '44190' } })
    const applied = await run(tools, 'setFieldValue', { path: '/commune', suggestionIndex: 0 })
    assert.match(applied, /were dropped by a write/, applied)
  })

  const listSchema = {
    type: 'object',
    properties: {
      l: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            c: { type: 'string', oneOf: [{ const: 'x', title: 'X' }, { const: 'y', title: 'Y' }] }
          }
        }
      }
    }
  }
  const listTools = () => {
    const compiled = compile(listSchema)
    const layout = new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree], { debounceInputMs: 0 },
      { l: [{ name: 'a' }, { name: 'b' }, { name: 'c' }] })
    return { layout, tools: Object.fromEntries(new WebMCP(layout).getTools().map((t) => [t.name, t])) }
  }

  it('should keep the items before a removed one and drop the shifted ones', async () => {
    const { tools, layout } = listTools()
    await run(tools, 'getFieldSuggestions', { path: '/l/0/c' })
    await run(tools, 'getFieldSuggestions', { path: '/l/2/c' })
    await run(tools, 'editArray', { path: '/l', action: 'remove', index: 1 })
    const kept = await run(tools, 'setFieldValue', { path: '/l/0/c', suggestionIndex: 1 })
    assert.ok(!kept.startsWith('Error'), kept)
    assert.equal(/** @type {any} */(layout.data).l[0].c, 'y')
    // item 2 is now item 1, and nothing is memorized at /l/2 any more
    const shifted = await run(tools, 'setFieldValue', { path: '/l/1/c', suggestionIndex: 0 })
    assert.match(shifted, /^Error/, shifted)
  })

  it('should drop the lists at and after an added item', async () => {
    const { tools } = listTools()
    await run(tools, 'getFieldSuggestions', { path: '/l/0/c' })
    await run(tools, 'getFieldSuggestions', { path: '/l/1/c' })
    await run(tools, 'editArray', { path: '/l', action: 'add', index: 1, value: { name: 'new' } })
    assert.ok(!(await run(tools, 'setFieldValue', { path: '/l/0/c', suggestionIndex: 0 })).startsWith('Error'))
    assert.match(await run(tools, 'setFieldValue', { path: '/l/1/c', suggestionIndex: 0 }), /were dropped by a write/)
    assert.match(await run(tools, 'setFieldValue', { path: '/l/2/c', suggestionIndex: 0 }), /^Error/)
  })

  it('should move a list with the item it belongs to, its indexes unchanged', async () => {
    const { tools, layout } = listTools()
    await run(tools, 'getFieldSuggestions', { path: '/l/0/c' })
    // a second search: the indexes handed out are cumulative, and stay so after the move
    const second = await run(tools, 'getFieldSuggestions', { path: '/l/0/c' })
    assert.match(second, /\[3\] Y/, second)
    await run(tools, 'editArray', { path: '/l', action: 'move', from: 0, to: 2 })
    const applied = await run(tools, 'setFieldValue', { path: '/l/2/c', suggestionIndex: 3 })
    assert.ok(!applied.startsWith('Error'), applied)
    const data = /** @type {any} */(layout.data)
    assert.equal(data.l[2].name, 'a')
    assert.equal(data.l[2].c, 'y')
    // what was item 1 is at 0 now, and had no list
    assert.match(await run(tools, 'setFieldValue', { path: '/l/0/c', suggestionIndex: 0 }), /no suggestion memorized/)
  })
})

describe('webmcp suggestions with no close match', () => {
  const schema = {
    type: 'object',
    properties: {
      place: { type: 'string', layout: { getItems: { url: 'http://example.com/places?q={q}', itemsResults: 'data.results', itemKey: 'item.code', itemTitle: 'item.label' } } }
    }
  }
  /** a search that answers with what it has, whatever the query, as a fuzzy one does */
  const fetch = async () => ({ results: [{ code: '44109', label: 'Nantes' }, { code: '44190', label: 'Saint-Sébastien-sur-Loire' }] })
  const toolsOf = () => {
    const compiled = compile(schema)
    const layout = new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree], { debounceInputMs: 0, fetch }, {})
    return Object.fromEntries(new WebMCP(layout).getTools().map((t) => [t.name, t]))
  }

  it('should say when no item holds a word of the query', async () => {
    const text = await run(toolsOf(), 'getFieldSuggestions', { path: '/place', query: 'Vertou' })
    assert.ok(text.startsWith('No suggestion matches "Vertou" closely;'), text)
    assert.match(text, /other option/)
    assert.match(text, /\[1\] Saint-Sébastien-sur-Loire/)
  })

  it('should not say so when a word matches, accents and case aside', async () => {
    const text = await run(toolsOf(), 'getFieldSuggestions', { path: '/place', query: 'saint sebastien' })
    assert.ok(!text.includes('closely'), text)
    const byCode = await run(toolsOf(), 'getFieldSuggestions', { path: '/place', query: '44109' })
    assert.ok(!byCode.includes('closely'), byCode)
    const noQuery = await run(toolsOf(), 'getFieldSuggestions', { path: '/place' })
    assert.ok(!noQuery.includes('closely'), noQuery)
  })
})
