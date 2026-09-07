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

import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { cases } from './cases/index.js'
import { evidenceName } from './session.js'
import { parseVerdict } from './verdict.js'
import { sidecarPath } from './run-case.js'

const here = dirname(fileURLToPath(import.meta.url))

/**
 * @typedef {object} EvalRun
 * @property {string} name - the case this run was requested for
 * @property {string} [variant] - tool configuration it ran under, absent for the default
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

  for (const { name, variant, evidence, verdict, run } of runs) {
    const label = variant ? `${name} (${variant})` : name
    lines.push('')
    const runRecord = /** @type {any} */(run)
    if (!evidence) {
      // A missing transcript is a case whose subprocess never produced one — it may never
      // have been dispatched, or it may have failed to launch or exit cleanly. Skipping it
      // here is how a suite passes while two thirds of it never ran.
      failed = true
      lines.push(`${label}: not run`)
      lines.push(runRecord?.error
        ? `  ${runRecord.error}`
        : `  no transcript at core/tmp/webmcp-eval-${evidenceName(name, variant)}.json — the case was never dispatched`)
      continue
    }

    if (runRecord && !runRecord.ok) {
      // The process ran but the agent was crippled — a denied tool, a non-zero exit.
      // Failing here keeps it out of the judged results entirely.
      failed = true
      lines.push(`${label}: invalid run`)
      lines.push(`  ${runRecord.error ?? 'the run did not complete cleanly'}`)
      continue
    }

    const ev = /** @type {any} */(evidence)
    const metrics = ev.metrics ?? {}
    if (!verdict) {
      failed = true
      lines.push(`${label}: not judged`)
    } else {
      const v = /** @type {any} */(verdict)
      if (v.verdict !== 'satisfactory') failed = true
      lines.push(`${label}: ${v.verdict.toUpperCase()}`)
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
 * Every variant of a case that left evidence behind, the default first. A comparison run
 * writes `webmcp-eval-<case>--<variant>.json` beside the control, so both get reported
 * rather than one silently standing in for the other.
 * @param {string} name
 * @returns {(string|undefined)[]}
 */
function variantsOf (name) {
  const dir = join(here, '..', 'tmp')
  if (!existsSync(dir)) return [undefined]
  const pattern = new RegExp(`^webmcp-eval-${name}--(.+)\\.json$`)
  const found = readdirSync(dir)
    .map((file) => pattern.exec(file)?.[1])
    .filter((v) => !!v && !v.endsWith('.verdict') && !v.endsWith('.run'))
  return [undefined, ...new Set(found)]
}

/**
 * @param {string[]} names
 * @returns {EvalRun[]}
 */
export function loadRuns (names) {
  /** @type {EvalRun[]} */
  const runs = []
  for (const name of names) {
    for (const variant of variantsOf(name)) {
      const label = evidenceName(name, variant)
      const evidencePath = join(here, '..', 'tmp', `webmcp-eval-${label}.json`)
      const run = loadRun(label)
      // A requested case with no transcript is reported, never skipped: it is a failure
      // of the run, not an absence of one. Only the default is required to exist though
      // — an ablation nobody ran is not a failure.
      if (!existsSync(evidencePath)) {
        if (!variant) runs.push({ name, variant, evidence: null, verdict: null, run })
        continue
      }
      const verdictPath = join(here, '..', 'tmp', `webmcp-eval-${label}.verdict.json`)
      runs.push({
        name,
        variant,
        evidence: JSON.parse(readFileSync(evidencePath, 'utf8')),
        verdict: loadVerdict(verdictPath, name),
        run
      })
    }
  }
  return runs
}

/**
 * Load the provenance sidecar for a case.
 *
 * A missing file is genuinely absent — a transcript recorded before sidecars existed —
 * and is treated as "no provenance, judge normally" by returning null.
 *
 * A file that exists but fails to parse is a different situation: it is written by a
 * `claude` subprocess that can be killed mid-write or run out of disk, leaving a
 * truncated file next to a possibly-truncated transcript. Reading that the same as
 * "absent" would let a killed run's transcript be judged as if nothing had gone wrong.
 * It must still not abort the report for every other requested case, so it is returned
 * as a synthetic invalid record instead of thrown — `summarise` already reports any
 * record with `ok: false` as an invalid run.
 *
 * A file that parses but names a different case is treated the same as absent, exactly
 * like `loadVerdict` below: a sidecar written for another case, or copied to the wrong
 * path, must not be read as this case's provenance.
 * @param {string} name
 * @returns {object|null}
 */
function loadRun (name) {
  const path = sidecarPath(name)
  if (!existsSync(path)) return null
  try {
    const run = /** @type {any} */(JSON.parse(readFileSync(path, 'utf8')))
    if (run.case !== name) return null
    return run
  } catch (/** @type {any} */err) {
    return { ok: false, error: `sidecar unreadable: ${err.message}` }
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
