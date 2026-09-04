import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'

import { compile } from '../src/compile/index.js'
import { StatefulLayout } from '../src/state/index.js'
import { getComplexity } from '../src/webmcp/index.js'
import * as getSchema from '../src/webmcp/tools/get-schema.js'

import { cases, getCase } from '../webmcp-eval/cases/index.js'
import { EvalSession } from '../webmcp-eval/session.js'

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
    })

    it(`should state a usable goal for ${evalCase.name}`, () => {
      // The goal is the runner's only input, so it must read as a user request.
      assert.ok(evalCase.goal.length > 20, 'goal should be a sentence')
      for (const toolName of ['setFieldValue', 'getSchema', 'describeState', 'editArray', 'setData']) {
        assert.ok(!evalCase.goal.includes(toolName), `goal must not name the ${toolName} tool`)
      }
    })
  }

  it('should cover both getSchema branches across the case set', () => {
    // Without at least one oversized schema, nothing reaches the refusal path.
    assert.ok(cases.some((c) => c.expectedSchemaFits === false), 'need a case whose schema is refused')
    assert.ok(cases.some((c) => c.expectedSchemaFits === true), 'need a case whose schema is returned whole')
  })
})

describe('webmcp eval session', () => {
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
})
