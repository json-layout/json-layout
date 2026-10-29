import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'

import { compile } from '../src/compile/index.js'

import { cases, getCase } from '../webmcp-eval/cases/index.js'
import { TOOL_NAMES } from '../webmcp-eval/run-case.js'
import { EvalSession } from '../webmcp-eval/session.js'
import { PlainApiSession } from '../webmcp-eval/plain-api.js'
import { runChecks } from '../webmcp-eval/checks.js'

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
    const saint = /** @type {any} */ (remote(new URL('http://eval.local/communes?q=saint')))
    assert.equal(saint.results.length, 10)
    assert.ok(saint.total > 10)
    const codes = saint.results.map((/** @type {any} */ r) => r.output)
    assert.deepEqual(codes, [...codes].sort())
    assert.ok(!codes.includes('44190'), 'the commune is past the first page of "saint"')
    const reze = /** @type {any} */ (remote(new URL('http://eval.local/communes?q=REZE')))
    // a prefix of the homonym too, and it sorts first
    assert.deepEqual(reze.results, [{ output: '15161', label: '15161 (Rézentières)' }, { output: '44143', label: '44143 (Rezé)' }])
    // a code, or its start, finds the commune as data-fair's q_fields do
    const byCode = /** @type {any} */ (remote(new URL('http://eval.local/communes?q=44190')))
    assert.deepEqual(byCode.results, [{ output: '44190', label: '44190 (Saint-Sébastien-sur-Loire)' }])
    assert.equal(remote(new URL('http://eval.local/unknown')), undefined)
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

  it('should answer the calendar URLs an agent writes by hand, whatever the order of their parameters', async () => {
    const session = new PlainApiSession(getCase('calendar'))
    const listing = await session.call('httpGet', { url: 'api/v1/datasets?size=100&short-concept=date,startDate,endDate&owner=organization:p6Qg1z-aq&select=title,isRest,schema,timePeriod,attachmentsAsImage,userPermissions&q=&status=finalized' })
    assert.equal(listing.isError, false, listing.content[0].text)
    assert.match(listing.content[0].text, /Agenda-manifestations/)
    const href = JSON.parse(listing.content[0].text).results.find((/** @type {any} */ d) => d.title === 'Agenda-manifestations').href
    for (const url of [`${href}/schema?calculated=false`, `${href}/schema`, `${new URL(href).pathname.replace('/data-fair/', '')}/schema?calculated=false`]) {
      const schema = await session.call('httpGet', { url })
      assert.equal(schema.isError, false, `${url}: ${schema.content[0].text}`)
    }
    const unknown = await session.call('httpGet', { url: 'api/v1/datasets?q=nothing-captured' })
    assert.equal(unknown.isError, true)
    assert.match(unknown.content[0].text, /404/)
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
    assert.equal(evalCase.checks?.length, 1)
    const start = evalCase.data
    const changed = structuredClone(/** @type {any} */ (start))
    changed.chart.config.valueCalc.metric = 'max'
    changed.legendPosition = 'bottom'
    assert.deepEqual(outcome('charts-edit', changed, start).failed, [])
    const otherGrouping = structuredClone(changed)
    otherGrouping.chart.config.groupBy.field = 'code_com'
    assert.equal(outcome('charts-edit', otherGrouping, start).failed.length, 1)
    const otherTitle = { ...changed, title: 'Pollution' }
    assert.equal(outcome('charts-edit', otherTitle, start).failed.length, 1)
  })

  it('should check the page edit against the removed block and the title only', () => {
    const evalCase = getCase('portal-page-edit')
    assert.equal(evalCase.checks?.length, 1)
    const start = evalCase.data
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
