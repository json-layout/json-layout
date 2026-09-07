#!/usr/bin/env node
/**
 * @file Summarise judged eval runs.
 *
 * Deliberately has no thresholds. The old scorer failed a run whose call count exceeded
 * a number someone guessed; here the numbers are printed as context and the verdict is
 * the judge's. An unjudged run counts as a failure — a transcript nobody read is not
 * evidence of anything — and so does a case with no transcript at all: a case that never
 * dispatched must fail the report loudly rather than disappear from it.
 *
 * Usage: npm run webmcp-eval:report -w core [case ...]
 */

import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { cases } from './cases/index.js'
import { parseVerdict } from './verdict.js'
import { sidecarPath } from './run-case.js'

const here = dirname(fileURLToPath(import.meta.url))

/**
 * @typedef {object} EvalRun
 * @property {string} name - the case this run was requested for
 * @property {object|null} evidence - the recorded transcript, or null when the case never ran
 * @property {object|null} verdict - the judge's answer, or null when it is missing, malformed
 *   or written for a different case
 * @property {object|null} [run] - provenance written by the launcher, absent for transcripts
 *   recorded before it existed
 */

/**
 * @param {EvalRun[]} runs
 * @returns {{ lines: string[], failed: boolean }}
 */
export function summarise (runs) {
  /** @type {string[]} */
  const lines = []
  let failed = false

  if (!runs.length) {
    lines.push('no runs found — see core/webmcp-eval/README.md for how to run the eval')
    return { lines, failed: true }
  }

  for (const { name, evidence, verdict, run } of runs) {
    lines.push('')
    const runRecord = /** @type {any} */(run)
    if (!evidence) {
      // A missing transcript is a case whose subprocess never produced one — it may never
      // have been dispatched, or it may have failed to launch or exit cleanly. Skipping it
      // here is how a suite passes while two thirds of it never ran.
      failed = true
      lines.push(`${name}: not run`)
      lines.push(runRecord?.error
        ? `  ${runRecord.error}`
        : `  no transcript at core/tmp/webmcp-eval-${name}.json — the case was never dispatched`)
      continue
    }

    if (runRecord && !runRecord.ok) {
      // The process ran but the agent was crippled — a denied tool, a non-zero exit.
      // Failing here keeps it out of the judged results entirely.
      failed = true
      lines.push(`${name}: invalid run`)
      lines.push(`  ${runRecord.error ?? 'the run did not complete cleanly'}`)
      continue
    }

    const ev = /** @type {any} */(evidence)
    const metrics = ev.metrics ?? {}
    if (!verdict) {
      failed = true
      lines.push(`${name}: not judged`)
    } else {
      const v = /** @type {any} */(verdict)
      if (v.verdict !== 'satisfactory') failed = true
      lines.push(`${name}: ${v.verdict.toUpperCase()}`)
      lines.push(`  ${v.reasoning}`)
    }
    lines.push(`  goal: ${ev.goal}`)
    // The age of the run, so a transcript left over from an earlier session cannot pass
    // itself off as this one's: evidence files persist and are only overwritten when the
    // case actually runs again.
    lines.push(`  started ${ev.startedAt ?? 'unknown'}`)
    lines.push(`  ran ${metrics.toolCalls} calls, read ${metrics.outputBytes} bytes, form valid=${ev.valid}`)
    if (runRecord?.model) {
      lines.push(`  model ${runRecord.model}${runRecord.costUsd != null ? `, $${runRecord.costUsd.toFixed(3)}` : ''}`)
    }

    const friction = /** @type {any} */(verdict)?.friction ?? []
    if (friction.length) {
      lines.push('  friction:')
      for (const point of friction) {
        lines.push(`    [${point.severity}] call ${point.call} ${point.tool}: ${point.observed}`)
        lines.push(`      → ${point.inferred}`)
      }
    }
  }

  return { lines, failed }
}

/**
 * @param {string[]} names
 * @returns {EvalRun[]}
 */
export function loadRuns (names) {
  /** @type {EvalRun[]} */
  const runs = []
  for (const name of names) {
    const evidencePath = join(here, '..', 'tmp', `webmcp-eval-${name}.json`)
    const run = loadRun(name)
    // A requested case with no transcript is reported, never skipped: it is a failure of
    // the run, not an absence of one.
    if (!existsSync(evidencePath)) {
      runs.push({ name, evidence: null, verdict: null, run })
      continue
    }
    const verdictPath = join(here, '..', 'tmp', `webmcp-eval-${name}.verdict.json`)
    runs.push({
      name,
      evidence: JSON.parse(readFileSync(evidencePath, 'utf8')),
      verdict: loadVerdict(verdictPath, name),
      run
    })
  }
  return runs
}

/**
 * Load the provenance sidecar for a case. A sidecar that fails to parse is treated as
 * absent rather than thrown: it is written by a `claude` subprocess that can be killed
 * mid-write, run out of disk, or otherwise leave a truncated file, and that must not
 * abort the report for every other requested case — it should surface as a case with no
 * provenance instead.
 * @param {string} name
 * @returns {object|null}
 */
function loadRun (name) {
  const path = sidecarPath(name)
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

/**
 * Load and validate a verdict file. A verdict that fails `parseVerdict` is treated as
 * absent rather than thrown: a malformed verdict must never read as "no problems
 * found" (that is the whole point of validating it), but it also must not crash the
 * report for every other case — it must surface as "not judged" instead.
 *
 * A verdict naming a different case is treated the same way: one judge answer copied
 * into three verdict files, or a verdict written to the wrong path, would otherwise read
 * as three independent clean judgements.
 * @param {string} verdictPath
 * @param {string} name
 * @returns {object|null}
 */
function loadVerdict (verdictPath, name) {
  if (!existsSync(verdictPath)) return null
  try {
    const verdict = parseVerdict(readFileSync(verdictPath, 'utf8'))
    if (verdict.case !== name) return null
    return verdict
  } catch {
    return null
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const wanted = process.argv.slice(2)
  const { lines, failed } = summarise(loadRuns(wanted.length ? wanted : cases.map((c) => c.name)))
  console.log(lines.join('\n'))
  process.exit(failed ? 1 : 0)
}
