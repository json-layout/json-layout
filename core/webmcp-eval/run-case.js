#!/usr/bin/env node
/**
 * @file Launch one eval case as an isolated `claude -p` subprocess.
 *
 * A subprocess rather than a subagent because the eval's whole purpose is to re-measure
 * after a tool changes. MCP servers connect once per Claude Code session, so an
 * in-session server holds one form state for the session's life and serves the code as
 * it was when the session opened — the very edit that motivates the run is the thing it
 * cannot see. A fresh process gets clean state and a fresh module graph from the OS.
 *
 * Usage: npm run webmcp-eval:run -w core [case ...]
 */

import { spawn as nodeSpawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { cases, getCase } from './cases/index.js'
import { EvalSession, applyVariant, evidenceName } from './session.js'

/** @typedef {import('./cases/types.js').EvalCase} EvalCase */

const here = dirname(fileURLToPath(import.meta.url))

/**
 * Path to the stdio server, absolute so the runner can be launched from a working
 * directory outside this repository.
 */
export const SERVER_PATH = join(here, 'server.js')

/**
 * The one MCP server every case shares. It becomes every tool name the runner sees
 * (mcp__page-form__<tool>), so it carries no evaluation language. The case is selected
 * by environment instead, which the runner cannot read.
 */
export const MCP_SERVER_NAME = 'page-form'

/** Runners silently inherited the orchestrator's model, so verdicts were never comparable. */
export const DEFAULT_MODEL = 'opus'

/**
 * Tool names WebMCP registers when no prefixName is set. Listed explicitly rather than
 * derived from a live session, so the launcher needs no compiled form to run.
 */
export const TOOL_NAMES = [
  'getData',
  'setData',
  'describeState',
  'setFieldValue',
  'getFieldSuggestions',
  'editArray'
]

/**
 * The runner's whole system prompt. It describes an ordinary page visit: no mention of
 * evaluation, no tool names, no goal — the goal arrives as the prompt.
 */
export const RUNNER_PROMPT = `You are assisting a user with a form on the page they are currently viewing.

Use the tools available to you to inspect the form and fill it in according to what the
user asks for. Work carefully: read the form's structure before writing to it, and check
that the values you write were accepted.

If you cannot determine a value from what the tools tell you, say so in your final
answer rather than guessing. When you are done, summarise what you filled in and
anything you could not complete.`

/**
 * @typedef {object} LaunchOptions
 * @property {string} [serverPath] - absolute path to the stdio server
 * @property {string} [model] - model alias or id; defaults to JL_WEBMCP_EVAL_MODEL or DEFAULT_MODEL
 * @property {string} [skill] - the form-filling guide, appended to the runner's prompt
 * @property {string[]} [toolNames] - the tools the session registers, which the variant decides
 */

/**
 * Build the argument vector for one run. Pure, so the isolation guarantee is asserted in
 * a unit test rather than trusted.
 * @param {EvalCase} evalCase
 * @param {LaunchOptions} [options]
 * @returns {string[]}
 */
export function buildLaunchArgs (evalCase, options = {}) {
  const mcpConfig = JSON.stringify({
    mcpServers: {
      [MCP_SERVER_NAME]: {
        type: 'stdio',
        command: 'node',
        args: [options.serverPath ?? SERVER_PATH]
      }
    }
  })
  return [
    '-p', evalCase.goal,
    '--strict-mcp-config',
    '--mcp-config', mcpConfig,
    // No built-in tool exists at all — stronger than omitting them from an allow-list.
    '--tools', '',
    '--allowedTools', (options.toolNames ?? TOOL_NAMES).map((tool) => `mcp__${MCP_SERVER_NAME}__${tool}`).join(','),
    // Drops the SessionStart hook and project settings. Combined with a working
    // directory outside this repository it also drops auto-memory, whose index names
    // this eval and would otherwise tell the runner what it is taking part in.
    '--setting-sources=',
    // The guide is injected, not fetched: production pages hand it to a runner as its
    // prompt through the subagent tool, and a clean agent never calls a tool to get it.
    '--append-system-prompt', options.skill ? `${RUNNER_PROMPT}\n\n${options.skill}` : RUNNER_PROMPT,
    '--model', options.model ?? process.env.JL_WEBMCP_EVAL_MODEL ?? DEFAULT_MODEL,
    // Nothing may block on a prompt nobody can answer; a denial is recorded instead.
    '--permission-prompts', 'none',
    '--output-format', 'json'
  ]
}

/**
 * @typedef {object} RunRecord
 * @property {string} case - the case name that was run
 * @property {boolean} ok - false when the run must not be judged
 * @property {string|null} model - the model actually used, read back from the subprocess
 * @property {string} requestedModel - the alias or id asked for
 * @property {{input: number, output: number, cacheRead: number, cacheWrite: number}|null} tokens - what the run actually consumed
 * @property {number|null} costUsd - total cost reported by the subprocess, in US dollars
 * @property {number|null} turns - number of turns the subprocess took
 * @property {unknown[]} denials - non-empty means the allow-list and tool set have drifted
 * @property {number} exitCode - the subprocess exit code, or -1 when it never launched
 * @property {string} [error] - present when the run failed or must not be judged
 */

/** Where sidecars live in production; a run's own `report.js` reads this same default. */
const DEFAULT_SIDECAR_DIR = join(here, '..', 'tmp')

/**
 * @param {string} name
 * @param {string} [dir] - defaults to the repository's own `tmp/`; tests pass a fresh
 *   `mkdtempSync` directory so a unit run never touches a real recorded eval.
 * @returns {string}
 */
export function sidecarPath (name, dir = DEFAULT_SIDECAR_DIR) {
  return join(dir, `webmcp-eval-${name}.run.json`)
}

/**
 * Run `claude` and collect its output. Replaced in tests.
 * @param {string} command
 * @param {string[]} args
 * @param {{ cwd: string, env: NodeJS.ProcessEnv }} opts
 * @returns {Promise<{ code: number, stdout: string, stderr: string }>}
 */
function defaultSpawn (command, args, opts) {
  return new Promise((resolve, reject) => {
    const child = nodeSpawn(command, args, { cwd: opts.cwd, env: opts.env })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d) => { stdout += d })
    child.stderr.on('data', (d) => { stderr += d })
    child.on('error', reject)
    child.on('close', (code) => resolve({ code: code ?? 0, stdout, stderr }))
  })
}

/**
 * @typedef {object} RunOptions
 * @property {typeof defaultSpawn} [spawn] - replaces the subprocess launcher; tests stub this
 * @property {string} [cwd] - defaults to a fresh directory outside this repository
 * @property {string} [model] - alias or id; defaults to JL_WEBMCP_EVAL_MODEL or DEFAULT_MODEL
 * @property {string} [variant] - tool configuration to run under, see VARIANTS
 * @property {any} [session] - prebuilt session, so a test need not compile a schema
 * @property {string} [sidecarDir] - where to write the run's sidecar; defaults to this
 *   package's own `tmp/`. Tests must pass a fresh `mkdtempSync` directory here, or a unit
 *   run corrupts the sidecar of a real, already-judged eval run.
 */

/**
 * Write the sidecar and return the record. The single exit point for `runCase`, so every
 * outcome — a launch failure, a bad exit code, unparsable output, or a real result — is
 * recorded the same way.
 * @param {string} label
 * @param {RunRecord} record
 * @param {string} sidecarDir
 * @returns {RunRecord}
 */
function finish (label, record, sidecarDir) {
  const path = sidecarPath(label, sidecarDir)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(record, null, 2))
  return record
}

/**
 * @param {EvalCase} evalCase
 * @param {RunOptions} [options]
 * @returns {Promise<RunRecord>}
 */
export async function runCase (evalCase, options = {}) {
  const variant = options.variant
  const variantCase = applyVariant(evalCase, variant)
  // Computed once and handed to every exit: a variant run that wrote its provenance
  // under the plain name would overwrite the control it exists to be compared against.
  const evidenceLabel = evidenceName(evalCase.name, variant)
  const requestedModel = options.model ?? process.env.JL_WEBMCP_EVAL_MODEL ?? DEFAULT_MODEL
  // Outside the repository on purpose: auto-memory is keyed to the project directory,
  // and its index names this eval.
  const cwd = options.cwd ?? mkdtempSync(join(tmpdir(), 'webmcp-eval-'))
  const sidecarDir = options.sidecarDir ?? DEFAULT_SIDECAR_DIR
  const spawnFn = options.spawn ?? defaultSpawn
  // Compiling here costs a second or two but is what lets the runner be handed the same
  // guide and the same tool list the server will register — the pair a page's subagent
  // tool returns. A mismatch would grant a tool the guide never mentions, or the reverse.
  const session = options.session ?? new EvalSession(variantCase)
  const args = buildLaunchArgs(variantCase, {
    model: requestedModel,
    skill: session.skill,
    toolNames: session.toolNames
  })

  /** @type {RunRecord} */
  const record = {
    case: evalCase.name,
    ok: false,
    model: null,
    requestedModel,
    costUsd: null,
    turns: null,
    denials: [],
    exitCode: 0
  }

  /** @type {{ code: number, stdout: string, stderr: string }} */
  let spawnResult
  try {
    spawnResult = await spawnFn('claude', args, {
      cwd,
      env: {
        ...process.env,
        JL_WEBMCP_EVAL_CASE: evalCase.name,
        ...(variant ? { JL_WEBMCP_EVAL_VARIANT: variant } : {})
      }
    })
  } catch (/** @type {any} */err) {
    // The process never launched at all, so there is no exit code and nothing to parse
    // — distinct from every failure below, which happens after a real exit.
    record.exitCode = -1
    record.error = err.code === 'ENOENT'
      ? 'could not launch "claude" — the Claude Code CLI must be on PATH and authenticated'
      : `failed to launch claude: ${err.message}`
    return finish(evidenceLabel, record, sidecarDir)
  }

  const { code, stdout, stderr } = spawnResult
  record.exitCode = code
  if (code !== 0) {
    record.error = `claude exited ${code}: ${stderr.trim() || stdout.trim()}`
    return finish(evidenceLabel, record, sidecarDir)
  }

  /** @type {any} */
  let result
  try {
    result = JSON.parse(stdout)
  } catch (/** @type {any} */err) {
    // claude launched and exited cleanly; only its output is unusable. Keeping the real
    // exit code here (rather than falling into the launch-failure branch above) is the
    // point: this run did not fail to launch, it failed to report.
    record.error = `claude exited 0 but its stdout could not be parsed as JSON: ${err.message}`
    return finish(evidenceLabel, record, sidecarDir)
  }

  // modelUsage is keyed per model touched during the run, in the order each was first
  // used — not necessarily the requested one, if the run ever fell back to a second
  // model. Prefer the entry that actually matches what was requested, and only fall
  // back to whichever came first when nothing matches.
  const usageEntries = Object.entries(/** @type {Record<string, any>} */(result.modelUsage ?? {}))
  const matchedUsage = usageEntries.find(([key, entry]) =>
    key === requestedModel || entry?.canonicalModel === requestedModel || key.includes(requestedModel))
  const usage = (matchedUsage ?? usageEntries[0])?.[1]
  record.model = /** @type {any} */(usage)?.canonicalModel ?? null
  // Kept because output bytes are a poor proxy for what a run costs, and we have argued
  // from them all the same. A tool result is read once as input and then again on every
  // later turn, so what one big response really costs only shows up here.
  const u = /** @type {any} */(usage)
  record.tokens = u
    ? {
        input: u.inputTokens ?? 0,
        output: u.outputTokens ?? 0,
        cacheRead: u.cacheReadInputTokens ?? 0,
        cacheWrite: u.cacheCreationInputTokens ?? 0
      }
    : null
  record.costUsd = result.total_cost_usd ?? null
  record.turns = result.num_turns ?? null
  record.denials = result.permission_denials ?? []
  // A denied tool means the run measured a crippled agent, so it is not judgeable
  // even though the process succeeded.
  record.ok = !result.is_error && record.denials.length === 0
  if (record.denials.length) {
    record.error = `${record.denials.length} tool call(s) denied — the allow-list and the tool set have drifted apart`
  } else if (result.is_error) {
    // is_error with no denials is an agent-side failure unrelated to tool permissions —
    // still a reason the sidecar and the CLI must be able to name.
    record.error = typeof result.result === 'string' && result.result.trim()
      ? result.result
      : 'claude reported is_error without a message'
  }

  return finish(evidenceLabel, record, sidecarDir)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2)
  const variantFlag = argv.find((a) => a.startsWith('--'))
  const variant = variantFlag === '--no-schema' ? 'no-schema' : undefined
  if (variantFlag && !variant) throw new Error(`unknown flag "${variantFlag}", only --no-schema is supported`)
  const wanted = argv.filter((a) => !a.startsWith('--'))
  const selected = wanted.length ? wanted.map(getCase) : cases
  // Each run is its own process with its own server and working directory, so nothing
  // is shared and the cases can go at once. allSettled rather than all: each case's
  // sidecar is already on disk by the time its promise resolves, so one case rejecting
  // outright (an mkdtempSync EACCES, say) must not discard the printed summary for
  // every other case that did complete.
  const settled = await Promise.allSettled(selected.map((evalCase) => runCase(evalCase, { variant })))
  let allOk = true
  settled.forEach((outcome, i) => {
    if (outcome.status === 'fulfilled') {
      const record = outcome.value
      allOk = allOk && record.ok
      const parts = [record.ok ? 'ran' : 'FAILED']
      if (record.model) parts.push(record.model)
      if (record.costUsd != null) parts.push(`$${record.costUsd.toFixed(3)}`)
      if (record.error) parts.push(record.error)
      console.log(`${record.case}: ${parts.join(' — ')}`)
    } else {
      allOk = false
      console.log(`${selected[i].name}: FAILED — ${outcome.reason?.message ?? outcome.reason}`)
    }
  })
  process.exit(allOk ? 0 : 1)
}
