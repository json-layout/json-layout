import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'

import { compile } from '../src/compile/index.js'

import { cases, getCase } from '../webmcp-eval/cases/index.js'
import { TOOL_NAMES } from '../webmcp-eval/run-case.js'
import { EvalSession } from '../webmcp-eval/session.js'
import { PlainApiSession } from '../webmcp-eval/plain-api.js'
import { runChecks } from '../webmcp-eval/checks.js'
import { createArm } from '../webmcp-eval/arms.js'
import { caseFetch } from '../webmcp-eval/remote.js'

/**
 * @param {import('../src/state/index.js').StateNode} node
 * @param {string} fullKey
 * @returns {import('../src/state/index.js').StateNode | undefined}
 */
function findNode (node, fullKey) {
  if (node.fullKey === fullKey) return node
  for (const child of node.children ?? []) {
    const found = findNode(child, fullKey)
    if (found) return found
  }
}

/**
 * These assertions need no model. They cannot tell you whether a form is usable by an
 * agent — that is the judged eval's job — but they pin that each case is the case it
 * claims to be. The previous suite could not: it replayed sequences written alongside
 * the fixtures, and passed while `dataset` was labelled large, returned its whole
 * schema, and finished in a quarter of its call budget.
 */
describe('webmcp eval cases', () => {
  for (const evalCase of cases) {
    it(`should compile the ${evalCase.name} schema`, () => {
      const compiled = compile(evalCase.schema)
      assert.ok(compiled.skeletonTrees[compiled.mainTree], 'should produce a main tree')
    })

    it(`should state a usable goal for ${evalCase.name}`, () => {
      // The goal is the runner's only input, so it must read as a user request.
      assert.ok(evalCase.goal.length > 20, 'goal should be a sentence')
      for (const toolName of ['setFieldValue', 'describeState', 'editArray', 'setData']) {
        assert.ok(!evalCase.goal.includes(toolName), `goal must not name the ${toolName} tool`)
      }
    })
  }

  it('should present the calendar pickers as item lists, not vendor keywords', () => {
    // app-calendar is written for vjsf v2 (x-fromUrl and friends). Compiled raw, its
    // pickers render as plain sections and getFieldSuggestions refuses them while
    // getSchema still shows the vendor keywords — two tools contradicting each other,
    // which the first judged run reported as high-severity friction.
    const evalCase = getCase('calendar')
    assert.ok(!JSON.stringify(evalCase.schema).includes('x-fromUrl'), 'vendor keywords must be translated before the agent sees the schema')
    const session = new EvalSession(evalCase)
    const datasetNode = findNode(session.layout.stateTree.root, '/$allOf-0/datasets/0')
    assert.ok(datasetNode?.layout.getItems, 'the dataset picker must carry a getItems layout')
    const labelNode = findNode(session.layout.stateTree.root, '/$allOf-1/labelField')
    assert.ok(labelNode?.layout.getItems, 'the label picker must carry a getItems layout')
  })

  it('should keep a case whose form is far past what one read can cover', () => {
    // The suite has to include something no agent could take in at once, or every finding
    // comes from forms small enough to hold in mind. Counting normalized layouts is not a
    // protocol concept any more — nothing branches on it — but it is still the plainest
    // measure of that.
    const sizes = cases.map((c) => Object.keys(compile(c.schema).normalizedLayouts).length)
    assert.ok(Math.max(...sizes) > 200, `the largest case is only ${Math.max(...sizes)} layouts`)
    assert.ok(Math.min(...sizes) < 15, 'and one small enough to answer in a couple of calls')
  })
})

describe('webmcp eval session', () => {
  it('should resolve item lists against the data-fair base URL', async () => {
    // Both vendored schemas fetch their pickers from relative data-fair API paths. Left
    // unresolved they fail as a bare "fetch failed", which the first judged run showed
    // an agent retrying four times with different queries.
    /** @type {string[]} */
    const fetched = []
    const session = new EvalSession(getCase('charts'), {
      dataFairURL: 'https://example.test/data-fair/',
      fetch: async (/** @type {string} */ url) => { fetched.push(url); return { results: [{ href: 'https://example.test/data-fair/api/v1/datasets/aq', title: 'Air quality' }] } }
    })
    await session.call('getFieldSuggestions', { path: '/$allOf-0/datasets/0', query: 'air' })
    assert.equal(session.calls[0].isError, false, session.calls[0].response)
    assert.equal(fetched.length, 1)
    assert.ok(fetched[0].startsWith('https://example.test/data-fair/api/v1/datasets?'), fetched[0])
    assert.ok(fetched[0].includes('q=air'), fetched[0])
    assert.ok(session.calls[0].response.includes('Air quality'), session.calls[0].response)
  })

  it('should pass the case context into the item URLs', async () => {
    // A deployed app runs under one owner and its dataset queries carry that filter.
    // Without it the public instance answers with its twelve newest matches, and the
    // dataset a goal names is never among them.
    /** @type {string[]} */
    const fetched = []
    const evalCase = { ...getCase('charts'), context: { datasetFilter: 'owner=organization:test' } }
    const session = new EvalSession(evalCase, {
      dataFairURL: 'https://example.test/data-fair/',
      fetch: async (/** @type {string} */ url) => { fetched.push(url); return { results: [] } }
    })
    await session.call('getFieldSuggestions', { path: '/$allOf-0/datasets/0', query: 'air' })
    assert.ok(decodeURIComponent(fetched[0]).includes('owner=organization:test'), fetched[0])
  })

  it('should expose the same tools a page would register', () => {
    // TOOL_NAMES is what run-case.js passes to every launched runner's --allowedTools,
    // listed by hand so the launcher needs no compiled form. Nothing else ties it to
    // reality: a tool added or renamed under src/webmcp/ would leave every runner
    // missing it, which reads in a transcript as protocol friction rather than as a
    // broken setup. This is the tie.
    const session = new EvalSession(getCase('contact'))
    const names = session.tools.map((t) => t.name).sort()
    assert.deepEqual(names, [...TOOL_NAMES].sort(), 'TOOL_NAMES must match the tools a session registers — update TOOL_NAMES in run-case.js')
  })

  it('should deliver the guide as a prompt rather than as a tool', () => {
    // Production pages enable includeSubAgent, which hands the guide to the runner as
    // its prompt; none enables includeFillFormSkill. Clean runners never called that
    // tool anyway — only ones contaminated by a "always invoke a skill first"
    // instruction did, which is what made it look load-bearing.
    const session = new EvalSession(getCase('contact'))
    assert.ok(!session.toolNames.includes('fillFormSkill'), 'the guide must not be a tool')
    assert.match(session.skill, /Form-Filling Guide/, 'the guide must be exposed for injection')
    for (const tool of session.toolNames) {
      assert.ok(session.skill.includes(tool), `the guide must mention ${tool}, or the runner is granted a tool it was never told about`)
    }
  })

  it('should drop getSchema, and say so in the guide, without a schema', () => {
    // What portals ships: the compiled layout carries no schema, so no getSchema tool
    // exists and the guide points the agent at describeState instead. Running a case
    // both ways is how the harness answers whether shipping the schema earns its cost.
    const session = new EvalSession({ ...getCase('contact'), withSchema: false })
    assert.ok(!session.toolNames.includes('getSchema'))
    assert.ok(!session.skill.includes('getSchema'))
    assert.match(session.skill, /describeState/)
  })

  it('should record the cost of every call', async () => {
    const session = new EvalSession(getCase('contact'))
    await session.call('getData', {})
    assert.equal(session.calls.length, 1)
    assert.equal(session.calls[0].tool, 'getData')
    assert.ok(session.calls[0].outputBytes > 0, 'output size should be recorded')
    assert.equal(session.calls[0].isError, false)
    assert.equal(session.totalOutputBytes, session.calls[0].outputBytes)
  })

  it('should record an unknown tool as a failed call rather than throwing', async () => {
    const session = new EvalSession(getCase('contact'))
    const result = await session.call('setFieldValu', { path: '/name', value: 'x' })
    assert.equal(result.isError, true)
    assert.equal(session.calls[0].isError, true)
  })

  it('should produce judge evidence without a verdict of its own', async () => {
    // The session records; it does not decide. A score() here would re-introduce the
    // hardcoded expectations the judge exists to replace.
    const session = new EvalSession(getCase('contact'))
    await session.call('setFieldValue', { path: '/name', value: 'Ada Lovelace' })

    const evidence = session.evidence()
    assert.equal(evidence.case, 'contact')
    assert.equal(evidence.goal, getCase('contact').goal)
    assert.equal(evidence.metrics.toolCalls, 1)
    assert.ok(evidence.metrics.outputBytes > 0)
    assert.equal(evidence.valid, false, 'email is still missing')
    assert.deepEqual(evidence.data, { name: 'Ada Lovelace' })
    assert.equal(evidence.calls[0].tool, 'setFieldValue')
    assert.ok('response' in evidence.calls[0], 'the judge needs the response text, not just its size')
    assert.equal(typeof (/** @type {any} */(session).score), 'undefined', 'score() must be gone')
  })
})

describe('webmcp eval line form case', () => {
  /**
   * A line as the goal describes it, written the loose way data-fair's line API accepts:
   * multi-valued columns as joined strings, the SIRET as a number.
   */
  const looseLine = {
    nom: 'Dojo des Grands Bois',
    association: 'Judo Club Sébastiennais',
    type_lieu: 'salle polyvalente',
    commune: '44190',
    adresse: '12 rue des Grands Bois',
    telephone: '02 40 80 12 34',
    siret: 52348761900017,
    activites: 'judo, yoga, handisport',
    publics: 'enfants, adultes, personnes handicapées',
    date_ouverture: '2025-03-03'
  }

  it('should search communes offline, every word of the query in the name or the code', async () => {
    // The referential is searched the way data-fair's single search does it: the user's
    // abbreviation finds nothing, the full word finds the commune among its homonyms.
    const session = new EvalSession(getCase('data-fair-line'))
    await session.call('getFieldSuggestions', { path: '/commune', query: 'St-Sébastien' })
    assert.equal(session.calls[0].isError, false, session.calls[0].response)
    assert.ok(!session.calls[0].response.includes('44190'), session.calls[0].response)
    await session.call('getFieldSuggestions', { path: '/commune', query: 'Sébastien' })
    assert.equal(session.calls[1].isError, false, session.calls[1].response)
    assert.ok(session.calls[1].response.includes('44190'), session.calls[1].response)
  })

  it('should answer the commune search as data-fair does, sorted by code and capped', () => {
    const { remote } = getCase('data-fair-line')
    assert.ok(remote)
    const saint = /** @type {any} */ (remote(new URL('http://localhost/data-fair/communes?q=saint')))
    assert.equal(saint.results.length, 10)
    assert.ok(saint.total > 10)
    const codes = saint.results.map((/** @type {any} */ r) => r.output)
    assert.deepEqual(codes, [...codes].sort())
    assert.ok(!codes.includes('44190'), 'the commune is past the first page of "saint"')
    const reze = /** @type {any} */ (remote(new URL('http://localhost/data-fair/communes?q=REZE')))
    // a prefix of the homonym too, and it sorts first
    assert.deepEqual(reze.results, [{ output: '15161', label: '15161 (Rézentières)' }, { output: '44143', label: '44143 (Rezé)' }])
    // a code, or its start, finds the commune as data-fair's q_fields do
    const byCode = /** @type {any} */ (remote(new URL('http://localhost/data-fair/communes?q=44190')))
    assert.deepEqual(byCode.results, [{ output: '44190', label: '44190 (Saint-Sébastien-sur-Loire)' }])
    assert.equal(remote(new URL('http://localhost/data-fair/unknown')), undefined)
  })

  it('should accept the line the goal describes, in the plain API and in the checks', async () => {
    const evalCase = getCase('data-fair-line')
    assert.equal(evalCase.saveMode, 'explicit')
    assert.deepEqual(evalCase.data, {})
    const session = new PlainApiSession(evalCase)
    const result = await session.call('writeDocument', { document: looseLine })
    assert.equal(result.isError, false, result.content[0].text)
    const failed = runChecks(evalCase.checks ?? [], session.data, evalCase.data).filter((r) => !r.ok)
    assert.deepEqual(failed, [])
  })

  it('should refuse what the register refuses', async () => {
    const session = new PlainApiSession(getCase('data-fair-line'))
    for (const wrong of [{ telephone: '0240801234' }, { activites: 'judo, ju-jitsu' }, { commune_nom: 'Saint-Sébastien-sur-Loire' }]) {
      const result = await session.call('writeDocument', { document: { ...looseLine, ...wrong } })
      assert.equal(result.isError, true, JSON.stringify(wrong))
    }
  })
})

describe('webmcp eval coherence and large-document checks', () => {
  /**
   * The labels of a case's checks that fail on `data`.
   * @param {string} name
   * @param {unknown} data
   * @param {unknown} start
   * @returns {{ failed: string[] }}
   */
  const outcome = (name, data, start) => {
    const results = runChecks(getCase(name).checks ?? [], data, start)
    return { failed: results.filter((r) => !r.ok).map((r) => r.label) }
  }

  /**
   * @param {string} response
   * @param {RegExp} line
   */
  const indexOf = (response, line) => {
    const match = new RegExp(`^- \\[(\\d+)\\] ${line.source}`, 'm').exec(response)
    assert.ok(match, response)
    return Number(match[1])
  }

  it('should resolve the calendar pickers offline, from the capture', async () => {
    const evalCase = getCase('calendar')
    assert.ok(evalCase.remote, 'calendar serves its pickers from a capture')
    const session = new EvalSession(evalCase, { fetch: async () => { throw new Error('the network must not be reached') } })
    await session.call('getFieldSuggestions', { path: '/$allOf-0/datasets/0', query: '' })
    assert.equal(session.calls[0].isError, false, session.calls[0].response)
    await session.call('getFieldSuggestions', { path: '/$allOf-0/datasets/0', query: 'Agenda-manifestations' })
    assert.equal(session.calls[1].isError, false, session.calls[1].response)
    const index = indexOf(session.calls[1].response, /Agenda-manifestations \(/)
    await session.call('setFieldValue', { path: '/$allOf-0/datasets/0', suggestionIndex: index })
    assert.equal(session.calls[2].isError, false, session.calls[2].response)
    // the picked dataset is stored whole, column schema included
    assert.ok(JSON.stringify(/** @type {any} */ (session.data).datasets[0]).length > 10000, 'the dataset object is kept whole')
    await session.call('getFieldSuggestions', { path: '/$allOf-1/labelField', query: '' })
    assert.equal(session.calls[3].isError, false, session.calls[3].response)
    assert.match(session.calls[3].response, /nomevenement/)
  })

  it('should answer the calendar URLs whatever the order of their parameters', async () => {
    const get = /** @type {(url: string) => Promise<any>} */ (caseFetch(getCase('calendar')))
    const listing = await get('api/v1/datasets?size=100&short-concept=date,startDate,endDate&owner=organization:p6Qg1z-aq&select=title,isRest,schema,timePeriod,attachmentsAsImage,userPermissions&q=&status=finalized')
    const href = listing.results.find((/** @type {any} */ d) => d.title === 'Agenda-manifestations').href
    for (const url of [`${href}/schema?calculated=false`, `${href}/schema`, `${new URL(href).pathname.replace('/data-fair/', '')}/schema?calculated=false`]) {
      assert.ok((await get(url)).length > 10, url)
    }
    // a search that matches nothing is an empty listing, as on a real API
    assert.deepEqual(await get('api/v1/datasets?q=nothing-captured'), { count: 0, results: [] })
    await assert.rejects(get('api/v1/applications'), /404/)
  })

  it('should find the calendar dataset from the words a person types, in the form', async () => {
    for (const query of ['Agenda', 'agenda manifestations', 'AGENDA-MANIFESTATIONS', 'agénda']) {
      const session = new EvalSession(getCase('calendar'), { fetch: async () => { throw new Error('the network must not be reached') } })
      await session.call('getFieldSuggestions', { path: '/$allOf-0/datasets/0', query })
      assert.equal(session.calls[0].isError, false, session.calls[0].response)
      assert.match(session.calls[0].response, /Agenda-manifestations \(/, query)
    }
  })

  it('should answer the calendar dataset search on the path, whatever the projection parameters', async () => {
    const body = /** @type {(url: string) => Promise<any>} */ (caseFetch(getCase('calendar')))
    const titles = (/** @type {any} */ listing) => listing.results.map((/** @type {any} */ d) => d.title)
    const found = await body('api/v1/datasets?q=Agenda-manifestations&owner=organization:p6Qg1z-aq')
    assert.deepEqual(titles(found), ['Agenda-manifestations'])
    assert.equal(found.results[0].isRest, true, 'a REST dataset says so whichever listing it came from')
    assert.ok(found.results[0].schema.length > 10, 'the dataset carries its columns')
    // every word required, in any order, accents and case folded
    assert.deepEqual(titles(await body('api/v1/datasets?q=manifestations agenda')), ['Agenda-manifestations'])
    assert.ok(titles(await body('api/v1/datasets?q=agenda&select=title')).includes('Agenda-manifestations'))
    // select projects each result, as data-fair does: the selected fields plus those it always adds
    const always = ['id', 'slug', 'href', 'page', 'owner', 'public', 'visibility', 'previews']
    const projected = await body('api/v1/datasets?q=Agenda-manifestations&select=title,href')
    assert.deepEqual(Object.keys(projected.results[0]).sort(), [...new Set(['title', 'href', ...always])].sort())
    // without select, the captured object whole
    assert.ok(Object.keys(found.results[0]).length > always.length + 2)
    // no q: the whole captured listing; a smaller size truncates, the count stays
    const all = await body('api/v1/datasets?status=finalized&size=100')
    assert.ok(all.count >= 27 && all.results.length === all.count, JSON.stringify(all.count))
    const two = await body('api/v1/datasets?size=2')
    assert.equal(two.results.length, 2)
    assert.equal(two.count, all.count)
    // rest=true keeps the REST datasets only
    const rest = await body('api/v1/datasets?rest=true&q=agenda')
    assert.deepEqual(titles(rest), ['Agenda-manifestations'])
    // a per-dataset path is served whatever its query, and the dataset itself from the listings
    const id = found.results[0].id
    assert.ok((await body(`api/v1/datasets/${id}/schema?mimeType=application/json`)).length > 10)
    assert.equal((await body(`api/v1/datasets/${id}/schema?calculated=false`)).length, 27)
    assert.equal((await body(`https://koumoul.com/data-fair/api/v1/datasets/${id}`)).title, 'Agenda-manifestations')
    // what was never captured stays a 404
    for (const url of ['api/v1/datasets/unknown-id/schema', `api/v1/datasets/${id}/lines`, 'api/v1/applications']) {
      await assert.rejects(body(url), /^Error: 404 Not Found/, url)
    }
  })

  it('should tell no arm, in any 404 or description, that it is evaluated', async () => {
    // Every remote a 404: the error texts the runner reads are where the fixture's host shows.
    const failing = (/** @type {string} */ name) => ({ ...getCase(name), saveMode: /** @type {const} */ ('explicit'), remote: () => undefined })
    const attempts = {
      calendar: { path: '/$allOf-0/datasets/0', lookup: 'list_account_datasets', args: { q: 'agenda' } },
      'data-fair-line': { path: '/commune', lookup: 'get_field_values', args: { datasetId: 'communes', fieldKey: 'nom', q: 'nantes' } }
    }
    for (const [name, attempt] of Object.entries(attempts)) {
      for (const arm of ['form', 'session', 'plain']) {
        const session = await createArm(failing(name), arm)
        const result = arm === 'plain'
          ? await session.call(attempt.lookup, attempt.args)
          : await session.call('getFieldSuggestions', { path: attempt.path, query: 'agenda' })
        const text = result.content.map((/** @type {any} */ p) => p.text).join('')
        assert.equal(result.isError, true, `${name} ${arm}: ${text}`)
        assert.match(text, /404/, `${name} ${arm}`)
        assert.ok(!/eval/i.test(text), `${name} ${arm} leaks: ${text}`)
        assert.ok(!/eval/i.test(session.prompt), `${name} ${arm} prompt`)
        for (const tool of session.tools) assert.ok(!/eval/i.test(tool.description), `${name} ${arm} ${tool.name}`)
      }
    }
  })

  it('should check the calendar against the dataset, the event name column and crowd sourcing', async () => {
    const evalCase = getCase('calendar')
    const session = new EvalSession(evalCase)
    await session.call('getFieldSuggestions', { path: '/$allOf-0/datasets/0', query: 'Agenda-manifestations' })
    await session.call('setFieldValue', { path: '/$allOf-0/datasets/0', suggestionIndex: indexOf(session.calls[0].response, /Agenda-manifestations \(/) })
    await session.call('getFieldSuggestions', { path: '/$allOf-1/labelField', query: '' })
    // "Nom" is the applicant's name, the trap; the event name is its own column
    await session.call('setFieldValue', { path: '/$allOf-1/labelField', suggestionIndex: indexOf(session.calls[2].response, /Nom de l'évenement/) })
    await session.call('setFieldValue', { path: '/$allOf-3/crowdSourcing', value: true })
    for (const call of session.calls) assert.equal(call.isError, false, call.response)
    assert.deepEqual(outcome('calendar', session.data, session.start).failed, [])
    assert.equal(evalCase.checks?.length, 3)

    const wrongLabel = structuredClone(/** @type {any} */ (session.data))
    wrongLabel.labelField = { ...wrongLabel.labelField, key: 'nom' }
    assert.equal(outcome('calendar', wrongLabel, session.start).failed.length, 1)
    const wrongDataset = structuredClone(/** @type {any} */ (session.data))
    wrongDataset.datasets[0].href = 'https://koumoul.com/data-fair/api/v1/datasets/hxyyxil1dhvz-7pfs89za6da'
    assert.equal(outcome('calendar', wrongDataset, session.start).failed.length, 1)
    const noCrowd = { ...(/** @type {any} */ (session.data)), crowdSourcing: false }
    assert.equal(outcome('calendar', noCrowd, session.start).failed.length, 1)
  })

  it('should check the portal configuration change and nothing it does not ask for', () => {
    const evalCase = getCase('portal-config-edit')
    assert.equal(evalCase.saveMode, 'auto')
    const start = evalCase.data
    const changed = structuredClone(/** @type {any} */ (start))
    changed.theme.assistedModeColors.primary = '#1B5E20'
    changed.theme.colors.primary = '#1B5E20'
    changed.menu.children.push({ type: 'generic', pageRef: { slug: 'jeunesse', title: 'Nos actions pour la jeunesse' }, title: 'Jeunesse' })
    assert.deepEqual(outcome('portal-config-edit', changed, start).failed, [])
    assert.equal(outcome('portal-config-edit', start, start).failed.length, 1, 'the page is not in the menu yet')
    const unrelated = structuredClone(changed)
    unrelated.theme.assistedModeColors.secondary = '#000000'
    assert.equal(outcome('portal-config-edit', unrelated, start).failed.length, 1)
    const wrongPage = structuredClone(changed)
    wrongPage.menu.children.at(-1).pageRef = { slug: 'contact-presse', title: 'Contact presse' }
    assert.equal(outcome('portal-config-edit', wrongPage, start).failed.length, 1)
  })

  it('should check the chart edit against exactly the two settings it changes', () => {
    const evalCase = getCase('charts-edit')
    assert.equal(evalCase.checks?.length, 3)
    const start = evalCase.data
    assert.ok(outcome('charts-edit', start, start).failed.length > 0, 'doing nothing must not pass')
    const changed = structuredClone(/** @type {any} */ (start))
    changed.chart.config.valueCalc.metric = 'max'
    changed.legendPosition = 'bottom'
    assert.deepEqual(outcome('charts-edit', changed, start).failed, [])
    const otherGrouping = structuredClone(changed)
    otherGrouping.chart.config.groupBy.field = 'code_com'
    assert.equal(outcome('charts-edit', otherGrouping, start).failed.length, 1)
    const otherTitle = { ...changed, title: 'Pollution' }
    assert.equal(outcome('charts-edit', otherTitle, start).failed.length, 1)
    assert.deepEqual(outcome('charts-edit', { ...changed, legendPosition: 'top' }, start).failed, ['the legend is at the bottom'])
    const minimum = structuredClone(changed)
    minimum.chart.config.valueCalc.metric = 'min'
    assert.deepEqual(outcome('charts-edit', minimum, start).failed, ['the chart shows the maximum'])
  })

  it('should check the page edit against the removed block and the title only', () => {
    const evalCase = getCase('portal-page-edit')
    assert.equal(evalCase.checks?.length, 2)
    const start = evalCase.data
    assert.ok(outcome('portal-page-edit', start, start).failed.length > 0, 'doing nothing must not pass')
    const changed = structuredClone(/** @type {any} */ (start))
    changed.elements.splice(2, 1)
    changed.title = 'Données ouvertes'
    assert.deepEqual(outcome('portal-page-edit', changed, start).failed, [])
    const wrongBlock = structuredClone(/** @type {any} */ (start))
    wrongBlock.elements.splice(0, 1)
    wrongBlock.title = 'Données ouvertes'
    assert.equal(outcome('portal-page-edit', wrongBlock, start).failed.length, 1)
    const unrelated = structuredClone(changed)
    unrelated.showBreadcrumbs = false
    assert.equal(outcome('portal-page-edit', unrelated, start).failed.length, 1)
    assert.deepEqual(outcome('portal-page-edit', { ...changed, title: 'Données' }, start).failed, ['the page is titled "Données ouvertes"'])
  })
})

describe('webmcp eval no-guide variant', () => {
  it('strips the schema\'s agent guide and nothing else', async () => {
    const { applyVariant } = await import('../webmcp-eval/session.js')
    const { getCase } = await import('../webmcp-eval/cases/index.js')
    const guided = getCase('portal-config-edit')
    assert.ok(guided.schema['x-agent-guide'], 'the vendored case carries a guide')
    const stripped = applyVariant(guided, 'no-guide')
    assert.equal(stripped.schema['x-agent-guide'], undefined)
    assert.equal(stripped.schema['x-i18n-x-agent-guide'], undefined)
    assert.ok(guided.schema['x-agent-guide'], 'the shared case is not mutated')
    assert.deepEqual(Object.keys(stripped.schema.properties), Object.keys(guided.schema.properties))
  })
})

describe('webmcp eval save modes', () => {
  it('should save the app configurations by themselves, and the contact and the line on demand', async () => {
    for (const name of ['calendar', 'charts-edit', 'portal-config-edit', 'portal-page-list-edit', 'portal-page-reorder', 'portal-page-switch', 'portal-config-multi']) {
      assert.equal(getCase(name).saveMode, 'auto', name)
      const arm = await createArm(getCase(name), 'session')
      assert.equal(arm.runnable, false, `${name} is not runnable on the session arm until FormSession auto-saves`)
    }
    for (const name of ['contact', 'data-fair-line']) {
      assert.notEqual(getCase(name).saveMode, 'auto', name)
      assert.equal((await createArm(getCase(name), 'session')).runnable, true, name)
    }
  })
})

describe('webmcp eval nested-document cases', () => {
  const nested = ['portal-page-list-edit', 'portal-page-reorder', 'portal-page-switch', 'portal-config-multi']

  /**
   * The labels of a case's checks that fail on the data an arm ended with.
   * @param {string} name
   * @param {unknown} data
   * @param {unknown} start
   * @returns {string[]}
   */
  const failed = (name, data, start) => runChecks(getCase(name).checks ?? [], data, start).filter((r) => !r.ok).map((r) => r.label)

  /**
   * A form session on the case, and a way to call its tools that fails on any refused call.
   * @param {string} name
   */
  const form = (name) => {
    const session = new EvalSession(getCase(name))
    /**
     * @param {string} tool
     * @param {Record<string, unknown>} args
     */
    const call = async (tool, args) => {
      const result = await session.call(tool, args)
      assert.ok(!result.isError, `${tool} ${JSON.stringify(args)}: ${session.calls.at(-1)?.response}`)
      return result
    }
    return { session, call }
  }

  /**
   * The plain API takes the edited document as the form left it: both arms validate alike.
   * @param {string} name
   * @param {unknown} data
   */
  const plainAccepts = async (name, data) => {
    const plain = new PlainApiSession(getCase(name))
    const result = await plain.call('writeDocument', { document: data })
    assert.ok(!result.isError, result.content[0].text)
    assert.deepEqual(failed(name, plain.data, getCase(name).data), [])
  }

  for (const name of nested) {
    it(`should start ${name} from a large document the form accepts as it is`, () => {
      const evalCase = getCase(name)
      assert.equal(evalCase.saveMode, 'auto', 'a portal page or configuration is a draft saved as it changes')
      const { session } = form(name)
      assert.equal(session.valid, true, 'the starting document must be valid in the form')
      // stored as the form normalizes it, so every arm starts from the same document
      assert.deepEqual(session.start, evalCase.data)
      assert.ok(JSON.stringify(evalCase.data).length > 6000, 'reading or resending the document is not free')
      assert.ok(failed(name, evalCase.data, evalCase.data).length > 0, 'doing nothing must not pass')
    })
  }

  it('should start the page cases from a page with nested blocks', () => {
    const page = /** @type {any} */ (getCase('portal-page-list-edit').data)
    assert.ok(page.elements.length >= 8)
    assert.ok(page.elements.some((/** @type {any} */ e) => e.type === 'two-columns' && e.children.length && e.children2.length))
    for (const name of ['portal-page-reorder', 'portal-page-switch']) assert.deepEqual(getCase(name).data, page, name)
  })

  it('should check the rename of a block in the middle of a nested list', async () => {
    const name = 'portal-page-list-edit'
    const { session, call } = form(name)
    assert.equal(/** @type {any} */ (session.start).elements[6].children[2].title, 'Budget et finances')
    await call('setFieldValue', { path: '/elements/6/children/2/title', value: 'Budget et fiscalité' })
    assert.equal(session.valid, true)
    assert.deepEqual(failed(name, session.data, session.start), [])
    await plainAccepts(name, session.data)

    const wrongCard = structuredClone(/** @type {any} */ (session.start))
    wrongCard.elements[6].children[1].title = 'Budget et fiscalité'
    assert.equal(failed(name, wrongCard, session.start).length, 2, 'the wrong card renamed, the right one not')
    const collateral = structuredClone(/** @type {any} */ (session.data))
    collateral.elements[6].children[2].children[0].content = 'Le budget.'
    assert.equal(failed(name, collateral, session.start).length, 1)
  })

  it('should resolve a path mixing layout and data segments', async () => {
    const { session, call } = form('portal-page-list-edit')
    await call('setFieldValue', { path: '/$comp-2/elements/6/children/2/title', value: 'Budget et fiscalité' })
    assert.equal(/** @type {any} */ (session.data).elements[6].children[2].title, 'Budget et fiscalité')
    const described = await call('describeState', { path: '/$comp-2/elements/6/children/2/title' })
    assert.match(described.content[0].text, /title/)
  })

  it('should resolve a key under a $oneOf without the variant index, in the active variant only', async () => {
    const { session, call } = form('portal-config-edit')
    await call('editArray', { path: '/menu/children', action: 'add' })
    await call('setFieldValue', { path: '/menu/children/2/$oneOf', value: 1 })
    for (const path of ['/menu/children/2/$oneOf/pageRef', '/menu/children/2/pageRef']) {
      const suggestions = await call('getFieldSuggestions', { path, query: 'jeunesse' })
      assert.match(suggestions.content[0].text, /jeunesse/, path)
    }
    await call('setFieldValue', { path: '/menu/children/2/$oneOf/pageRef', suggestionIndex: 0 })
    assert.equal(/** @type {any} */ (session.data).menu.children[2].pageRef.slug, 'jeunesse')
    // a key of another variant must not resolve to the active one
    const other = await session.call('setFieldValue', { path: '/menu/children/2/$oneOf/0/subtype', value: 'home' })
    assert.equal(other.isError, true)
    assert.equal(/** @type {any} */ (session.data).menu.children[2].subtype, undefined)
  })

  it('should say where a path leads when it does not resolve', async () => {
    const page = form('portal-page-list-edit')
    const typo = await page.session.call('describeState', { path: '/$comp-2/elements/6/children/2/titel' })
    assert.equal(typo.isError, true)
    const text = typo.content[0].text
    assert.match(text, /leads as far as \/\$comp-2\/elements\/6\/children\/2\b/)
    assert.match(text, /children\/2\/\$oneOf\/12\/title/)

    const { call, session } = form('portal-config-edit')
    await call('editArray', { path: '/menu/children', action: 'add' })
    const before = await session.call('getFieldSuggestions', { path: '/menu/children/2/$oneOf/pageRef', query: 'x' })
    assert.equal(before.isError, true)
    assert.match(before.content[0].text, /\/menu\/children\/2\/\$oneOf\/1\/pageRef/)
    assert.match(before.content[0].text, /switch/i)
    await call('setFieldValue', { path: '/menu/children/2/$oneOf', value: 4 })
    const other = await session.call('getFieldSuggestions', { path: '/menu/children/2/pageRef', query: 'x' })
    assert.equal(other.isError, true)
    assert.match(other.content[0].text, /\/\$oneOf\/1\/pageRef/)
  })

  it('should check an insertion, a move and a removal on the same page', async () => {
    const name = 'portal-page-reorder'
    const { session, call } = form(name)
    const start = /** @type {any} */ (session.start)
    assert.equal(start.elements[2].type, 'alert')
    assert.equal(start.elements[7].content, 'Questions fréquentes')
    assert.equal(start.elements[3].children[2].link.title, 'Voir tout le catalogue')
    const alert = start.elements[2]
    await call('editArray', { path: '/elements', action: 'remove', index: 2 })
    await call('editArray', { path: '/elements', action: 'add', index: 0, value: alert })
    await call('editArray', { path: '/elements', action: 'add', index: 7, value: { type: 'divider' } })
    await call('editArray', { path: '/elements/3/children', action: 'remove', index: 2 })
    assert.equal(session.valid, true)
    assert.deepEqual(failed(name, session.data, session.start), [])
    await plainAccepts(name, session.data)

    // the alert removed but never put back
    const lost = structuredClone(/** @type {any} */ (session.data))
    lost.elements.splice(0, 1)
    assert.ok(failed(name, lost, session.start).length > 3)
    // the divider after the title instead of before it
    const after = structuredClone(/** @type {any} */ (session.data))
    after.elements.splice(7, 2, after.elements[8], after.elements[7])
    assert.ok(failed(name, after, session.start).length >= 2)
    // the wrong block removed from the column
    const wrongRemoval = structuredClone(/** @type {any} */ (session.start))
    wrongRemoval.elements[3].children.splice(1, 1)
    const wrongData = structuredClone(/** @type {any} */ (session.data))
    wrongData.elements[3].children = wrongRemoval.elements[3].children
    assert.ok(failed(name, wrongData, session.start).length >= 1)
    // a block the goal does not name changed on the way
    const collateral = structuredClone(/** @type {any} */ (session.data))
    collateral.elements[9].panels[1].title = 'Licence'
    assert.equal(failed(name, collateral, session.start).length, 1)
  })

  it('should check a block switched to another type, its text kept and its old fields gone', async () => {
    const name = 'portal-page-switch'
    const { session, call } = form(name)
    const start = /** @type {any} */ (session.start)
    const paragraph = start.elements[3].children2[1]
    assert.equal(paragraph.type, 'text')
    assert.ok(paragraph.content.startsWith('Besoin d\'aide ?'))
    assert.ok('centered' in paragraph)
    // Replacing the block is one path that ends valid; switching its option selector is the
    // other (next test). The `absent` check tells either apart from a switch that kept the
    // paragraph's own field.
    await call('editArray', { path: '/elements/3/children2', action: 'remove', index: 1 })
    await call('editArray', { path: '/elements/3/children2', action: 'add', index: 1, value: { uuid: paragraph.uuid, type: 'alert', alertType: 'info', content: paragraph.content } })
    assert.equal(session.valid, true)
    assert.deepEqual(failed(name, session.data, session.start), [])
    await plainAccepts(name, session.data)

    const kept = structuredClone(/** @type {any} */ (session.data))
    kept.elements[3].children2[1].centered = false
    assert.equal(failed(name, kept, session.start).length, 1, 'the paragraph\'s own field must be gone')
    const rewritten = structuredClone(/** @type {any} */ (session.data))
    rewritten.elements[3].children2[1].content = 'Besoin d\'aide ? Écrivez-nous.'
    assert.equal(failed(name, rewritten, session.start).length, 1)
    const warning = structuredClone(/** @type {any} */ (session.data))
    warning.elements[3].children2[1].alertType = 'warning'
    assert.equal(failed(name, warning, session.start).length, 1)
  })

  // Round 2: switching the nested paragraph with its option selector carried `centered` over
  // into the alert, which refuses it, and the form ended invalid with no error on any node.
  it('should switch a nested block to another type with its option selector, its old fields gone', async () => {
    const name = 'portal-page-switch'
    const { session, call } = form(name)
    const paragraph = /** @type {any} */ (session.start).elements[3].children2[1]
    const result = await call('setFieldValue', { path: '/elements/3/children2/1/$oneOf', value: 2 })
    const text = result.content[0].text
    const block = /** @type {any} */ (session.data).elements[3].children2[1]
    assert.equal(block.type, 'alert')
    assert.equal(block.content, paragraph.content)
    assert.ok(!('centered' in block), `the paragraph's own field must be gone, got ${JSON.stringify(block)}`)
    assert.equal(session.valid, true, text)
    assert.match(text, /form is valid/)
    await call('setFieldValue', { path: '/elements/3/children2/1/$oneOf/2/alertType', value: 'info' })
    assert.equal(session.valid, true)
    assert.deepEqual(failed(name, session.data, session.start), [])
  })

  it('should check four scattered changes of the portal configuration', async () => {
    const name = 'portal-config-multi'
    const evalCase = getCase(name)
    assert.deepEqual(evalCase.lookups, ['list_portal_pages'])
    const { session, call } = form(name)
    const start = /** @type {any} */ (session.start)
    assert.equal(start.datasets.card.showDepartment, true)
    assert.equal(start.breadcrumb.position, 'none')
    await call('setFieldValue', { path: '/datasets/card/showDepartment', value: false })
    await call('setFieldValue', { path: '/socialShares', value: ['bluesky', 'linkedin', 'facebook'] })
    await call('setFieldValue', { path: '/breadcrumb/position', value: 'above-footer' })
    const links = start.footer.links.length
    await call('editArray', { path: '/footer/links', action: 'add', value: { type: 'generic' } })
    await call('getFieldSuggestions', { path: `/footer/links/${links}/pageRef`, query: 'presse' })
    const index = /^- \[(\d+)\] .*contact-presse/m.exec(session.calls.at(-1)?.response ?? '')?.[1]
    assert.ok(index !== undefined, session.calls.at(-1)?.response)
    await call('setFieldValue', { path: `/footer/links/${links}/pageRef`, suggestionIndex: Number(index) })
    assert.equal(session.valid, true)
    assert.deepEqual(failed(name, session.data, session.start), [])
    await plainAccepts(name, session.data)

    const missed = structuredClone(/** @type {any} */ (session.data))
    missed.datasets.card.showDepartment = true
    assert.equal(failed(name, missed, session.start).length, 1)
    const extraShare = structuredClone(/** @type {any} */ (session.data))
    extraShare.socialShares.push('x')
    assert.equal(failed(name, extraShare, session.start).length, 1)
    const lostLink = structuredClone(/** @type {any} */ (session.data))
    lostLink.footer.links.splice(0, 1)
    assert.deepEqual(failed(name, lostLink, session.start), ['the footer keeps its link "Plan du site"', 'the footer has one link more'])
    // where the new link goes is not stated
    const first = structuredClone(/** @type {any} */ (session.data))
    first.footer.links.unshift(first.footer.links.pop())
    assert.deepEqual(failed(name, first, session.start), [])
    const collateral = structuredClone(/** @type {any} */ (session.data))
    collateral.applications.card.showDepartment = false
    assert.equal(failed(name, collateral, session.start).length, 1)
  })
})
