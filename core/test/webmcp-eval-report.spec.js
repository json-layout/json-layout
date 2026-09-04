import { strict as assert } from 'node:assert'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

import { summarise, loadRuns } from '../webmcp-eval/report.js'

const here = dirname(fileURLToPath(import.meta.url))
const tmpDir = join(here, '..', 'tmp')

/**
 * @param {string} name
 * @param {string|null} verdict
 * @param {object[]} [friction]
 * @returns {import('../webmcp-eval/report.js').EvalRun}
 */
const run = (name, verdict, friction = []) => ({
  name,
  evidence: {
    case: name,
    goal: `fill the ${name} form`,
    startedAt: '2026-09-04T10:00:00.000Z',
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

  it('should print when the run started so a stale transcript is visible', () => {
    // Evidence files outlive the session that wrote them, so the report must show the
    // age of the run it is describing.
    const { lines } = summarise([run('contact', 'satisfactory')])
    assert.ok(lines.join('\n').includes('started 2026-09-04T10:00:00.000Z'))
  })

  it('should say the start time is unknown rather than omit it', () => {
    const stale = run('contact', 'satisfactory')
    delete (/** @type {any} */(stale.evidence)).startedAt
    assert.ok(summarise([stale]).lines.join('\n').includes('started unknown'))
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

  it('should fail and name a case that never ran', () => {
    // The failure this harness exists to end: a case whose transcript is absent must be
    // reported as missing, not silently dropped so the suite reads green on a third of
    // the cases it claims to cover.
    const { failed, lines } = summarise([
      run('contact', 'satisfactory'),
      { name: 'charts', evidence: null, verdict: null }
    ])
    const text = lines.join('\n')
    assert.equal(failed, true)
    assert.ok(text.includes('charts: not run'), `missing case not named: ${text}`)
  })

  it('should distinguish a case that never ran from a case that ran unjudged', () => {
    // Different failures with different fixes: one means dispatch the runner, the other
    // means judge the transcript.
    const notRun = summarise([{ name: 'charts', evidence: null, verdict: null }]).lines.join('\n')
    const notJudged = summarise([run('charts', null)]).lines.join('\n')
    assert.ok(notRun.includes('not run') && !notRun.includes('not judged'))
    assert.ok(notJudged.includes('not judged') && !notJudged.includes('not run'))
  })

  it('should fail when there is nothing to report', () => {
    const { failed } = summarise([])
    assert.equal(failed, true)
  })
})

describe('webmcp eval run loading', () => {
  /**
   * @param {string} name
   * @param {object} evidence
   * @param {object} [verdict]
   * @returns {{ evidencePath: string, verdictPath: string }}
   */
  function writeRunFiles (name, evidence, verdict) {
    mkdirSync(tmpDir, { recursive: true })
    const evidencePath = join(tmpDir, `webmcp-eval-${name}.json`)
    const verdictPath = join(tmpDir, `webmcp-eval-${name}.verdict.json`)
    writeFileSync(evidencePath, JSON.stringify(evidence))
    if (verdict) writeFileSync(verdictPath, JSON.stringify(verdict))
    return { evidencePath, verdictPath }
  }

  /**
   * @param {string} name
   * @returns {object}
   */
  const evidenceFor = (name) => ({
    case: name,
    goal: 'fill something',
    startedAt: '2026-09-04T10:00:00.000Z',
    metrics: { toolCalls: 3, outputBytes: 100 },
    valid: true,
    calls: []
  })

  it('should treat a verdict file that is valid JSON but not a valid verdict as unjudged, not throw', () => {
    // A raw JSON.parse would accept {} and produce a run with no friction and no
    // verdict field — the silent "no problems found" that parseVerdict exists to
    // prevent. loadRuns must run every verdict file through parseVerdict and fall
    // back to null (unjudged) when it throws, rather than letting the report crash
    // or letting the malformed verdict pass as satisfactory.
    const name = 'report-spec-malformed-verdict'
    const { evidencePath, verdictPath } = writeRunFiles(name, evidenceFor(name), {})

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

  it('should reject a verdict written for a different case', () => {
    // One judge answer copied into every verdict file, or a verdict saved to the wrong
    // path, would otherwise read as an independent clean judgement of this case.
    const name = 'report-spec-wrong-case'
    const { evidencePath, verdictPath } = writeRunFiles(name, evidenceFor(name), {
      case: 'some-other-case',
      verdict: 'satisfactory',
      reasoning: 'went fine',
      friction: []
    })

    try {
      const runs = loadRuns([name])
      assert.equal(runs[0].verdict, null, 'a verdict naming another case must not judge this one')
      const { failed, lines } = summarise(runs)
      assert.equal(failed, true)
      assert.ok(lines.join('\n').includes('not judged'))
    } finally {
      rmSync(evidencePath, { force: true })
      rmSync(verdictPath, { force: true })
    }
  })

  it('should accept a verdict that names the case it judges', () => {
    // The guard above must not reject every verdict: the matching case still passes.
    const name = 'report-spec-right-case'
    const { evidencePath, verdictPath } = writeRunFiles(name, evidenceFor(name), {
      case: name,
      verdict: 'satisfactory',
      reasoning: 'went fine',
      friction: []
    })

    try {
      const runs = loadRuns([name])
      assert.ok(runs[0].verdict, 'a matching verdict must be loaded')
      assert.equal(summarise(runs).failed, false)
    } finally {
      rmSync(evidencePath, { force: true })
      rmSync(verdictPath, { force: true })
    }
  })

  it('should report a requested case with no transcript as not run', () => {
    // Reproduced live before this fix: with one transcript on disk the report printed
    // that case alone and exited 0, saying nothing about the two that never ran.
    const runs = loadRuns(['report-spec-never-ran'])
    assert.equal(runs.length, 1, 'a requested case must appear in the report even with no transcript')
    assert.equal(runs[0].evidence, null)

    const { failed, lines } = summarise(runs)
    assert.equal(failed, true)
    assert.ok(lines.join('\n').includes('report-spec-never-ran: not run'))
  })
})
