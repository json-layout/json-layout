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
 * Usage: npm run webmcp-eval:report -w core [case ...] [--arm form|session|plain|all]
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { cases } from './cases/index.js'
import { evidenceName, parseEvidenceName } from './session.js'
import { ARMS, callKind, TRUNCATION_BYTES } from './arms.js'
import { parseVerdict } from './verdict.js'
import { sidecarPath } from './run-case.js'

const here = dirname(fileURLToPath(import.meta.url))

/**
 * @typedef {object} EvalRun
 * @property {string} name - the case this run was requested for
 * @property {string} [variant] - tool configuration it ran under, absent for the default
 * @property {string} [arm] - tool surface it ran through, `form` when absent
 * @property {number} [runIndex] - repeat number when the case was run more than once
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

  for (const { name, variant, arm, runIndex, evidence, verdict, run } of runs) {
    const parts = [variant, arm && arm !== 'form' ? arm : undefined, runIndex !== undefined ? `r${runIndex}` : undefined].filter(Boolean)
    const label = parts.length ? `${name} (${parts.join(', ')})` : name
    lines.push('')
    const runRecord = /** @type {any} */(run)
    if (!evidence && runRecord?.notRunnable) {
      // An arm that cannot take this case is an answer, not a failure of the run.
      lines.push(`${label}: not runnable — ${runRecord.error ?? 'no reason recorded'}`)
      continue
    }
    if (!evidence) {
      // A missing transcript is a case whose subprocess never produced one — it may never
      // have been dispatched, or it may have failed to launch or exit cleanly. Skipping it
      // here is how a suite passes while two thirds of it never ran.
      failed = true
      lines.push(`${label}: not run`)
      lines.push(runRecord?.error
        ? `  ${runRecord.error}`
        : `  no transcript at core/tmp/webmcp-eval-${evidenceName(name, variant, arm, runIndex)}.json — the case was never dispatched`)
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
    const failedChecks = (Array.isArray(ev.checks) ? ev.checks : []).filter((/** @type {any} */ c) => !c.ok)
    if (failedChecks.length) failed = true
    if (!verdict) {
      failed = true
      lines.push(`${label}: not judged`)
    } else {
      const v = /** @type {any} */(verdict)
      if (v.verdict !== 'satisfactory') failed = true
      const headCheck = v.verdict === 'satisfactory' ? failedChecks[0] : undefined
      lines.push(`${label}: ${v.verdict.toUpperCase()}${headCheck ? `, CHECK FAILED: ${headCheck.label} — ${headCheck.detail}` : ''}`)
      lines.push(`  ${v.reasoning}`)
    }
    for (const c of failedChecks.slice(!verdict || /** @type {any} */(verdict).verdict !== 'satisfactory' ? 0 : 1)) {
      lines.push(`  CHECK FAILED: ${c.label} — ${c.detail}`)
    }
    lines.push(`  goal: ${ev.goal}`)
    // The age of the run, so a transcript left over from an earlier session cannot pass
    // itself off as this one's: evidence files persist and are only overwritten when the
    // case actually runs again.
    lines.push(`  started ${ev.startedAt ?? 'unknown'}`)
    lines.push(`  ran ${metrics.toolCalls} calls, read ${metrics.outputBytes} bytes, form valid=${ev.valid}`)
    if (runRecord?.model) {
      lines.push(`  model ${runRecord.model}${runRecord.costUsd != null ? `, $${runRecord.costUsd.toFixed(3)}` : ''}`)
      // Printed next to the byte count on purpose. Output bytes are what a tool answers
      // with; these are what the run was billed for, and the two have pointed in opposite
      // directions often enough today to be worth seeing side by side.
      const tk = runRecord.tokens
      if (tk) lines.push(`  tokens in ${tk.input + tk.cacheRead + tk.cacheWrite} (${tk.cacheRead} cached), out ${tk.output}`)
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

  lines.push(...compare(runs))
  return { lines, failed }
}

/**
 * @param {number[]} values
 * @param {(n: number) => string} [fmt]
 * @returns {string}
 */
function range (values, fmt = String) {
  if (!values.length) return 'n/a'
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  return lo === hi ? fmt(lo) : `${fmt(lo)}–${fmt(hi)}`
}

const KINDS = ['read-state', 'read-schema', 'write', 'lookup', 'other']

/**
 * Per kind of call, over the runs of one arm: calls, output bytes and failed calls, then
 * the count of oversized answers. Kinds no run called are left out.
 * @param {string} arm
 * @param {any[]} evs
 * @returns {string[]}
 */
function breakdown (arm, evs) {
  const perRun = evs.map((e) => /** @type {any[]} */(Array.isArray(e.calls) ? e.calls : []))
  /** @type {string[]} */
  const out = []
  for (const kind of KINDS) {
    const mine = perRun.map((calls) => calls.filter((c) => callKind(arm, c.tool) === kind))
    if (!mine.some((c) => c.length)) continue
    out.push(`    ${kind}: ${range(mine.map((c) => c.length))} calls, ` +
      `${range(mine.map((c) => c.reduce((n, x) => n + (x.outputBytes ?? 0), 0)))} bytes, ` +
      `${range(mine.map((c) => c.filter((x) => x.isError).length))} failed`)
  }
  if (perRun.some((calls) => calls.length)) {
    out.push(`    oversized: ${range(perRun.map((calls) => calls.filter((c) => (c.outputBytes ?? 0) > TRUNCATION_BYTES).length))}`)
  }
  return out
}

/**
 * Side-by-side rows, one per arm of each case, over the runs that left a transcript.
 * Context only: nothing here decides the report.
 * @param {EvalRun[]} runs
 * @returns {string[]}
 */
function compare (runs) {
  /** @type {string[]} */
  const out = []
  const names = [...new Set(runs.map((r) => r.name))]
  for (const name of names) {
    const mine = runs.filter((r) => r.name === name && r.evidence && !(/** @type {any} */(r.run) && !(/** @type {any} */(r.run).ok)))
    if (!mine.length) continue
    /** @type {Map<string, EvalRun[]>} */
    const groups = new Map()
    for (const r of mine) {
      const arm = r.arm ?? /** @type {any} */(r.evidence).arm ?? 'form'
      const key = r.variant ? `${arm} (${r.variant})` : arm
      groups.set(key, [...(groups.get(key) ?? []), r])
    }
    out.push('', `${name} — comparison`)
    for (const [key, group] of groups) {
      const evs = group.map((r) => /** @type {any} */(r.evidence))
      const recs = group.map((r) => /** @type {any} */(r.run)).filter(Boolean)
      const tokens = recs.map((r) => r.tokens).filter(Boolean).map((t) => (t.input ?? 0) + (t.cacheRead ?? 0) + (t.cacheWrite ?? 0))
      const costs = recs.map((r) => r.costUsd).filter((c) => c != null)
      const checks = evs.map((e) => Array.isArray(e.checks) ? `${e.checks.filter((/** @type {any} */ c) => c.ok).length}/${e.checks.length}` : 'n/a')
      const verdicts = group.map((r) => /** @type {any} */(r.verdict)?.verdict)
      const unjudged = verdicts.filter((v) => !v).length
      out.push(`  ${key}: ${group.length} run${group.length === 1 ? '' : 's'}, ` +
        `${range(evs.map((e) => e.metrics?.toolCalls ?? 0))} calls, ` +
        `${range(evs.map((e) => e.metrics?.outputBytes ?? 0))} bytes, ` +
        `${range(tokens)} input tokens, ` +
        `${range(costs, (n) => `$${n.toFixed(3)}`)} cost, ` +
        `checks ${checks.join(', ')}, ` +
        `${verdicts.filter((v) => v === 'satisfactory').length}s/${verdicts.filter((v) => v === 'unsatisfactory').length}u` +
        (unjudged ? `, ${unjudged} unjudged` : ''))
      const armName = group[0].arm ?? evs[0].arm ?? 'form'
      const tk = (/** @type {string} */ f) => range(recs.filter((r) => r.tokens).map((r) => r.tokens[f] ?? 0))
      if (recs.some((r) => r.tokens)) {
        out.push(`    uncached input ${tk('input')}, cache reads ${tk('cacheRead')}, cache writes ${tk('cacheWrite')}`)
      }
      out.push(...breakdown(armName, evs))
    }
    out.push('  cost is priced with caching; parallel runs share a cache, so a run\'s cost depends on which ran first')
    out.push(`  oversized = calls answering more than ${TRUNCATION_BYTES} bytes (Claude Code caps MCP output near 25k tokens, so the agent probably saw a cut answer)`)
    out.push('  input tokens = input + cacheRead + cacheWrite (what the model actually read)')
  }
  return out
}

/**
 * Every combination of variant, arm and repeat that left evidence or a sidecar behind for
 * a case, found by parsing the file names back with `parseEvidenceName`. A comparison run
 * writes `webmcp-eval-<case>[--<variant>][--<arm>][.r<n>].json` beside the control, so all
 * of them get reported rather than one silently standing in for the others.
 * @param {string} name
 * @returns {{ variant: string|undefined, arm: string, run: number|undefined }[]}
 */
function combinationsOf (name) {
  const dir = join(here, '..', 'tmp')
  if (!existsSync(dir)) return []
  const prefix = `webmcp-eval-${name}`
  /** @type {Map<string, { variant: string|undefined, arm: string, run: number|undefined }>} */
  const found = new Map()
  for (const file of readdirSync(dir)) {
    if (!file.startsWith(prefix) || file.endsWith('.verdict.json') || file.endsWith('.schema.json') || file.endsWith('.judge.json')) continue
    const label = file.endsWith('.run.json')
      ? file.slice('webmcp-eval-'.length, -'.run.json'.length)
      : file.endsWith('.json') ? file.slice('webmcp-eval-'.length, -'.json'.length) : null
    const parsed = label && parseEvidenceName(label, name)
    if (parsed) found.set(evidenceName(name, parsed.variant, parsed.arm, parsed.run), parsed)
  }
  return [...found.values()].sort((a, b) => (a.variant ?? '').localeCompare(b.variant ?? '') || a.arm.localeCompare(b.arm) || (a.run ?? 0) - (b.run ?? 0))
}

/**
 * @param {string[]} names
 * @param {string} [arm] - `form`, `session`, `plain` or `all` (the default). The control
 *   entry of every selected arm is expected; with `all`, only the form arm is expected
 *   when it left nothing behind, and another arm is expected once it left any file for
 *   the case. Naming an arm expects it unconditionally.
 * @returns {EvalRun[]}
 */
export function loadRuns (names, arm = 'all') {
  /** @type {EvalRun[]} */
  const runs = []
  for (const name of names) {
    const all = combinationsOf(name)
    const selected = arm === 'all' ? [...ARMS] : [arm]
    const combos = all.filter((c) => selected.includes(c.arm))
    // A requested case with no control transcript or sidecar is reported, never skipped:
    // it is a failure of the run, not an absence of one. An ablation nobody ran is not.
    for (const a of [...selected].reverse()) {
      const expected = arm !== 'all' || a === 'form' || all.some((c) => c.arm === a)
      if (expected && !combos.some((c) => !c.variant && c.arm === a)) combos.unshift({ variant: undefined, arm: a, run: undefined })
    }
    for (const { variant, arm: runArm, run: runIndex } of combos) {
      const label = evidenceName(name, variant, runArm, runIndex)
      const evidencePath = join(here, '..', 'tmp', `webmcp-eval-${label}.json`)
      const run = loadRun(label, name)
      const base = { name, variant, arm: runArm, runIndex }
      if (!existsSync(evidencePath)) {
        runs.push({ ...base, evidence: null, verdict: null, run })
        continue
      }
      const verdictPath = join(here, '..', 'tmp', `webmcp-eval-${label}.verdict.json`)
      runs.push({
        ...base,
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
 * @param {string} label - evidence basename, which carries the variant suffix
 * @param {string} caseName - the case, which is what the sidecar records
 * @returns {object|null}
 */
function loadRun (label, caseName) {
  const path = sidecarPath(label)
  if (!existsSync(path)) return null
  try {
    const run = /** @type {any} */(JSON.parse(readFileSync(path, 'utf8')))
    // Checked against the case, not the file's label: a variant's sidecar is named
    // `<case>--<variant>` but records the case it ran, so comparing it to the label
    // would discard the provenance of every variant run.
    if (run.case !== caseName) return null
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
  const argv = process.argv.slice(2)
  const at = argv.indexOf('--arm')
  const arm = at >= 0 ? argv[at + 1] : 'all'
  if (at >= 0) argv.splice(at, 2)
  if (arm !== 'all' && !ARMS.includes(arm)) throw new Error(`unknown arm "${arm}", available: ${ARMS.join(', ')}, all`)
  const wanted = argv
  const { lines, failed } = summarise(loadRuns(wanted.length ? wanted : cases.map((c) => c.name), arm))
  console.log(lines.join('\n'))
  process.exit(failed ? 1 : 0)
}
