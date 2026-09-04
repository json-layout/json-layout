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

  it('should accept an empty friction list on a satisfactory run', () => {
    const clean = JSON.stringify({ case: 'contact', verdict: 'satisfactory', reasoning: 'Filled every field on the first attempt.', friction: [] })
    assert.equal(parseVerdict(clean).friction.length, 0)
  })

  it('should reject text that is not JSON at all', () => {
    assert.throws(() => parseVerdict('The run went fine.'), /could not be parsed as JSON/)
  })
})
