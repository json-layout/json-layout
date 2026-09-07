import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'

import { compile } from '../src/compile/index.js'
import { StatefulLayout } from '../src/state/index.js'
import { getComplexity } from '../src/webmcp/index.js'
import * as getSchema from '../src/webmcp/tools/get-schema.js'

import { cases, getCase } from '../webmcp-eval/cases/index.js'
import { TOOL_NAMES } from '../webmcp-eval/run-case.js'
import { EvalSession } from '../webmcp-eval/session.js'

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

    it(`should place ${evalCase.name} in its declared complexity band`, () => {
      // The check the old dataset case slipped past: it was labelled large and was medium.
      const compiled = compile(evalCase.schema)
      const mainTree = compiled.skeletonTrees[compiled.mainTree]
      const layout = new StatefulLayout(compiled, mainTree, {}, evalCase.data)
      assert.equal(getComplexity(layout), evalCase.expectedComplexity)
    })

    it(`should match the declared getSchema behaviour for ${evalCase.name}`, () => {
      // Band and schema size are independent — calendar is large yet its schema fits —
      // so only a case declaring expectedSchemaFits false exercises path navigation.
      const compiled = compile(evalCase.schema)
      const mainTree = compiled.skeletonTrees[compiled.mainTree]
      const layout = new StatefulLayout(compiled, mainTree, {}, evalCase.data)
      const result = getSchema.execute(layout, evalCase.schema, {})
      assert.equal(!result.tooLarge, evalCase.expectedSchemaFits)
      // Refusing is only half of the contract: a case that declares the refusal branch
      // must also hand the agent somewhere to go, or the branch is a dead end.
      if (!evalCase.expectedSchemaFits) {
        assert.ok((result.paths ?? []).length > 0, 'a refused schema must offer sub-paths to navigate by')
      }
    })

    it(`should state a usable goal for ${evalCase.name}`, () => {
      // The goal is the runner's only input, so it must read as a user request.
      assert.ok(evalCase.goal.length > 20, 'goal should be a sentence')
      for (const toolName of ['setFieldValue', 'getSchema', 'describeState', 'editArray', 'setData']) {
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

  it('should cover both getSchema branches across the case set', () => {
    // Without at least one oversized schema, nothing reaches the refusal path.
    assert.ok(cases.some((c) => c.expectedSchemaFits === false), 'need a case whose schema is refused')
    assert.ok(cases.some((c) => c.expectedSchemaFits === true), 'need a case whose schema is returned whole')
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

  it('should expose the same tools a page would register, including the skill', () => {
    // TOOL_NAMES is what run-case.js passes to every launched runner's --allowedTools,
    // listed by hand so the launcher needs no compiled form. Nothing else ties it to
    // reality: a tool added or renamed under src/webmcp/ would leave every runner
    // missing it, which reads in a transcript as protocol friction rather than as a
    // broken setup. This is the tie.
    const session = new EvalSession(getCase('contact'))
    const names = session.tools.map((t) => t.name).sort()
    assert.deepEqual(names, [...TOOL_NAMES].sort(), 'TOOL_NAMES must match the tools a session registers — update TOOL_NAMES in run-case.js')
    assert.ok(names.includes('fillFormSkill'), 'the skill a real page exposes must be among them')
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
