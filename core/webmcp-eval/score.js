#!/usr/bin/env node
/**
 * @file Print the score of an agent-driven run recorded by server.js.
 *
 * Usage: node core/webmcp-eval/score.js [case ...]   (default: every case with a transcript)
 */

import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { cases } from './cases/index.js'

const here = dirname(fileURLToPath(import.meta.url))
const wanted = process.argv.slice(2)
const names = wanted.length ? wanted : cases.map((c) => c.name)

let failed = false
let found = 0

for (const name of names) {
  const path = join(here, '..', 'tmp', `webmcp-eval-${name}.json`)
  if (!existsSync(path)) {
    if (wanted.length) {
      console.error(`no transcript for "${name}" — run the agent against JL_WEBMCP_EVAL_CASE=${name} first`)
      failed = true
    }
    continue
  }
  found++
  const run = JSON.parse(readFileSync(path, 'utf8'))
  const { passed, checks } = run.score
  console.log(`\neval case "${name}": ${passed ? 'PASS' : 'FAIL'}`)
  console.log(`  goal: ${run.goal}`)
  for (const check of checks) {
    console.log(`  ${check.passed ? 'ok  ' : 'FAIL'} ${check.name}: ${check.detail}`)
  }
  console.log(`  calls: ${run.calls.map((/** @type {any} */ c) => c.tool).join(' → ') || '(none)'}`)
  if (!passed) failed = true
}

if (!found) {
  console.error('no transcripts found — see core/webmcp-eval/README.md for how to run an agent against a case')
  process.exit(1)
}
process.exit(failed ? 1 : 0)
