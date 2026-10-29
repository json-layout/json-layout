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
 * Usage: npm run webmcp-eval:run -w core [case ...] [--variant v] [--arm form|session|plain|all] [--runs n]
 */

import { spawn as nodeSpawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { cases, getCase } from './cases/index.js'
import { applyVariant, evidenceName } from './session.js'
import { RUNNER_PROMPT } from './prompts.js'
import { ARMS, createArm, mcpServerName } from './arms.js'

/** @typedef {import('./cases/types.js').EvalCase} EvalCase */

const here = dirname(fileURLToPath(import.meta.url))

/**
 * Path to the stdio server, absolute so the runner can be launched from a working
 * directory outside this repository.
 */
export const SERVER_PATH = join(here, 'server.js')

/**
 * The MCP server the form arm runs under, shared by every case. It becomes every tool name
 * the runner sees (mcp__page-form__<tool>), so it carries no evaluation language. The case
 * is selected by environment instead, which the runner cannot read. The other arms have
 * their own name: see MCP_SERVER_NAMES in arms.js.
 */
export const MCP_SERVER_NAME = mcpServerName('form')

/**
 * Runners silently inherited the orchestrator's model, so verdicts were never comparable.
 *
 * The default is the SMALLEST model on purpose. A protocol that carries a small model
 * carries a large one, and the reverse is not true: what a big model works out for itself
 * is exactly what hides an unstated dependency or an ambiguous message. Measured on six
 * cases, haiku got every one right — including the points the design leaves to inference —
 * and ran the recursive union case in the floor number of calls.
 *
 * It is also what makes the suite affordable enough to run often, which is the real
 * constraint on this harness: $0.25 against $0.84 for the same six cases on opus. Pin a
 * larger tier with JL_WEBMCP_EVAL_MODEL when a finding needs checking against one.
 */
export const DEFAULT_MODEL = 'haiku'

/**
 * Tool names WebMCP registers when no prefixName is set. Listed explicitly rather than
 * derived from a live session, so the launcher needs no compiled form to run.
 */
export const TOOL_NAMES = [
  'getData',
  'setData',
  'describeState',
  'openSection',
  'setFieldValue',
  'getFieldSuggestions',
  'editArray'
]

export { RUNNER_PROMPT }

/**
 * @typedef {object} LaunchOptions
 * @property {string} [serverPath] - absolute path to the stdio server
 * @property {string} [model] - model alias or id; defaults to JL_WEBMCP_EVAL_MODEL or DEFAULT_MODEL
 * @property {string} [prompt] - the arm's full system prompt; defaults to the form runner's bare prompt
 * @property {string[]} [toolNames] - the tools the session registers, which the variant decides
 * @property {string} [arm] - the arm, which names the MCP server; defaults to `form`
 */

/**
 * Build the argument vector for one run. Pure, so the isolation guarantee is asserted in
 * a unit test rather than trusted.
 * @param {EvalCase} evalCase
 * @param {LaunchOptions} [options]
 * @returns {string[]}
 */
export function buildLaunchArgs (evalCase, options = {}) {
  const serverName = mcpServerName(options.arm)
  const mcpConfig = JSON.stringify({
    mcpServers: {
      [serverName]: {
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
    '--allowedTools', (options.toolNames ?? TOOL_NAMES).map((tool) => `mcp__${serverName}__${tool}`).join(','),
    // Drops the SessionStart hook and project settings. Combined with a working
    // directory outside this repository it also drops auto-memory, whose index names
    // this eval and would otherwise tell the runner what it is taking part in.
    '--setting-sources=',
    // The arm's prompt (task and guide) is injected, not fetched: production pages hand it to a runner as its
    // prompt through the subagent tool, and a clean agent never calls a tool to get it.
    '--append-system-prompt', options.prompt ?? RUNNER_PROMPT,
    '--model', options.model ?? process.env.JL_WEBMCP_EVAL_MODEL ?? DEFAULT_MODEL,
    // Nothing may block on a prompt nobody can answer; a denial is recorded instead.
    '--permission-prompts', 'none',
    '--output-format', 'json'
  ]
}

/**
 * @typedef {object} RunRecord
 * @property {string} case - the case name that was run
 * @property {string} arm - the arm it ran under
 * @property {number} [run] - its repeat index, when the case was run more than once
 * @property {boolean} ok - false when the run must not be judged
 * @property {string|null} model - the model actually used, read back from the subprocess
 * @property {string} requestedModel - the alias or id asked for
 * @property {{input: number, output: number, cacheRead: number, cacheWrite: number}|null} tokens - what the run actually consumed
 * @property {number|null} costUsd - total cost reported by the subprocess, in US dollars
 * @property {number|null} turns - number of turns the subprocess took
 * @property {unknown[]} denials - non-empty means the allow-list and tool set have drifted
 * @property {string|null} [answer] - the runner's final reply: the output itself for a case
 *   that asks a question rather than for a change to the form
 * @property {boolean} [notRunnable] - the arm cannot take this case, so nothing was launched
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
    // stdin is held at /dev/null on purpose. `claude -p` reads stdin when anything is
    // piped into it, so an inherited pipe makes it wait and then fail ("no stdin data
    // received in 3s") depending on how the harness itself was launched. Closing it is
    // also part of the isolation: nothing from the orchestrator's standard input may
    // reach the runner.
    const child = nodeSpawn(command, args, { cwd: opts.cwd, env: opts.env, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d) => { stdout += d })
    child.stderr.on('data', (d) => { stderr += d })
    child.on('error', reject)
    child.on('close', (code) => resolve({ code: code ?? 0, stdout, stderr }))
  })
}

/**
 * The environment of the runner, which its server child inherits. Selection variables the
 * parent happens to carry (an earlier `JL_WEBMCP_EVAL_ARM=plain` exported in the shell, say)
 * are removed first: a default run would otherwise serve the stale arm under the form
 * arm's name and tool list.
 * @param {string} caseName
 * @param {string|undefined} variant
 * @param {string} arm
 * @param {number|undefined} run
 * @returns {NodeJS.ProcessEnv}
 */
export function serverEnv (caseName, variant, arm, run) {
  /** @type {NodeJS.ProcessEnv} */
  const env = { ...process.env, JL_WEBMCP_EVAL_CASE: caseName }
  delete env.JL_WEBMCP_EVAL_ARM
  delete env.JL_WEBMCP_EVAL_VARIANT
  delete env.JL_WEBMCP_EVAL_RUN
  if (variant) env.JL_WEBMCP_EVAL_VARIANT = variant
  if (arm !== 'form') env.JL_WEBMCP_EVAL_ARM = arm
  if (run !== undefined) env.JL_WEBMCP_EVAL_RUN = String(run)
  return env
}

/**
 * @typedef {object} RunOptions
 * @property {typeof defaultSpawn} [spawn] - replaces the subprocess launcher; tests stub this
 * @property {string} [cwd] - defaults to a fresh directory outside this repository
 * @property {string} [model] - alias or id; defaults to JL_WEBMCP_EVAL_MODEL or DEFAULT_MODEL
 * @property {string} [variant] - tool configuration to run under, see VARIANTS
 * @property {string} [arm] - tool surface to run under, see ARMS; defaults to `form`
 * @property {number} [run] - repeat index; names the evidence `.r<run>` so repeats never collide
 * @property {any} [session] - prebuilt arm, so a test need not compile a schema
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
  const arm = options.arm ?? 'form'
  const evidenceLabel = evidenceName(evalCase.name, variant, arm, options.run)
  const requestedModel = options.model ?? process.env.JL_WEBMCP_EVAL_MODEL ?? DEFAULT_MODEL
  // Outside the repository on purpose: auto-memory is keyed to the project directory,
  // and its index names this eval.
  const cwd = options.cwd ?? mkdtempSync(join(tmpdir(), 'webmcp-eval-'))
  const sidecarDir = options.sidecarDir ?? DEFAULT_SIDECAR_DIR
  const spawnFn = options.spawn ?? defaultSpawn
  // Compiling here costs a second or two but is what lets the runner be handed the same
  // guide and the same tool list the server will register — the pair a page's subagent
  // tool returns. A mismatch would grant a tool the guide never mentions, or the reverse.
  const session = options.session ?? await createArm(variantCase, arm)

  /** @type {RunRecord} */
  const record = {
    case: evalCase.name,
    arm,
    ...(options.run !== undefined ? { run: options.run } : {}),
    ok: false,
    model: null,
    requestedModel,
    costUsd: null,
    turns: null,
    denials: [],
    exitCode: 0
  }

  // An arm that cannot take this case has nothing to measure: record why and spawn nothing.
  if (session.runnable === false) {
    record.notRunnable = true
    record.error = session.notRunnableReason ?? 'this arm cannot run this case'
    return finish(evidenceLabel, record, sidecarDir)
  }

  const args = buildLaunchArgs(variantCase, {
    arm,
    model: requestedModel,
    prompt: session.prompt,
    toolNames: session.toolNames
  })

  /** @type {{ code: number, stdout: string, stderr: string }} */
  let spawnResult
  try {
    spawnResult = await spawnFn('claude', args, {
      cwd,
      env: serverEnv(evalCase.name, variant, arm, options.run)
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
  record.answer = typeof result.result === 'string' ? result.result : null
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

/**
 * Most runner subprocesses alive at once. Each is a full `claude` process with its own
 * server; more than this trips rate limits and starves the machine, and the cases are
 * independent so a queue costs only wall-clock time. Fixed, not configurable.
 */
export const MAX_CONCURRENT_RUNS = 6

/**
 * Run tasks with at most `limit` in flight, settling like Promise.allSettled and
 * preserving the order of `tasks` in the result.
 * @template T
 * @param {Array<() => Promise<T>>} tasks
 * @param {number} limit
 * @returns {Promise<PromiseSettledResult<T>[]>}
 */
export async function runPool (tasks, limit) {
  /** @type {PromiseSettledResult<T>[]} */
  const results = new Array(tasks.length)
  let next = 0
  const worker = async () => {
    while (next < tasks.length) {
      const i = next++
      try {
        results[i] = { status: 'fulfilled', value: await tasks[i]() }
      } catch (reason) {
        results[i] = { status: 'rejected', reason }
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker))
  return results
}

/**
 * @param {string[]} argv
 * @returns {{ variant?: string, arms: string[], runs: number, names: string[] }}
 */
export function parseCliArgs (argv) {
  /** @type {Record<string, string>} */
  const values = {}
  /** @type {string[]} */
  const names = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (['--variant', '--arm', '--runs'].includes(a)) {
      if (!argv[i + 1]) throw new Error(`${a} needs a value`)
      values[a] = argv[++i]
    } else if (!a.startsWith('--')) names.push(a)
  }
  const armValue = values['--arm'] ?? 'form'
  const arms = armValue === 'all' ? [...ARMS] : [armValue]
  for (const a of arms) {
    if (!ARMS.includes(a)) throw new Error(`unknown arm "${a}", available: ${ARMS.join(', ')}, all`)
  }
  const runs = values['--runs'] === undefined ? 1 : Number(values['--runs'])
  if (!Number.isInteger(runs) || runs < 1) throw new Error('--runs needs a positive integer')
  return { variant: values['--variant'], arms, runs, names }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { variant, arms, runs, names } = parseCliArgs(process.argv.slice(2))
  const selected = names.length ? names.map(getCase) : cases
  /** @type {Array<{ label: string, task: () => Promise<RunRecord> }>} */
  const jobs = []
  for (const evalCase of selected) {
    for (const arm of arms) {
      for (let r = 1; r <= runs; r++) {
        const run = runs > 1 ? r : undefined
        jobs.push({
          label: evidenceName(evalCase.name, variant, arm, run),
          task: () => runCase(evalCase, { variant, arm, run })
        })
      }
    }
  }
  // Each run is its own process with its own server and working directory, so nothing
  // is shared and the runs can go at once, up to the cap. Settled rather than all: each
  // sidecar is already on disk by the time its promise resolves, so one run rejecting
  // outright (an mkdtempSync EACCES, say) must not discard the summary of the others.
  const settled = await runPool(jobs.map((j) => j.task), MAX_CONCURRENT_RUNS)
  let allOk = true
  settled.forEach((outcome, i) => {
    if (outcome.status === 'fulfilled') {
      const record = outcome.value
      if (record.notRunnable) {
        console.log(`${jobs[i].label}: not runnable — ${record.error}`)
        return
      }
      allOk = allOk && record.ok
      const parts = [record.ok ? 'ran' : 'FAILED']
      if (record.model) parts.push(record.model)
      if (record.costUsd != null) parts.push(`$${record.costUsd.toFixed(3)}`)
      if (record.error) parts.push(record.error)
      console.log(`${jobs[i].label}: ${parts.join(' — ')}`)
    } else {
      allOk = false
      console.log(`${jobs[i].label}: FAILED — ${outcome.reason?.message ?? outcome.reason}`)
    }
  })
  process.exit(allOk ? 0 : 1)
}
