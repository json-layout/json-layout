import { strict as assert } from 'node:assert'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

import { summarise, loadRuns } from '../webmcp-eval/report.js'

const here = dirname(fileURLToPath(import.meta.url))
const tmpDir = join(here, '..', 'tmp')

const run = (name, verdict, friction = []) => ({
  evidence: {
    case: name,
    goal: `fill the ${name} form`,
    metrics: { toolCalls: 12, outputBytes: 8000 },
    valid: true,
    calls: []
  },
  verdict: verdict ? { case: name, verdict, reasoning: 'because', friction } : null
})

describe('webmcp eval reporting', () => {
  it('should pass when every judged run was satisfactory', () => {
    const { failed } = summarise([run('contact', 'satisfactory')])
    assert.equal(failed, false)
  })

  it('should fail when any run was unsatisfactory', () => {
    const { failed } = summarise([run('contact', 'satisfactory'), run('charts', 'unsatisfactory')])
    assert.equal(failed, true)
  })

  it('should report metrics as context rather than as a judgement', () => {
    // Numbers describe the run; they never decide it.
    const { lines } = summarise([run('contact', 'satisfactory')])
    const text = lines.join('\n')
    assert.ok(text.includes('12 calls'))
    assert.ok(text.includes('8000 bytes'))
    assert.ok(!/allowed|budget|limit/.test(text), 'must not imply a threshold')
  })

  it('should list friction points with their call anchors', () => {
    const { lines } = summarise([run('charts', 'unsatisfactory', [
      { call: 7, tool: 'getFieldSuggestions', observed: 'No suggestions available', inferred: 'invented a value', severity: 'high' }
    ])])
    const text = lines.join('\n')
    assert.ok(text.includes('call 7'))
    assert.ok(text.includes('getFieldSuggestions'))
    assert.ok(text.includes('high'))
  })

  it('should fail when a run has no verdict', () => {
    // An unjudged run is not a passing run.
    const { failed, lines } = summarise([run('charts', null)])
    assert.equal(failed, true)
    assert.ok(lines.join('\n').includes('not judged'))
  })

  it('should fail when there is nothing to report', () => {
    const { failed } = summarise([])
    assert.equal(failed, true)
  })
})

describe('webmcp eval run loading', () => {
  it('should treat a verdict file that is valid JSON but not a valid verdict as unjudged, not throw', () => {
    // A raw JSON.parse would accept {} and produce a run with no friction and no
    // verdict field — the silent "no problems found" that parseVerdict exists to
    // prevent. loadRuns must run every verdict file through parseVerdict and fall
    // back to null (unjudged) when it throws, rather than letting the report crash
    // or letting the malformed verdict pass as satisfactory.
    const name = 'report-spec-malformed-verdict'
    mkdirSync(tmpDir, { recursive: true })
    const evidencePath = join(tmpDir, `webmcp-eval-${name}.json`)
    const verdictPath = join(tmpDir, `webmcp-eval-${name}.verdict.json`)
    writeFileSync(evidencePath, JSON.stringify({
      case: name,
      goal: 'fill something',
      metrics: { toolCalls: 3, outputBytes: 100 },
      valid: true,
      calls: []
    }))
    writeFileSync(verdictPath, JSON.stringify({}))

    try {
      const runs = loadRuns([name])
      assert.equal(runs.length, 1)
      assert.equal(runs[0].verdict, null, 'a malformed verdict must not be treated as a valid one')

      const { failed, lines } = summarise(runs)
      assert.equal(failed, true)
      assert.ok(lines.join('\n').includes('not judged'))
    } finally {
      rmSync(evidencePath, { force: true })
      rmSync(verdictPath, { force: true })
    }
  })
})
