import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'

import { FormSessionArm } from '../webmcp-eval/session-arm.js'
import { getCase } from '../webmcp-eval/cases/index.js'

/** @typedef {import('../webmcp-eval/cases/types.js').EvalCase} EvalCase */

const contact = () => /** @type {EvalCase} */ (getCase('contact'))
const ada = { name: 'Ada Lovelace', email: 'ada@analytical.org', birthYear: 1815 }

describe('FormSessionArm', () => {
  it('exposes the form tools and the save tool', async () => {
    const arm = await FormSessionArm.create(contact())
    assert.equal(arm.runnable, true)
    assert.ok(arm.toolNames.includes('setData'))
    assert.ok(arm.toolNames.includes('saveForm'))
  })

  it('scores the saved document and counts saves', async () => {
    const arm = await FormSessionArm.create(contact())
    const edit = await arm.call('setData', { data: ada })
    assert.ok(!edit.isError)
    assert.deepEqual(arm.data, arm.start, 'an unsaved edit is not a result')
    const saved = await arm.call('saveForm', {})
    assert.ok(!saved.isError)
    assert.equal(arm.saves, 1)
    assert.deepEqual(arm.data, ada)
    assert.equal(arm.valid, true)
  })

  it('leaves data at the start when nothing is saved, and records every call', async () => {
    const arm = await FormSessionArm.create({ ...contact(), data: { name: 'Bob' } })
    await arm.call('setData', { data: ada })
    await arm.call('nope', {})
    assert.deepEqual(arm.data, { name: 'Bob' })
    assert.equal(arm.saves, 0)
    const evidence = arm.evidence()
    assert.equal(evidence.arm, 'session')
    assert.deepEqual(evidence.start, { name: 'Bob' })
    assert.equal(evidence.calls.length, 2)
    assert.equal(evidence.calls[1].isError, true)
    assert.equal(evidence.metrics.toolCalls, 2)
    assert.match(arm.report(), /form session/)
  })

  it('refuses a save of an invalid form and keeps the start', async () => {
    const arm = await FormSessionArm.create(contact())
    const saved = await arm.call('saveForm', {})
    assert.equal(saved.isError, true)
    assert.equal(arm.saves, 0)
  })

  it('prompts with the session runner prompt then the session skill, naming no evaluation', async () => {
    const arm = await FormSessionArm.create(contact())
    assert.match(arm.prompt, /^You are assisting a user with a record/)
    assert.match(arm.prompt, /saveForm/)
    assert.doesNotMatch(arm.prompt, /eval|benchmark|\barm\b/i)
  })

  it('answers the case remote lists from its fixture', async () => {
    const arm = await FormSessionArm.create({
      ...contact(),
      remote: () => ({ results: [] }),
      schema: { type: 'object', properties: { a: { type: 'string' } } },
      data: {}
    })
    assert.equal(arm.runnable, true)
  })

  it('runs an auto-save case with no save tool, scoring what each valid write saved', async () => {
    const arm = await FormSessionArm.create({ ...contact(), saveMode: 'auto' })
    assert.equal(arm.runnable, true)
    assert.ok(!arm.toolNames.includes('saveForm'))
    assert.match(arm.prompt, /^You are assisting a user with a record/)
    assert.match(arm.prompt, /your changes are saved as you make them\./)
    assert.doesNotMatch(arm.prompt, /save the record/)
    assert.match(arm.prompt, /saved as they go/)
    assert.doesNotMatch(arm.prompt, /eval|benchmark|\barm\b/i)
    const edit = await arm.call('setData', { data: ada })
    assert.ok(!edit.isError)
    assert.equal(arm.saves, 1)
    assert.deepEqual(arm.data, ada)
  })
})
