import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'

import { parseVerdict } from '../webmcp-eval/verdict.js'

const valid = JSON.stringify({
  case: 'charts',
  verdict: 'unsatisfactory',
  reasoning: 'The agent invented a column name after the suggestions call returned nothing.',
  friction: [
    {
      call: 7,
      tool: 'getFieldSuggestions',
      observed: 'No suggestions available',
      inferred: 'concluded the field was free text and invented a value',
      severity: 'high'
    }
  ]
})

describe('webmcp eval verdict parsing', () => {
  it('should parse a well-formed verdict', () => {
    const verdict = parseVerdict(valid)
    assert.equal(verdict.case, 'charts')
    assert.equal(verdict.verdict, 'unsatisfactory')
    assert.equal(verdict.friction.length, 1)
    assert.equal(verdict.friction[0].call, 7)
    assert.equal(verdict.friction[0].severity, 'high')
  })

  it('should tolerate a verdict wrapped in a fenced code block', () => {
    // A judge is a language model; it will sometimes fence its JSON.
    assert.equal(parseVerdict('```json\n' + valid + '\n```').case, 'charts')
  })

  it('should reject an unknown verdict value', () => {
    // A judge that answers "partially" has not answered the question asked.
    const bad = JSON.stringify({ ...JSON.parse(valid), verdict: 'partially' })
    assert.throws(() => parseVerdict(bad), /verdict must be/)
  })

  it('should reject friction that is not anchored to a call', () => {
    // Unanchored friction is an opinion; anchored friction is evidence.
    const bad = JSON.stringify({ ...JSON.parse(valid), friction: [{ tool: 'getData', observed: 'x', inferred: 'y', severity: 'low' }] })
    assert.throws(() => parseVerdict(bad), /friction\[0\].call/)
  })

  it('should reject a friction call number that is not 1-based', () => {
    // The docstring and the judge prompt both promise a 1-based anchor; `call 0` in the
    // report points at nothing, and a negative one points backwards.
    for (const call of [0, -3]) {
      const bad = JSON.stringify({ ...JSON.parse(valid), friction: [{ call, tool: 'getData', observed: 'x', inferred: 'y', severity: 'low' }] })
      assert.throws(() => parseVerdict(bad), /friction\[0\].call/, `call ${call} must be rejected`)
    }
  })

  it('should reject a friction call number that is not an integer', () => {
    // A judge writing "7" or 7.5 has not named a call in the transcript.
    for (const call of ['7', 7.5, null]) {
      const bad = JSON.stringify({ ...JSON.parse(valid), friction: [{ call, tool: 'getData', observed: 'x', inferred: 'y', severity: 'low' }] })
      assert.throws(() => parseVerdict(bad), /friction\[0\].call/, `call ${JSON.stringify(call)} must be rejected`)
    }
  })

  it('should accept 1 as a friction call number', () => {
    // The lower bound must stay inclusive: the first call is a legitimate anchor.
    const first = JSON.stringify({ ...JSON.parse(valid), friction: [{ call: 1, tool: 'getData', observed: 'x', inferred: 'y', severity: 'low' }] })
    assert.equal(parseVerdict(first).friction[0].call, 1)
  })

  it('should reject an unknown friction severity', () => {
    // Severity orders the findings; "critical" or a missing value would sort nowhere.
    for (const severity of ['critical', undefined, 3]) {
      const bad = JSON.stringify({ ...JSON.parse(valid), friction: [{ call: 2, tool: 'getData', observed: 'x', inferred: 'y', severity }] })
      assert.throws(() => parseVerdict(bad), /friction\[0\].severity/, `severity ${JSON.stringify(severity)} must be rejected`)
    }
  })

  it('should reject friction whose tool, observed or inferred is not a string', () => {
    // Each is printed verbatim in the report; a number or an object there is a judge
    // answer nobody can act on.
    const base = { call: 2, tool: 'getData', observed: 'x', inferred: 'y', severity: 'low' }
    for (const field of ['tool', 'observed', 'inferred']) {
      const bad = JSON.stringify({ ...JSON.parse(valid), friction: [{ ...base, [field]: 42 }] })
      assert.throws(() => parseVerdict(bad), new RegExp(`friction\\[0\\].${field}`), `a non-string ${field} must be rejected`)
    }
  })

  it('should reject a verdict with no case name', () => {
    // The case name is what ties a verdict to the transcript it judges.
    const bad = JSON.stringify({ ...JSON.parse(valid), case: 42 })
    assert.throws(() => parseVerdict(bad), /verdict.case/)
  })

  it('should reject a verdict with no reasoning', () => {
    const bad = JSON.stringify({ ...JSON.parse(valid), reasoning: '   ' })
    assert.throws(() => parseVerdict(bad), /verdict.reasoning/)
  })

  it('should reject a verdict whose friction is not an array', () => {
    const bad = JSON.stringify({ ...JSON.parse(valid), friction: 'none' })
    assert.throws(() => parseVerdict(bad), /verdict.friction/)
  })

  it('should accept an empty friction list on a satisfactory run', () => {
    const clean = JSON.stringify({ case: 'contact', verdict: 'satisfactory', reasoning: 'Filled every field on the first attempt.', friction: [] })
    assert.equal(parseVerdict(clean).friction.length, 0)
  })

  it('should reject text that is not JSON at all', () => {
    assert.throws(() => parseVerdict('The run went fine.'), /could not be parsed as JSON/)
  })
})
