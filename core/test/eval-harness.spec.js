import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'

import { cases, getCase } from '../eval/cases/index.js'
import { EvalSession } from '../eval/session.js'

/**
 * These are not agent runs — no model is involved. They drive each case through a
 * hand-written but realistic tool sequence, which pins two things an agent-driven eval
 * cannot pin reproducibly in CI: that a competent path through the protocol EXISTS and
 * stays within budget, and that the harness itself scores correctly. A regression that
 * makes a form need twice as many calls fails here, deterministically, before anyone
 * spends tokens discovering it.
 */
describe('eval harness', () => {
  it('should expose the same tools a page would register, including the skill', () => {
    const session = new EvalSession(getCase('contact'))
    const names = session.tools.map((t) => t.name)
    for (const expected of ['fillFormSkill', 'getData', 'getSchema', 'describeState', 'setData', 'setFieldValue', 'editArray', 'getFieldSuggestions']) {
      assert.ok(names.includes(expected), `missing tool ${expected}, got ${names.join(', ')}`)
    }
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

  it('should fill the small form in one setData, within budget', async () => {
    // The skill tells agents to try a whole-object write on a small form; if that path
    // ever stops working this budget is the thing that notices.
    const evalCase = getCase('contact')
    const session = new EvalSession(evalCase)
    await session.call('fillFormSkill', {})
    await session.call('getData', {})
    await session.call('getSchema', {})
    await session.call('setData', { data: evalCase.expected })

    const { passed, checks } = session.score()
    assert.ok(passed, session.report())
    assert.ok(checks.every((c) => c.passed))
    assert.deepEqual(session.data, evalCase.expected)
  })

  it('should fill an array form via editArray + per-field writes, within budget', async () => {
    const evalCase = getCase('team')
    const session = new EvalSession(evalCase)
    await session.call('fillFormSkill', {})
    await session.call('getSchema', {})
    await session.call('setFieldValue', { path: '/teamName', value: 'Analytical Engine' })

    for (const member of /** @type {any[]} */(evalCase.expected.members)) {
      const added = await session.call('editArray', { path: '/members', action: 'add' })
      assert.ok(!added.isError, `editArray add failed: ${JSON.stringify(added)}`)
      const index = /** @type {any[]} */(/** @type {any} */(session.data).members).length - 1
      await session.call('setFieldValue', { path: `/members/${index}/name`, value: member.name })
      await session.call('setFieldValue', { path: `/members/${index}/role`, value: member.role })
    }

    assert.ok(session.score().passed, session.report())
    assert.deepEqual(session.data, evalCase.expected)
  })

  it('should fill the large form field by field without reading the whole schema', async () => {
    // The "large" branch of the skill steers agents away from the full schema. Reading
    // it here anyway would still pass the data checks, so the byte budget is what
    // actually enforces the guidance.
    const evalCase = getCase('dataset')
    const session = new EvalSession(evalCase)
    await session.call('fillFormSkill', {})
    await session.call('describeState', {})
    for (const [key, value] of Object.entries(evalCase.expected)) {
      const result = await session.call('setFieldValue', { path: `/${key}`, value })
      assert.ok(!result.isError, `setFieldValue /${key} failed: ${JSON.stringify(result)}`)
    }

    assert.ok(session.score().passed, session.report())
    for (const [key, value] of Object.entries(evalCase.expected)) {
      assert.deepEqual(/** @type {any} */(session.data)[key], value, `field ${key}`)
    }
  })

  it('should fail the score when a run leaves the form incomplete', async () => {
    // Guards the harness itself: a truncated run — exactly what a step-capped sub-agent
    // produces — must score as a failure, never as a pass with missing data.
    const session = new EvalSession(getCase('contact'))
    await session.call('setFieldValue', { path: '/name', value: 'Ada Lovelace' })

    const { passed, checks } = session.score()
    assert.equal(passed, false)
    assert.equal(checks.find((c) => c.name === 'data')?.passed, false)
  })

  it('should fail the score when a run exceeds its call budget', async () => {
    const evalCase = getCase('contact')
    const session = new EvalSession(evalCase)
    await session.call('setData', { data: evalCase.expected })
    for (let i = 0; i < evalCase.budget.toolCalls; i++) await session.call('getData', {})

    const { passed, checks } = session.score()
    assert.equal(passed, false)
    assert.equal(checks.find((c) => c.name === 'tool-calls')?.passed, false)
    // The data itself was still correct — only the cost check should have failed.
    assert.equal(checks.find((c) => c.name === 'data')?.passed, true)
  })

  it('should define a coherent budget for every case', () => {
    for (const evalCase of cases) {
      assert.ok(evalCase.budget.toolCalls > 0, `${evalCase.name} needs a call budget`)
      assert.ok(evalCase.budget.outputBytes > 0, `${evalCase.name} needs a byte budget`)
      assert.ok(Object.keys(evalCase.expected).length > 0, `${evalCase.name} needs expectations`)
    }
  })
})
