#!/usr/bin/env node
/**
 * @file Summarise judged eval runs.
 *
 * Deliberately has no thresholds. The old scorer failed a run whose call count exceeded
 * a number someone guessed; here the numbers are printed as context and the verdict is
 * the judge's. An unjudged run counts as a failure — a transcript nobody read is not
 * evidence of anything.
 *
 * Usage: npm run webmcp-eval:report -w core [case ...]
 */

import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { cases } from './cases/index.js'
import { parseVerdict } from './verdict.js'

const here = dirname(fileURLToPath(import.meta.url))

/**
 * @param {Array<{ evidence: object, verdict: object|null }>} runs
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

  for (const { evidence, verdict } of runs) {
    const ev = /** @type {any} */(evidence)
    const metrics = ev.metrics ?? {}
    lines.push('')
    if (!verdict) {
      failed = true
      lines.push(`${ev.case}: not judged`)
    } else {
      const v = /** @type {any} */(verdict)
      if (v.verdict !== 'satisfactory') failed = true
      lines.push(`${ev.case}: ${v.verdict.toUpperCase()}`)
      lines.push(`  ${v.reasoning}`)
    }
    lines.push(`  goal: ${ev.goal}`)
    lines.push(`  ran ${metrics.toolCalls} calls, read ${metrics.outputBytes} bytes, form valid=${ev.valid}`)

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
 * @returns {Array<{ evidence: object, verdict: object|null }>}
 */
export function loadRuns (names) {
  /** @type {Array<{ evidence: object, verdict: object|null }>} */
  const runs = []
  for (const name of names) {
    const evidencePath = join(here, '..', 'tmp', `webmcp-eval-${name}.json`)
    if (!existsSync(evidencePath)) continue
    const verdictPath = join(here, '..', 'tmp', `webmcp-eval-${name}.verdict.json`)
    runs.push({
      evidence: JSON.parse(readFileSync(evidencePath, 'utf8')),
      verdict: loadVerdict(verdictPath)
    })
  }
  return runs
}

/**
 * Load and validate a verdict file. A verdict that fails `parseVerdict` is treated as
 * absent rather than thrown: a malformed verdict must never read as "no problems
 * found" (that is the whole point of validating it), but it also must not crash the
 * report for every other case — it must surface as "not judged" instead.
 * @param {string} verdictPath
 * @returns {object|null}
 */
function loadVerdict (verdictPath) {
  if (!existsSync(verdictPath)) return null
  try {
    return parseVerdict(readFileSync(verdictPath, 'utf8'))
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
