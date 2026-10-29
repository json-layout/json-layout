import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'

import { createLookupTools, LOOKUP_NAMES } from '../webmcp-eval/lookups.js'
import { cases, getCase } from '../webmcp-eval/cases/index.js'

/** @typedef {import('../webmcp-eval/cases/types.js').EvalCase} EvalCase */

const offline = { fetch: async () => { throw new Error('the network must not be reached') }, baseURL: 'https://df.test/data-fair/' }

/** @param {any} result */
const text = (result) => result.content.map((/** @type {any} */ p) => p.text).join('')

/**
 * @param {EvalCase} evalCase
 * @param {string} name
 * @param {Record<string, unknown>} args
 * @param {{ fetch?: Function, baseURL: string }} [options]
 */
async function run (evalCase, name, args, options = offline) {
  const tool = createLookupTools(evalCase, options).find((t) => t.name === name)
  assert.ok(tool, `${evalCase.name} has no ${name}`)
  return tool.execute(args)
}

/**
 * @param {EvalCase} evalCase
 * @param {string} name
 * @param {Record<string, unknown>} args
 * @param {{ fetch?: Function, baseURL: string }} [options]
 */
async function json (evalCase, name, args, options) {
  const result = await run(evalCase, name, args, options)
  assert.equal(result.isError, false, text(result))
  return JSON.parse(text(result))
}

describe('lookup tools', () => {
  it('exposes exactly the lookups a case declares, none without', () => {
    assert.deepEqual(createLookupTools(getCase('data-fair-line'), offline).map((t) => t.name), ['get_field_values'])
    assert.deepEqual(createLookupTools(getCase('contact'), offline), [])
    assert.throws(() => createLookupTools(/** @type {any} */ ({ ...getCase('contact'), lookups: ['nope'] }), offline), /unknown lookup "nope"/)
  })

  it('declares on each case the lookups its remote lists call for', () => {
    /** @type {Record<string, string[]>} */
    const expected = {
      contact: [],
      calendar: ['list_account_datasets', 'describe_dataset'],
      charts: ['list_account_datasets', 'describe_dataset'],
      'charts-edit': ['list_account_datasets', 'describe_dataset'],
      'charts-pie': ['list_account_datasets', 'describe_dataset'],
      choropleth: ['list_account_datasets', 'describe_dataset'],
      'portal-config-edit': ['list_portal_pages'],
      'portal-menu-catalog': ['list_portal_pages'],
      'portal-menu-explain': ['list_portal_pages'],
      'portal-page': [],
      'portal-page-edit': [],
      'portal-page-catalog': [],
      'data-fair-line': ['get_field_values']
    }
    for (const evalCase of cases) {
      assert.deepEqual(evalCase.lookups ?? [], expected[evalCase.name] ?? [], evalCase.name)
      for (const name of evalCase.lookups ?? []) assert.ok(LOOKUP_NAMES.includes(name))
    }
  })

  it('describes each lookup completely, without naming the harness', () => {
    for (const name of LOOKUP_NAMES) {
      const [tool] = createLookupTools({ ...getCase('portal-config-edit'), lookups: [name] }, offline)
      assert.equal(tool.name, name)
      assert.ok(tool.description.length > 80, `${name} needs a real description`)
      assert.equal(tool.inputSchema.type, 'object')
      assert.ok(!/eval|plain|fixture/i.test(tool.description + JSON.stringify(tool.inputSchema)), `${name} must not mention the harness`)
    }
  })

  it('finds the commune of the line among its homonyms, as the form picker does', async () => {
    const found = await json(getCase('data-fair-line'), 'get_field_values', { datasetId: 'communes', fieldKey: 'nom', q: 'Sébastien' })
    assert.ok(found.results.some((/** @type {any} */ c) => c.code === '44190' && c.nom === 'Saint-Sébastien-sur-Loire'), JSON.stringify(found))
    assert.ok(found.results.length > 1, 'the homonyms are listed too')
    assert.equal(found.count, found.results.length)
    const two = await json(getCase('data-fair-line'), 'get_field_values', { datasetId: 'communes', fieldKey: 'code', q: 'Sébastien', size: 2 })
    assert.equal(two.results.length, 2)
    assert.equal(two.count, found.count)
  })

  it('answers an unknown dataset with a 404 and an unknown column with the columns', async () => {
    const unknownDataset = await run(getCase('data-fair-line'), 'get_field_values', { datasetId: 'lieux', fieldKey: 'commune', q: 'Nantes' })
    assert.equal(unknownDataset.isError, true)
    assert.match(text(unknownDataset), /^404 Not Found/)
    const unknownField = await run(getCase('data-fair-line'), 'get_field_values', { datasetId: 'communes', fieldKey: 'insee', q: 'Nantes' })
    assert.equal(unknownField.isError, true)
    assert.match(text(unknownField), /^400 Bad Request/)
    assert.match(text(unknownField), /code, nom/)
  })

  it('lists and describes the calendar datasets from the same capture the pickers read', async () => {
    const calendar = getCase('calendar')
    const found = await json(calendar, 'list_account_datasets', { q: 'Agenda-manifestations' })
    assert.deepEqual(found.results.map((/** @type {any} */ d) => d.title), ['Agenda-manifestations'])
    const agenda = found.results[0]
    assert.equal(agenda.isRest, true)
    assert.match(agenda.href, /^https:\/\/koumoul\.com\/data-fair\/api\/v1\/datasets\//)
    assert.ok(agenda.id && !agenda.schema, 'a listing stays concise')
    const all = await json(calendar, 'list_account_datasets', {})
    assert.ok(all.count >= 27, String(all.count))
    assert.equal(all.results.length, 10, 'ten per page by default')
    assert.ok(all.results.some((/** @type {any} */ d) => d.isRest === false))
    const described = await json(calendar, 'describe_dataset', { datasetId: agenda.id })
    assert.equal(described.title, 'Agenda-manifestations')
    assert.equal(described.href, agenda.href)
    const label = described.columns.find((/** @type {any} */ c) => c.key === 'nomevenement')
    assert.deepEqual(label, { key: 'nomevenement', type: 'string', title: 'Nom de l\'évenement', 'x-refersTo': 'http://www.w3.org/2000/01/rdf-schema#label' })
    assert.equal(described.columns.find((/** @type {any} */ c) => c.key === 'date_debut').format, 'date-time')
    assert.ok(!described.columns.some((/** @type {any} */ c) => c.key === '_coords.error'), 'calculated columns are left out')
    const missing = await run(calendar, 'describe_dataset', { datasetId: 'unknown-id' })
    assert.equal(missing.isError, true)
    assert.match(text(missing), /^404 Not Found/)
  })

  it('queries the data-fair base under the case owner when the case has no capture', async () => {
    /** @type {string[]} */
    const urls = []
    const options = {
      baseURL: 'https://df.test/data-fair/',
      fetch: async (/** @type {string} */ url) => {
        urls.push(url)
        if (url.includes('/datasets/ds1')) return { id: 'ds1', title: 'Air', href: 'https://df.test/data-fair/api/v1/datasets/ds1', schema: [{ key: 'v', type: 'number', 'x-originalName': 'Valeur' }, { key: '_i', type: 'integer', 'x-calculated': true }] }
        return { count: 1, results: [{ id: 'ds1', title: 'Air', href: 'https://df.test/data-fair/api/v1/datasets/ds1' }] }
      }
    }
    const listing = await json(getCase('charts'), 'list_account_datasets', { q: 'air', size: 5 }, options)
    assert.deepEqual(listing, { count: 1, results: [{ id: 'ds1', title: 'Air', href: 'https://df.test/data-fair/api/v1/datasets/ds1', isRest: false }] })
    const url = new URL(urls[0])
    assert.equal(url.origin + url.pathname, 'https://df.test/data-fair/api/v1/datasets')
    assert.equal(url.searchParams.get('q'), 'air')
    assert.equal(url.searchParams.get('size'), '5')
    assert.equal(url.searchParams.get('owner'), 'organization:p6Qg1z-aq')
    const described = await json(getCase('charts'), 'describe_dataset', { datasetId: 'ds1' }, options)
    assert.deepEqual(described.columns, [{ key: 'v', type: 'number', title: 'Valeur' }])
    assert.equal(urls[1], 'https://df.test/data-fair/api/v1/datasets/ds1')
  })

  it('lists the portal pages of the context, by type', async () => {
    const portal = getCase('portal-menu-catalog')
    const all = await json(portal, 'list_portal_pages', {})
    assert.equal(all.count, 3)
    assert.deepEqual(all.results[0], { type: 'generic', slug: 'jeunesse', title: 'Nos actions pour la jeunesse', titleBackOffice: 'Nos actions pour la jeunesse' })
    const events = await json(portal, 'list_portal_pages', { type: 'event' })
    assert.deepEqual(events, { count: 1, results: [{ type: 'event', slug: 'fete-de-la-musique', title: 'Fête de la musique 2026' }] })
    assert.deepEqual(await json(portal, 'list_portal_pages', { type: 'news' }), { count: 0, results: [] })
  })
})
