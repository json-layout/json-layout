import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'

import { compile } from '../src/compile/index.js'
import { StatefulLayout } from '../src/state/index.js'
import { WebMCP } from '../src/webmcp/index.js'
import { getCase } from '../webmcp-eval/cases/index.js'
import { caseFetch, FIXTURE_BASE_URL } from '../webmcp-eval/remote.js'
import { SuggestionsStore } from '../src/webmcp/suggestions-store.js'
import { resolveNode } from '../src/webmcp/resolve.js'

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
    // the item added never had a list; the one it pushed to /l/2 had one, dropped
    assert.match(await run(tools, 'setFieldValue', { path: '/l/1/c', suggestionIndex: 0 }), /no suggestion memorized/)
    assert.match(await run(tools, 'setFieldValue', { path: '/l/2/c', suggestionIndex: 0 }), /were dropped by a write/)
  })

  it('should say a list was dropped at the place its item moved to after a removal', async () => {
    const { tools } = listTools()
    await run(tools, 'getFieldSuggestions', { path: '/l/2/c' })
    await run(tools, 'editArray', { path: '/l', action: 'remove', index: 1 })
    assert.match(await run(tools, 'setFieldValue', { path: '/l/1/c', suggestionIndex: 0 }), /were dropped by a write/)
    // the removed item's list leaves no mark on the item now at its place
    const other = listTools()
    await run(other.tools, 'getFieldSuggestions', { path: '/l/1/c' })
    await run(other.tools, 'editArray', { path: '/l', action: 'remove', index: 1 })
    assert.match(await run(other.tools, 'setFieldValue', { path: '/l/1/c', suggestionIndex: 0 }), /no suggestion memorized/)
  })

  it('should drop the lists under a list setFieldValue writes whole, where their data changed', async () => {
    const { tools } = listTools()
    await run(tools, 'getFieldSuggestions', { path: '/l/0/c' })
    await run(tools, 'getFieldSuggestions', { path: '/l/1/c' })
    await run(tools, 'setFieldValue', { path: '/l', value: [{ name: 'a' }, { name: 'other', c: 'y' }] })
    assert.ok(!(await run(tools, 'setFieldValue', { path: '/l/0/c', suggestionIndex: 0 })).startsWith('Error'))
    assert.match(await run(tools, 'setFieldValue', { path: '/l/1/c', suggestionIndex: 0 }), /were dropped by a write/)
  })

  it('should drop everything under a list a write hid', async () => {
    const compiled = compile({
      type: 'object',
      properties: {
        l: { ...listSchema.properties.l, layout: { if: '!rootData.l || rootData.l.length < 4' } }
      }
    })
    const layout = new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree], { debounceInputMs: 0 },
      { l: [{ name: 'a' }, { name: 'b' }, { name: 'c' }] })
    const webmcp = new WebMCP(layout)
    const tools = Object.fromEntries(webmcp.getTools().map((t) => [t.name, t]))
    await run(tools, 'getFieldSuggestions', { path: '/l/0/c' })
    await run(tools, 'getFieldSuggestions', { path: '/l/2/c' })
    await run(tools, 'editArray', { path: '/l', action: 'add', index: 3 })
    // the list is hidden, its items gone from the form, and nothing is memorized under it
    assert.equal(resolveNode(layout.stateTree.root, '/l')?.layout.comp, 'none')
    assert.deepEqual(webmcp._suggestionsStore.paths(), [])
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

describe('webmcp suggestions store memory', () => {
  it('should keep offered values when its lists are cleared', () => {
    const store = new SuggestionsStore()
    store.add('/c', [{ value: 'x', title: 'X' }], 'k')
    store.clear()
    assert.ok(store.wasOffered('/c', 'k', 'x'))
    assert.match(String((() => { try { store.getValue('/c', 0) } catch (err) { return err } })()), /were dropped by a write/)
  })

  it('should drop every list and mark under a list that is gone', () => {
    const store = new SuggestionsStore()
    store.add('/l/0/c', [{ value: 'x', title: 'X' }], 'k')
    store.add('/m/0/c', [{ value: 'x', title: 'X' }], 'k')
    store.dropUnder('/l')
    assert.deepEqual(store.paths(), ['/m/0/c'])
    assert.throws(() => store.getValue('/l/0/c', 0), /no suggestion memorized/)
  })
})

describe('webmcp suggestions with no close match', () => {
  it('should not say so for a variant selector, which ignores the query', async () => {
    const compiled = compile({ type: 'object', properties: { shape: { type: 'object', oneOf: [{ title: 'Circle', properties: { kind: { const: 'circle' } } }, { title: 'Rect', properties: { kind: { const: 'rect' } } }] } } })
    const layout = new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree], { debounceInputMs: 0 }, {})
    const tools = Object.fromEntries(new WebMCP(layout).getTools().map((t) => [t.name, t]))
    const text = await run(tools, 'getFieldSuggestions', { path: '/shape/$oneOf', query: 'triangle' })
    assert.ok(!text.includes('closely'), text)
  })

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

describe('webmcp values picked, not invented', () => {
  const warning = /\/commune: "44173" was not among the suggestions listed for this field; pick one with getFieldSuggestions/

  it('should accept a referential value typed from memory, with a warning', async () => {
    // the data-fair experiment: an agent typed the commune code 44173 from memory (the real
    // one is 44190) and the form said valid
    const { tools, webmcp, layout } = lineForm()
    const text = await run(tools, 'setFieldValue', { path: '/commune', value: '44173' })
    assert.match(text, warning, text)
    assert.equal(/** @type {any} */(layout.data).commune, '44173')
    assert.deepEqual(webmcp.unpickedValues(), [{ path: '/commune', value: '44173' }])
  })

  it('should say so for a setData too', async () => {
    const { tools, webmcp } = lineForm()
    const text = await run(tools, 'setData', { data: { nom: 'Dojo', commune: '44173' } })
    assert.match(text, warning, text)
    assert.deepEqual(webmcp.unpickedValues(), [{ path: '/commune', value: '44173' }])
  })

  it('should not warn about a value applied by its index', async () => {
    const { tools, webmcp } = lineForm()
    const listed = await run(tools, 'getFieldSuggestions', { path: '/commune', query: 'Sébastien' })
    const index = Number(listed.match(/\[(\d+)\] 44190/)?.[1])
    const text = await run(tools, 'setFieldValue', { path: '/commune', suggestionIndex: index })
    assert.ok(!text.includes('was not among'), text)
    assert.deepEqual(webmcp.unpickedValues(), [])
  })

  it('should not warn about a listed value written directly', async () => {
    const { tools, webmcp } = lineForm()
    await run(tools, 'getFieldSuggestions', { path: '/commune', query: 'Sébastien' })
    const text = await run(tools, 'setFieldValue', { path: '/commune', value: '44190' })
    assert.ok(!text.includes('was not among'), text)
    // nor after a write that dropped the list it was in
    const again = await run(tools, 'setData', { data: { commune: '44190', nom: 'Dojo' } })
    assert.ok(!again.includes('was not among'), again)
    assert.deepEqual(webmcp.unpickedValues(), [])
  })

  it('should not warn about the value the form was loaded with', async () => {
    const { tools, webmcp } = lineForm({ commune: '44173' })
    assert.deepEqual(webmcp.unpickedValues(), [])
    const other = await run(tools, 'setData', { data: { nom: 'Dojo' } })
    assert.ok(!other.includes('was not among'), other)
    const same = await run(tools, 'setFieldValue', { path: '/commune', value: '44173' })
    assert.ok(!same.includes('was not among'), same)
    assert.deepEqual(webmcp.unpickedValues(), [])
  })

  it('should take the data of a reset as the loaded value', async () => {
    const { tools, webmcp } = lineForm()
    await run(tools, 'setFieldValue', { path: '/commune', value: '44173' })
    webmcp.resetBaseline()
    assert.deepEqual(webmcp.unpickedValues(), [])
  })

  it('should not warn about a field whose options are not a remote list', async () => {
    const { tools, webmcp } = lineForm()
    const text = await run(tools, 'setFieldValue', { path: '/activites', value: ['judo'] })
    assert.ok(!text.includes('was not among'), text)
    assert.deepEqual(webmcp.unpickedValues(), [])
  })

  const placesSchema = {
    type: 'object',
    properties: {
      dep: { type: 'string' },
      l: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            // eslint-disable-next-line no-template-curly-in-string
            place: { type: 'string', layout: { getItems: { url: 'http://example.com/places?dep=${rootData.dep}&q={q}', itemsResults: 'data.results', itemKey: 'item.code', itemTitle: 'item.label' } } }
          }
        }
      }
    }
  }
  /** @param {string} url */
  const fetch = async (url) => {
    const dep = new URL(url).searchParams.get('dep')
    return { results: dep === '44' ? [{ code: '44109', label: 'Nantes' }, { code: '44190', label: 'Saint-Sébastien-sur-Loire' }] : [{ code: '85191', label: 'La Roche-sur-Yon' }] }
  }
  const placesForm = () => {
    const compiled = compile(placesSchema)
    const layout = new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree], { debounceInputMs: 0, fetch },
      { dep: '44', l: [{ name: 'a' }, { name: 'b' }, { name: 'c' }] })
    const webmcp = new WebMCP(layout)
    return { layout, webmcp, tools: Object.fromEntries(webmcp.getTools().map((t) => [t.name, t])) }
  }

  it('should count a number offered for a text field as picked once written as text', async () => {
    const schema = { type: 'object', properties: { place: { type: 'string', layout: { getItems: { url: 'http://example.com/places?q={q}', itemsResults: 'data.results', itemKey: 'item.code', itemTitle: 'item.label' } } } } }
    const compiled = compile(schema)
    const layout = new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree], { debounceInputMs: 0, fetch: async () => ({ results: [{ code: 44109, label: 'Nantes' }, { code: 44190, label: 'Saint-Sébastien' }] }) }, {})
    const webmcp = new WebMCP(layout)
    const tools = Object.fromEntries(webmcp.getTools().map((t) => [t.name, t]))
    await run(tools, 'getFieldSuggestions', { path: '/place' })
    const text = await run(tools, 'setFieldValue', { path: '/place', suggestionIndex: 1 })
    assert.ok(!text.includes('was not among'), text)
    assert.equal(/** @type {any} */(layout.data).place, '44190')
    assert.deepEqual(webmcp.unpickedValues(), [])
  })

  it('should keep a pick with its item when items are removed or moved', async () => {
    const { tools, webmcp, layout } = placesForm()
    await run(tools, 'getFieldSuggestions', { path: '/l/2/place' })
    await run(tools, 'setFieldValue', { path: '/l/2/place', suggestionIndex: 1 })
    await run(tools, 'editArray', { path: '/l', action: 'remove', index: 0 })
    assert.deepEqual(webmcp.unpickedValues(), [])
    await run(tools, 'editArray', { path: '/l', action: 'move', from: 1, to: 0 })
    assert.equal(/** @type {any} */(layout.data).l[0].place, '44190')
    assert.deepEqual(webmcp.unpickedValues(), [])
    // an invented value in an added item is told
    const added = await run(tools, 'editArray', { path: '/l', action: 'add', value: { name: 'd', place: '44999' } })
    assert.match(added, /\/l\/2\/place: "44999" was not among the suggestions/, added)
    assert.deepEqual(webmcp.unpickedValues(), [{ path: '/l/2/place', value: '44999' }])
  })

  it('should forget a pick when the list it came from changes', async () => {
    const { tools, webmcp } = placesForm()
    await run(tools, 'getFieldSuggestions', { path: '/l/0/place' })
    await run(tools, 'setFieldValue', { path: '/l/0/place', suggestionIndex: 1 })
    assert.deepEqual(webmcp.unpickedValues(), [])
    const text = await run(tools, 'setFieldValue', { path: '/dep', value: '85' })
    // the write that changed the list says so, about the field it did not write
    assert.match(text, /\/l\/0\/place: "44190" was not among the suggestions/, text)
    assert.deepEqual(webmcp.unpickedValues(), [{ path: '/l/0/place', value: '44190' }])
  })

  it('should say once in the guide that such values are picked', async () => {
    const { generateSkill } = await import('../src/webmcp/index.js')
    const skill = generateSkill('doc', 'x_', {})
    const line = 'Values of fields whose options come from a list are picked from x_getFieldSuggestions, never typed from memory.'
    assert.equal(skill.split(line).length, 2, skill)
  })
})

describe('webmcp values picked, as the form stores them', () => {
  // a data-fair dataset picked whole: the form keeps only the properties of its schema, so
  // the stored object no longer equals the item it was picked from
  const schema = {
    type: 'object',
    properties: {
      dataset: {
        type: 'object',
        properties: { href: { type: 'string' }, title: { type: 'string' } },
        layout: { getItems: { url: 'http://example.com/datasets?q={q}', itemsResults: 'data.results', itemKey: 'item.href', itemTitle: 'item.title', returnObjects: true } }
      },
      place: { type: 'string', default: '44109', layout: { getItems: { url: 'http://example.com/places?q={q}' } } }
    }
  }
  const fetch = async () => ({ results: [{ href: 'http://example.com/d/1', title: 'Agenda', owner: { id: 'o' }, id: '1' }] })
  const formOf = () => {
    const compiled = compile(schema, { useDefault: 'data' })
    const layout = new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree], { debounceInputMs: 0, fetch, removeAdditional: true }, {})
    const webmcp = new WebMCP(layout)
    return { layout, webmcp, tools: Object.fromEntries(webmcp.getTools().map((t) => [t.name, t])) }
  }

  it('should recognize an object picked whole by its item key', async () => {
    const { tools, webmcp } = formOf()
    await run(tools, 'getFieldSuggestions', { path: '/dataset' })
    const text = await run(tools, 'setFieldValue', { path: '/dataset', suggestionIndex: 0 })
    assert.ok(!text.includes('was not among'), text)
    assert.deepEqual(webmcp.unpickedValues(), [])
  })

  it('should count the default of a field as picked', async () => {
    const { tools, webmcp } = formOf()
    const text = await run(tools, 'setFieldValue', { path: '/place', value: '44109' })
    assert.ok(!text.includes('was not among'), text)
    assert.deepEqual(webmcp.unpickedValues(), [])
  })
})

describe('webmcp lists reshaped from other fields', () => {
  // catalog-melodi: one URL, the values of the selected concept picked out of it by
  // itemsResults. The itemsCacheKey (the URL) does not change with the concept.
  const range = {
    range: [
      { code: 'A', values: [{ code: 'a1' }, { code: 'a2' }] },
      { code: 'B', values: [{ code: 'b1' }, { code: 'b2' }] }
    ]
  }
  const schema = {
    type: 'object',
    properties: {
      label: { type: 'string' },
      selectedConcept: {
        type: 'string',
        layout: { comp: 'autocomplete', getItems: { url: 'http://example.com/range', itemsResults: 'data.range', itemValue: 'item.code', itemTitle: 'item.code' } }
      },
      selectedValue: {
        type: 'string',
        layout: {
          comp: 'autocomplete',
          getItems: {
            url: 'http://example.com/range',
            itemsResults: '((data.range || []).find(c => c.code === parent.data.selectedConcept)?.values || [])',
            itemValue: 'item.code',
            itemTitle: 'item.code'
          }
        }
      }
    }
  }
  const conceptForm = () => {
    let fetches = 0
    const compiled = compile(schema)
    const layout = new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree], {
      debounceInputMs: 0,
      fetch: async () => { fetches++; return range }
    }, { selectedConcept: 'A' })
    const webmcp = new WebMCP(layout)
    return { layout, webmcp, tools: Object.fromEntries(webmcp.getTools().map((t) => [t.name, t])), fetches: () => fetches }
  }

  it('should drop the list and the pick of a field when the field its list is reshaped from changes', async () => {
    const { tools, webmcp, layout } = conceptForm()
    const listed = await run(tools, 'getFieldSuggestions', { path: '/selectedValue' })
    assert.match(listed, /a1/, listed)
    await run(tools, 'setFieldValue', { path: '/selectedValue', suggestionIndex: 0 })
    assert.equal(/** @type {any} */(layout.data).selectedValue, 'a1')
    assert.deepEqual(webmcp.unpickedValues(), [])
    await run(tools, 'getFieldSuggestions', { path: '/selectedConcept' })
    const text = await run(tools, 'setFieldValue', { path: '/selectedConcept', value: 'B' })
    assert.match(text, /\/selectedValue: "a1" was not among the suggestions/, text)
    assert.deepEqual(webmcp.unpickedValues(), [{ path: '/selectedValue', value: 'a1' }])
    const applied = await run(tools, 'setFieldValue', { path: '/selectedValue', suggestionIndex: 1 })
    assert.match(applied, /were dropped by a write/, applied)
    const relisted = await run(tools, 'getFieldSuggestions', { path: '/selectedValue' })
    assert.match(relisted, /b1/, relisted)
    assert.doesNotMatch(relisted, /a1/, relisted)
  })

  it('should keep the list and the pick across a write that leaves its list as it was', async () => {
    const { tools, webmcp, layout, fetches } = conceptForm()
    await run(tools, 'getFieldSuggestions', { path: '/selectedValue' })
    await run(tools, 'setFieldValue', { path: '/selectedValue', suggestionIndex: 0 })
    const text = await run(tools, 'setFieldValue', { path: '/label', value: 'my import' })
    assert.ok(!text.includes('was not among'), text)
    assert.deepEqual(webmcp.unpickedValues(), [])
    const applied = await run(tools, 'setFieldValue', { path: '/selectedValue', suggestionIndex: 1 })
    assert.ok(!applied.startsWith('Error'), applied)
    assert.equal(/** @type {any} */(layout.data).selectedValue, 'a2')
    assert.equal(fetches(), 1)
  })

  it('should keep the suggestions of a list reshaped from the item alone across the same write', async () => {
    const { tools, layout } = conceptForm()
    await run(tools, 'getFieldSuggestions', { path: '/selectedConcept' })
    await run(tools, 'setFieldValue', { path: '/selectedConcept', value: 'B' })
    const applied = await run(tools, 'setFieldValue', { path: '/selectedConcept', suggestionIndex: 0 })
    assert.ok(!applied.startsWith('Error'), applied)
    assert.equal(/** @type {any} */(layout.data).selectedConcept, 'A')
  })
  it('should keep picking from a list with no whole download, judged by its key', async () => {
    const searched = structuredClone(schema)
    searched.properties.selectedValue.layout.getItems.url = 'http://example.com/range?q={q}'
    const compiled = compile(searched)
    // the whole download getFieldSuggestions makes for such a list fails
    /** @param {string} url */
    const fetch = async (url) => {
      if (!new URL(url).searchParams.has('q')) throw new Error('unavailable')
      return range
    }
    const layout = new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree], { debounceInputMs: 0, fetch }, { selectedConcept: 'A' })
    const webmcp = new WebMCP(layout)
    const tools = Object.fromEntries(webmcp.getTools().map((t) => [t.name, t]))
    await run(tools, 'getFieldSuggestions', { path: '/selectedValue', query: 'a' })
    await run(tools, 'setFieldValue', { path: '/selectedValue', suggestionIndex: 0 })
    // picking again from the same list: its own value is not what it depends on
    const again = await run(tools, 'setFieldValue', { path: '/selectedValue', suggestionIndex: 1 })
    assert.ok(!again.startsWith('Error'), again)
    assert.deepEqual(webmcp.unpickedValues(), [])
  })
  it('should keep a pick from a list searched only by a query its request applies across an unrelated write', async () => {
    const searched = structuredClone(schema)
    searched.properties.selectedValue.layout.getItems.url = 'http://example.com/range?q={q}'
    const compiled = compile(searched)
    const layout = new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree], { debounceInputMs: 0, fetch: async () => range }, { selectedConcept: 'A' })
    const webmcp = new WebMCP(layout)
    const tools = Object.fromEntries(webmcp.getTools().map((t) => [t.name, t]))
    await run(tools, 'getFieldSuggestions', { path: '/selectedValue', query: 'a' })
    await run(tools, 'setFieldValue', { path: '/selectedValue', suggestionIndex: 0 })
    const text = await run(tools, 'setFieldValue', { path: '/label', value: 'my import' })
    assert.ok(!text.includes('was not among'), text)
    assert.deepEqual(webmcp.unpickedValues(), [])
    const applied = await run(tools, 'setFieldValue', { path: '/selectedValue', suggestionIndex: 1 })
    assert.ok(!applied.startsWith('Error'), applied)
  })

  it('should tell two lists apart that share item keys but not values or titles', async () => {
    // two concepts can hold the same codes, with other ids and labels
    const shared = {
      range: [
        { code: 'A', values: [{ code: 'x', id: 'A-x', label: 'A x' }] },
        { code: 'B', values: [{ code: 'x', id: 'B-x', label: 'B x' }] }
      ]
    }
    const keyed = structuredClone(schema)
    Object.assign(keyed.properties.selectedValue.layout.getItems, { itemKey: 'item.code', itemValue: 'item.id', itemTitle: 'item.label' })
    const compiled = compile(keyed)
    const layout = new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree], { debounceInputMs: 0, fetch: async () => shared }, { selectedConcept: 'A' })
    const webmcp = new WebMCP(layout)
    const tools = Object.fromEntries(webmcp.getTools().map((t) => [t.name, t]))
    await run(tools, 'getFieldSuggestions', { path: '/selectedValue' })
    await run(tools, 'setFieldValue', { path: '/selectedValue', suggestionIndex: 0 })
    assert.equal(/** @type {any} */(layout.data).selectedValue, 'A-x')
    await run(tools, 'getFieldSuggestions', { path: '/selectedConcept' })
    await run(tools, 'setFieldValue', { path: '/selectedConcept', value: 'B' })
    const applied = await run(tools, 'setFieldValue', { path: '/selectedValue', suggestionIndex: 0 })
    assert.match(applied, /were dropped by a write/, applied)
  })
})
