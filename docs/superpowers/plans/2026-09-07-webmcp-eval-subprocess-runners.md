# WebMCP Eval Subprocess Runners Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the eval's in-session subagent runners with headless `claude -p` subprocesses, so any case can be re-run at any time against the current code without starting a new Claude Code session.

**Architecture:** One MCP server definition instead of three, selected per launch by the `JL_WEBMCP_EVAL_CASE` environment variable that the `claude` subprocess passes down to its stdio server child. Each run gets a fresh OS process, and therefore clean form state and a freshly imported `core/src/**`. A launcher module owns the launch arguments as a pure function so the isolation guarantee stays unit-testable.

**Tech Stack:** Node 20+ ESM, JSDoc types checked by `tsc`, `node:test`, `node:child_process`. No new runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-09-07-webmcp-eval-subprocess-runners-design.md`

## Global Constraints

- **No new dependencies.** `@json-layout/core` deliberately has almost none; use `node:` builtins only.
- **Code style is neostandard**: two-space indent, no semicolons, space before the parameter list in declarations (`function buildLaunchArgs (evalCase, options)`). `npm run lint` enforces it.
- **Every export carries JSDoc types.** `npm run build -w core` runs `tsc` and must pass.
- **Verification command is `npm run quality`** (lint, build, test) from the repository root. Tests are `node --test test/*.spec.js` inside `core`.
- **The MCP server name is `page-form`.** It appears in every tool name the runner sees (`mcp__page-form__<tool>`), so it must never carry evaluation language.
- **The runner's prompt is the case's `goal` string and nothing else.**
- **Default model is `opus`**, overridable by `JL_WEBMCP_EVAL_MODEL`.
- **Transcript paths are unchanged:** `core/tmp/webmcp-eval-<case>.json`, written by `server.js`. The launcher never writes them.
- **Observed against Claude Code 2.1.263.** The flags `--tools`, `--setting-sources`, `--permission-prompts`, `--strict-mcp-config` and `--mcp-config` are CLI surface used exactly as probed.
- **No test may invoke `claude`.** A judged run costs money and stays a deliberate act.

---

### Task 1: The launcher module and its isolation contract

Replaces `generate-config.js`, which exists only to write `.mcp.json` and agent definitions — neither of which survives. Its two still-needed exports move here.

**Files:**
- Create: `core/webmcp-eval/run-case.js`
- Delete: `core/webmcp-eval/generate-config.js`
- Rename + rewrite: `core/test/webmcp-eval-config.spec.js` → `core/test/webmcp-eval-runner.spec.js`
- Modify: `core/test/webmcp-eval.spec.js:10` and `:134` (import path and stale message)

**Interfaces:**
- Produces: `TOOL_NAMES: string[]`, `RUNNER_PROMPT: string`, `MCP_SERVER_NAME: 'page-form'`, `DEFAULT_MODEL: 'opus'`, `buildLaunchArgs(evalCase, options): string[]` where `options` is `{ serverPath: string, model?: string }`.
- Consumes: `cases`, `getCase` from `./cases/index.js`.

**Critical detail — what the leak check may and may not cover.** The `--mcp-config` value contains the absolute path to `core/webmcp-eval/server.js`, whose directory name contains the word "eval". That string is never placed in the model's context: the runner sees tool *names*, not the server's command line. So the leak assertions run against the strings the model can actually read — `MCP_SERVER_NAME`, `TOOL_NAMES`, `RUNNER_PROMPT` — and not over every argv token. A test that scans all arguments will fail confusingly and is wrong.

**Second critical detail.** Do not assert "no argument contains the case name". The `contact` case's goal is *"Fill in the contact form for Ada Lovelace…"* — the name legitimately occurs inside the goal. Assert instead that no argument *other than the goal* contains it.

- [ ] **Step 1: Write the failing spec**

Create `core/test/webmcp-eval-runner.spec.js`:

```js
import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'

import { cases, getCase } from '../webmcp-eval/cases/index.js'
import { buildLaunchArgs, MCP_SERVER_NAME, RUNNER_PROMPT, TOOL_NAMES } from '../webmcp-eval/run-case.js'

const options = { serverPath: '/abs/path/core/webmcp-eval/server.js' }

/**
 * @param {string[]} args
 * @param {string} name
 * @returns {string}
 */
function optionValue (args, name) {
  const i = args.indexOf(name)
  assert.ok(i !== -1, `missing ${name}`)
  return args[i + 1]
}

/**
 * The isolation guarantee. It used to live in generated agent frontmatter; it now lives
 * in these arguments, and it is stronger: --tools "" means no built-in tool exists at
 * all, rather than merely not being listed.
 */
describe('webmcp eval runner launch arguments', () => {
  it('should pass the goal as the prompt and nothing else', () => {
    // -p is a boolean flag; the prompt is a positional argument, so it must be the very
    // next token. Asserting the position is the point — an option-value lookup would
    // pass here by coincidence and stop protecting anything if the order changed.
    for (const evalCase of cases) {
      const args = buildLaunchArgs(evalCase, options)
      assert.equal(args[0], '-p')
      assert.equal(args[1], evalCase.goal)
    }
  })

  it('should grant exactly the page-form tools and no built-in tool', () => {
    // A positive allow-list check: an emptied TOOL_NAMES must fail here, not pass vacuously.
    assert.ok(TOOL_NAMES.length >= 8, 'TOOL_NAMES must not be emptied out, or this check is vacuous')
    const args = buildLaunchArgs(getCase('contact'), options)
    const allowed = optionValue(args, '--allowedTools').split(',')
    assert.deepEqual(allowed, TOOL_NAMES.map((t) => `mcp__${MCP_SERVER_NAME}__${t}`))
    // --tools "" removes every built-in tool. The empty string is the whole point, so
    // assert it explicitly rather than just asserting the flag is present.
    assert.equal(optionValue(args, '--tools'), '')
    for (const forbidden of ['Read', 'Grep', 'Bash', 'Write', 'Edit', 'WebFetch', 'WebSearch', 'Glob']) {
      assert.ok(!allowed.includes(forbidden), `must not grant ${forbidden}`)
    }
  })

  it('should isolate the runner from this repository and from other MCP servers', () => {
    const args = buildLaunchArgs(getCase('contact'), options)
    assert.ok(args.includes('--strict-mcp-config'), 'no other MCP server may be reachable')
    // Auto-memory is keyed to the project directory and its index names this eval, so
    // both of these are load-bearing, not hygiene.
    assert.ok(args.includes('--setting-sources='), 'user, project and local settings must be ignored')
    assert.equal(optionValue(args, '--permission-prompts'), 'none')
  })

  it('should declare one MCP server, named without evaluation language', () => {
    const args = buildLaunchArgs(getCase('contact'), options)
    const config = JSON.parse(optionValue(args, '--mcp-config'))
    assert.deepEqual(Object.keys(config.mcpServers), [MCP_SERVER_NAME])
    assert.deepEqual(config.mcpServers[MCP_SERVER_NAME].args, [options.serverPath])
  })

  it('should not tell the runner it is being evaluated', () => {
    // Only the strings the model can actually read. The --mcp-config path contains
    // "webmcp-eval" but never enters the model's context: the runner sees tool names,
    // not the server's command line.
    const visible = [MCP_SERVER_NAME, RUNNER_PROMPT, ...TOOL_NAMES]
    assert.ok(RUNNER_PROMPT.trim().length > 0, 'an empty prompt would make this check vacuous')
    for (const text of visible) {
      for (const leak of ['eval', 'judge', 'benchmark', 'score']) {
        assert.ok(!text.toLowerCase().includes(leak), `"${text}" leaks "${leak}"`)
      }
    }
  })

  it('should not name the case anywhere except inside its own goal', () => {
    // The case is selected by environment, never by an argument the runner could read.
    // contact's goal legitimately contains "contact", so the goal itself is exempt.
    for (const evalCase of cases) {
      for (const arg of buildLaunchArgs(evalCase, options)) {
        if (arg === evalCase.goal) continue
        assert.ok(!arg.includes(evalCase.name), `argument "${arg}" names the case`)
      }
    }
  })

  it('should pin the model so runs stay comparable', () => {
    const args = buildLaunchArgs(getCase('contact'), { ...options, model: 'sonnet' })
    assert.equal(optionValue(args, '--model'), 'sonnet')
    assert.equal(optionValue(args, '--output-format'), 'json')
  })
})
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npm test -w core 2>&1 | tail -20`
Expected: FAIL — `Cannot find module '../webmcp-eval/run-case.js'`.

- [ ] **Step 3: Create the launcher module**

Create `core/webmcp-eval/run-case.js`. Copy `TOOL_NAMES` and `RUNNER_PROMPT` **verbatim** from `generate-config.js` (lines 41–50 and 56–64) — changing that prompt changes what the eval measures.

```js
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

import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

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
  'fillFormSkill',
  'getData',
  'setData',
  'describeState',
  'setFieldValue',
  'getFieldSuggestions',
  'editArray',
  'getSchema'
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
    '--allowedTools', TOOL_NAMES.map((tool) => `mcp__${MCP_SERVER_NAME}__${tool}`).join(','),
    // Drops the SessionStart hook and project settings. Combined with a working
    // directory outside this repository it also drops auto-memory, whose index names
    // this eval and would otherwise tell the runner what it is taking part in.
    '--setting-sources=',
    '--append-system-prompt', RUNNER_PROMPT,
    '--model', options.model ?? process.env.JL_WEBMCP_EVAL_MODEL ?? DEFAULT_MODEL,
    // Nothing may block on a prompt nobody can answer; a denial is recorded instead.
    '--permission-prompts', 'none',
    '--output-format', 'json'
  ]
}
```

- [ ] **Step 4: Run the spec to verify it passes**

Run: `npm test -w core 2>&1 | tail -20`
Expected: the new file's tests PASS; `webmcp-eval.spec.js` still FAILS on its import of the deleted module (fixed next step).

- [ ] **Step 5: Retire the generator**

```bash
git rm core/webmcp-eval/generate-config.js core/test/webmcp-eval-config.spec.js
```

In `core/test/webmcp-eval.spec.js`, change line 10 to import from the launcher:

```js
import { TOOL_NAMES } from '../webmcp-eval/run-case.js'
```

and update the stale assertion message on line 134 (the script it names no longer exists):

```js
    assert.deepEqual(names, [...TOOL_NAMES].sort(), 'TOOL_NAMES must match the tools a session registers — update TOOL_NAMES in run-case.js')
```

- [ ] **Step 6: Verify the whole suite**

Run: `npm run quality 2>&1 | tail -15`
Expected: lint, build and all tests pass.

- [ ] **Step 7: Commit**

```bash
git add core/webmcp-eval/run-case.js core/test/webmcp-eval-runner.spec.js core/test/webmcp-eval.spec.js
git commit -m "feat(core): build eval runner launch arguments as a pure function"
```

---

### Task 2: The launcher CLI

**Files:**
- Modify: `core/webmcp-eval/run-case.js`
- Modify: `core/test/webmcp-eval-runner.spec.js`
- Modify: `core/package.json` (scripts)

**Interfaces:**
- Consumes: `buildLaunchArgs`, `SERVER_PATH`, `DEFAULT_MODEL` from Task 1.
- Produces: `runCase(evalCase, options): Promise<RunRecord>` where `RunRecord` is `{ case: string, ok: boolean, model: string|null, requestedModel: string, costUsd: number|null, turns: number|null, denials: string[], exitCode: number, error?: string }`; `sidecarPath(name): string`.
- `options` is `{ spawn?: SpawnFn, cwd?: string, model?: string }`; `SpawnFn` is `(command: string, args: string[], opts: { cwd: string, env: Record<string,string|undefined> }) => Promise<{ code: number, stdout: string, stderr: string }>`.

**Why a sidecar file.** `server.js` owns `core/tmp/webmcp-eval-<case>.json` and rewrites it on every call. The launcher must not touch it or the two writers race. Provenance goes to `core/tmp/webmcp-eval-<case>.run.json`, which the skill's existing `rm -f core/tmp/webmcp-eval-*` already clears.

**Resolved model, not requested model.** `--model opus` is an alias. The subprocess's JSON output carries `modelUsage`, keyed by the model actually used, each entry holding `canonicalModel`. Record that, so a verdict says which model produced it.

- [ ] **Step 1: Write the failing tests**

Append to `core/test/webmcp-eval-runner.spec.js`:

```js
import { runCase } from '../webmcp-eval/run-case.js'

/**
 * @param {object} overrides
 * @returns {string}
 */
function claudeOutput (overrides = {}) {
  return JSON.stringify({
    is_error: false,
    num_turns: 4,
    total_cost_usd: 0.12,
    permission_denials: [],
    modelUsage: { 'claude-opus-5[1m]': { canonicalModel: 'claude-opus-5' } },
    result: 'done',
    ...overrides
  })
}

describe('webmcp eval runner execution', () => {
  it('should select the case by environment, never by an argument', async () => {
    /** @type {any} */
    let seen
    const spawn = async (/** @type {string} */ cmd, /** @type {string[]} */ args, /** @type {any} */ opts) => {
      seen = { cmd, args, opts }
      return { code: 0, stdout: claudeOutput(), stderr: '' }
    }
    await runCase(getCase('calendar'), { spawn })
    assert.equal(seen.cmd, 'claude')
    assert.equal(seen.opts.env.JL_WEBMCP_EVAL_CASE, 'calendar')
  })

  it('should run from a working directory outside this repository', async () => {
    // Auto-memory is keyed to the project directory; running from inside the repo hands
    // the runner an index naming this eval.
    /** @type {any} */
    let seen
    const spawn = async (/** @type {string} */ _c, /** @type {string[]} */ _a, /** @type {any} */ opts) => {
      seen = opts
      return { code: 0, stdout: claudeOutput(), stderr: '' }
    }
    await runCase(getCase('contact'), { spawn })
    const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
    assert.ok(!seen.cwd.startsWith(repoRoot), `cwd ${seen.cwd} must be outside ${repoRoot}`)
  })

  it('should record the resolved model rather than the requested alias', async () => {
    const spawn = async () => ({ code: 0, stdout: claudeOutput(), stderr: '' })
    const record = await runCase(getCase('contact'), { spawn, model: 'opus' })
    assert.equal(record.requestedModel, 'opus')
    assert.equal(record.model, 'claude-opus-5')
    assert.equal(record.costUsd, 0.12)
    assert.equal(record.turns, 4)
    assert.ok(record.ok)
  })

  it('should fail a run whose tools were denied', async () => {
    // A denial means the allow-list and the tool set have drifted apart, so the run
    // measured a crippled agent. Judging it would be worse than not running it.
    const spawn = async () => ({ code: 0, stdout: claudeOutput({ permission_denials: [{ tool_name: 'mcp__page-form__editArray' }] }), stderr: '' })
    const record = await runCase(getCase('contact'), { spawn })
    assert.equal(record.ok, false)
    assert.equal(record.denials.length, 1)
  })

  it('should surface a non-zero exit rather than swallow it', async () => {
    const spawn = async () => ({ code: 1, stdout: '', stderr: 'boom' })
    const record = await runCase(getCase('contact'), { spawn })
    assert.equal(record.ok, false)
    assert.equal(record.exitCode, 1)
    assert.match(record.error ?? '', /boom/)
  })

  it('should say plainly when the claude CLI is missing', async () => {
    const spawn = async () => { const err = new Error('spawn claude ENOENT'); throw Object.assign(err, { code: 'ENOENT' }) }
    const record = await runCase(getCase('contact'), { spawn })
    assert.equal(record.ok, false)
    assert.match(record.error ?? '', /claude/)
    assert.match(record.error ?? '', /PATH/)
  })
})
```

Add the imports this block needs at the top of the file: `import { dirname, join } from 'node:path'` and `import { fileURLToPath } from 'node:url'`.

- [ ] **Step 2: Run to verify failure**

Run: `npm test -w core 2>&1 | tail -20`
Expected: FAIL — `runCase` is not exported.

- [ ] **Step 3: Implement `runCase` and the CLI**

Append to `core/webmcp-eval/run-case.js`:

```js
import { spawn as nodeSpawn } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'

import { cases, getCase } from './cases/index.js'

/**
 * @typedef {object} RunRecord
 * @property {string} case
 * @property {boolean} ok - false when the run must not be judged
 * @property {string|null} model - the model actually used, read back from the subprocess
 * @property {string} requestedModel - the alias or id asked for
 * @property {number|null} costUsd
 * @property {number|null} turns
 * @property {unknown[]} denials - non-empty means the allow-list and tool set have drifted
 * @property {number} exitCode
 * @property {string} [error]
 */

/**
 * @param {string} name
 * @returns {string}
 */
export function sidecarPath (name) {
  return join(here, '..', 'tmp', `webmcp-eval-${name}.run.json`)
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
 * @property {typeof defaultSpawn} [spawn]
 * @property {string} [cwd] - defaults to a fresh directory outside this repository
 * @property {string} [model]
 */

/**
 * @param {EvalCase} evalCase
 * @param {RunOptions} [options]
 * @returns {Promise<RunRecord>}
 */
export async function runCase (evalCase, options = {}) {
  const requestedModel = options.model ?? process.env.JL_WEBMCP_EVAL_MODEL ?? DEFAULT_MODEL
  // Outside the repository on purpose: auto-memory is keyed to the project directory,
  // and its index names this eval.
  const cwd = options.cwd ?? mkdtempSync(join(tmpdir(), 'webmcp-eval-'))
  const spawnFn = options.spawn ?? defaultSpawn
  const args = buildLaunchArgs(evalCase, { model: requestedModel })

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

  try {
    const { code, stdout, stderr } = await spawnFn('claude', args, {
      cwd,
      env: { ...process.env, JL_WEBMCP_EVAL_CASE: evalCase.name }
    })
    record.exitCode = code
    if (code !== 0) {
      record.error = `claude exited ${code}: ${stderr.trim() || stdout.trim()}`
    } else {
      const result = JSON.parse(stdout)
      const usage = Object.values(result.modelUsage ?? {})[0]
      record.model = /** @type {any} */(usage)?.canonicalModel ?? null
      record.costUsd = result.total_cost_usd ?? null
      record.turns = result.num_turns ?? null
      record.denials = result.permission_denials ?? []
      // A denied tool means the run measured a crippled agent, so it is not judgeable
      // even though the process succeeded.
      record.ok = !result.is_error && record.denials.length === 0
      if (record.denials.length) record.error = `${record.denials.length} tool call(s) denied — the allow-list and the tool set have drifted apart`
    }
  } catch (/** @type {any} */err) {
    record.exitCode = -1
    record.error = err.code === 'ENOENT'
      ? 'could not launch "claude" — the Claude Code CLI must be on PATH and authenticated'
      : `failed to launch claude: ${err.message}`
  }

  mkdirSync(dirname(sidecarPath(evalCase.name)), { recursive: true })
  writeFileSync(sidecarPath(evalCase.name), JSON.stringify(record, null, 2))
  return record
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const wanted = process.argv.slice(2)
  const selected = wanted.length ? wanted.map(getCase) : cases
  // Each run is its own process with its own server and working directory, so nothing
  // is shared and the cases can go at once.
  const records = await Promise.all(selected.map((evalCase) => runCase(evalCase)))
  for (const record of records) {
    console.log(`${record.case}: ${record.ok ? 'ran' : 'FAILED'}${record.model ? ` (${record.model}` : ''}${record.costUsd != null ? `, $${record.costUsd.toFixed(3)})` : record.model ? ')' : ''}${record.error ? ` — ${record.error}` : ''}`)
  }
  process.exit(records.every((r) => r.ok) ? 0 : 1)
}
```

Merge every `import` in this block into the import section at the top of the file — `node:child_process`, `node:fs`, `node:os` and `./cases/index.js`. `dirname`, `join` and `fileURLToPath` are already imported by Task 1; do not duplicate them, and do not leave import statements in the middle of the file (ESLint will reject it).

- [ ] **Step 4: Run the tests**

Run: `npm test -w core 2>&1 | tail -20`
Expected: PASS.

- [ ] **Step 5: Add the npm script**

In `core/package.json`, replace the `webmcp-eval:config` line with:

```json
    "webmcp-eval:run": "node webmcp-eval/run-case.js",
```

- [ ] **Step 6: Verify the CLI reports a missing case usefully**

Run: `npm run webmcp-eval:run -w core -- nosuchcase 2>&1 | tail -3`
Expected: an error naming the available cases (`contact, calendar, charts`), from `getCase`. It must not spawn anything.

- [ ] **Step 7: Commit**

```bash
git add core/webmcp-eval/run-case.js core/test/webmcp-eval-runner.spec.js core/package.json
git commit -m "feat(core): run each eval case as an isolated claude subprocess"
```

---

### Task 3: Report the model, the cost, and unjudgeable runs

**Files:**
- Modify: `core/webmcp-eval/report.js`
- Modify: `core/test/webmcp-eval-report.spec.js` (this file already exists and already tests `summarise`; reuse its `run()` helper rather than writing a second one)

**Interfaces:**
- Consumes: `sidecarPath` from Task 2, and the sidecar's `RunRecord` shape.
- Produces: `EvalRun` gains an **optional** `run` field: `{ name, evidence, verdict, run? }` where `run` is `RunRecord|null`. It must stay optional — the existing tests in this file construct entries without it, and transcripts recorded before this change have no sidecar.

**Precedence rule:** a failed run outranks a verdict. If the sidecar says `ok: false`, the case reports `invalid run` and fails the report even if a verdict file exists — a transcript from a crippled agent must not be judged into a pass.

- [ ] **Step 1: Write the failing tests**

Append to `core/test/webmcp-eval-report.spec.js`, reusing the `run()` helper defined at the top of that file:

```js
describe('webmcp eval run provenance', () => {
  it('should print the model that produced the run', () => {
    const entry = { ...run('contact', 'satisfactory'), run: { case: 'contact', ok: true, model: 'claude-opus-5', costUsd: 0.42, denials: [] } }
    const { lines, failed } = summarise([entry])
    assert.equal(failed, false)
    assert.ok(lines.some((l) => l.includes('claude-opus-5')), 'the model must appear')
    assert.ok(lines.some((l) => l.includes('0.42')), 'the cost must appear')
  })

  it('should fail an invalid run even when a verdict exists', () => {
    // A denied tool means the run measured a crippled agent. Judging that transcript
    // would report a protocol failure that is really a harness failure.
    const entry = { ...run('contact', 'satisfactory'), run: { case: 'contact', ok: false, model: null, costUsd: null, denials: [{}], error: 'denied' } }
    const { lines, failed } = summarise([entry])
    assert.equal(failed, true, 'a crippled run must not be judged into a pass')
    assert.ok(lines.some((l) => l.includes('invalid run')))
  })

  it('should still judge a transcript that has no sidecar', () => {
    // Transcripts predating this change carry no provenance; they must still report.
    const { failed } = summarise([run('contact', 'satisfactory')])
    assert.equal(failed, false)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -w core 2>&1 | tail -20`
Expected: FAIL — no `invalid run` line, model absent. The third test passes already; that is the point of including it.

- [ ] **Step 3: Implement**

In `core/webmcp-eval/report.js`, import the sidecar path from the launcher rather than rebuilding it:

```js
import { sidecarPath } from './run-case.js'
```

Extend the `EvalRun` typedef with `@property {object|null} [run] - provenance written by the launcher, absent for transcripts recorded before it existed`.

Insert the invalid-run branch in `summarise` immediately after the `if (!evidence)` block:

```js
    const runRecord = /** @type {any} */(run)
    if (runRecord && !runRecord.ok) {
      // The process ran but the agent was crippled — a denied tool, a non-zero exit.
      // Failing here keeps it out of the judged results entirely.
      failed = true
      lines.push(`${name}: invalid run`)
      lines.push(`  ${runRecord.error ?? 'the run did not complete cleanly'}`)
      continue
    }
```

Destructure `run` alongside `name, evidence, verdict` in the `for` loop header.

Add the provenance line directly after the existing `ran N calls…` line:

```js
    if (runRecord?.model) {
      lines.push(`  model ${runRecord.model}${runRecord.costUsd != null ? `, $${runRecord.costUsd.toFixed(3)}` : ''}`)
    }
```

In `loadRuns`, read the sidecar next to the transcript and include it in both pushed objects (the `evidence: null` early return too, so the shape stays uniform):

```js
    const run = existsSync(sidecarPath(name)) ? JSON.parse(readFileSync(sidecarPath(name), 'utf8')) : null
```

- [ ] **Step 4: Run tests**

Run: `npm test -w core 2>&1 | tail -20`
Expected: PASS, including the pre-existing `summarise` tests that pass no `run` field.

- [ ] **Step 5: Verify against the real transcripts on disk**

Run: `npm run webmcp-eval:report -w core 2>&1 | head -20`
Expected: the three existing cases still report SATISFACTORY with no model line (they predate sidecars), exit 0.

- [ ] **Step 6: Commit**

```bash
git add core/webmcp-eval/report.js core/test/webmcp-eval-report.spec.js
git commit -m "feat(core): record which model produced an eval run, and refuse to judge crippled runs"
```

---

### Task 4: Remove the per-case session wiring

Do this only after Tasks 1–3 pass: it deletes the old path entirely.

**Files:**
- Delete: `.mcp.json`
- Delete: `.claude/agents/page-form-runner-contact.md`, `-calendar.md`, `-charts.md`
- Modify: `.claude/settings.local.json`

- [ ] **Step 1: Delete the generated wiring**

```bash
git rm .mcp.json .claude/agents/page-form-runner-contact.md .claude/agents/page-form-runner-calendar.md .claude/agents/page-form-runner-charts.md
```

`.mcp.json` goes entirely: the three `page-form-*` servers are its only contents, and with them gone every contributor session in this repository stops launching three idle node processes.

- [ ] **Step 2: Drop the enabled-server list**

Remove the whole `enabledMcpjsonServers` key from `.claude/settings.local.json`, leaving the `permissions` block untouched. The file must remain valid JSON:

```bash
node -e "const f='.claude/settings.local.json';const s=JSON.parse(require('fs').readFileSync(f,'utf8'));delete s.enabledMcpjsonServers;require('fs').writeFileSync(f,JSON.stringify(s,null,2)+'\n')"
node -e "JSON.parse(require('fs').readFileSync('.claude/settings.local.json','utf8'));console.log('valid json')"
```

- [ ] **Step 3: Confirm nothing still references the deleted wiring**

Run: `grep -rn 'page-form-contact\|page-form-calendar\|page-form-charts\|enabledMcpjsonServers\|webmcp-eval:config' --include='*.js' --include='*.json' --include='*.md' . | grep -v node_modules | grep -v docs/superpowers`
Expected: no hits outside `docs/superpowers/` (the historical spec and plan legitimately describe the old design).

- [ ] **Step 4: Full verification**

Run: `npm run quality 2>&1 | tail -15`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add -A .mcp.json .claude
git commit -m "chore: stop starting three eval MCP servers in every session"
```

---

### Task 5: Rewrite the skill and the README

**Files:**
- Rewrite: `.claude/skills/webmcp-eval/SKILL.md`
- Rewrite: `core/webmcp-eval/README.md` (the "Judged runs" section, lines ~77–122, and the reporting table)

- [ ] **Step 1: Rewrite the skill's procedure**

`SKILL.md` loses its two most awkward instructions — the "Before you start" check for `mcp__page-form-*` tools, and the rule that each case runs once per session. Both were consequences of session-bound servers. The new steps:

1. Read the case list from `core/webmcp-eval/cases/index.js` (unchanged).
2. `rm -f core/tmp/webmcp-eval-*` (unchanged, and now also clears the `.run.json` sidecars).
3. `npm run webmcp-eval:run -w core` for every case, or `-- charts calendar` for a subset. Cases run concurrently; each is a separate `claude` subprocess.
4. Ignore what the run prints. The transcript at `core/tmp/webmcp-eval-<case>.json` is the evidence (unchanged).
5. Dispatch one `webmcp-eval-judge` subagent per case, giving paths not pasted content (unchanged).
6. Write each verdict to `core/tmp/webmcp-eval-<case>.verdict.json` (unchanged).
7. `npm run webmcp-eval:report -w core` (unchanged).

Replace the "If something goes wrong" entries:

- **"A runner says it has no tools"** → delete. The frontmatter risk it describes no longer exists; tools come from `--allowedTools`.
- Add **"A case reports `invalid run`"**: the subprocess exited non-zero, or a tool call was denied. Check the sidecar `core/tmp/webmcp-eval-<case>.run.json`. A denial means `TOOL_NAMES` in `run-case.js` and the tools a session registers have drifted apart — `core/test/webmcp-eval.spec.js` asserts they match, so run the suite.
- Add **"`could not launch claude`"**: the CLI must be on `PATH` and authenticated.
- Keep **"A case reports `not run`"** and **"not judged"** as they are.

Add a short note that a run's model is pinned by `JL_WEBMCP_EVAL_MODEL` (default `opus`) and recorded in the report, so verdicts from different models are not compared silently.

- [ ] **Step 2: Rewrite the README's "Judged runs" section**

Replace points 1–4 (the `.mcp.json`-per-case description, the three-idle-processes trade, and the once-per-session limit) with the subprocess model. It must state:

- one MCP server definition, passed inline via `--mcp-config`, selected per launch by `JL_WEBMCP_EVAL_CASE`, which `claude` passes to its stdio child;
- the runner has no built-in tools at all (`--tools ""`) and no other MCP server (`--strict-mcp-config`);
- it runs from a directory outside the repository with `--setting-sources=`, because auto-memory is keyed to the project directory and **its index names this eval**, so a runner launched from the repository can read that it is being evaluated;
- a case may be re-run any number of times, and a run always reflects the current `core/src` and case registry;
- the residual ~3.5k tokens of generic Claude Code boilerplate are deliberate: removing them would require replacing the whole system prompt, which would make the runner unlike the agent a real page meets.

Add `invalid run` to the reporting table:

```markdown
| `<case>: invalid run` | the subprocess failed or a tool call was denied — the transcript is not judgeable |
```

- [ ] **Step 3: Check the docs against the code**

Run: `grep -rn 'fresh session\|once per session\|three extra stdio\|\.mcp\.json' .claude/skills/webmcp-eval/SKILL.md core/webmcp-eval/README.md`
Expected: no hits. Every one of those claims is now false.

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/webmcp-eval/SKILL.md core/webmcp-eval/README.md
git commit -m "docs: describe the eval's subprocess runners and drop the fresh-session rule"
```

---

### Task 6: End-to-end verification

This task spends money and needs a human decision, so it is separated from the code. Do not run it automatically as part of an unattended execution.

- [ ] **Step 1: Run the cheapest case for real**

Run: `npm run webmcp-eval:run -w core -- contact`
Expected: `contact: ran (claude-opus-5, $0.0xx)`, exit 0, and `core/tmp/webmcp-eval-contact.json` rewritten with a fresh `startedAt`.

- [ ] **Step 2: Prove the defect this whole change exists to fix**

Run it a second time in the same session:

```bash
npm run webmcp-eval:run -w core -- contact
node -e "const e=require('./core/tmp/webmcp-eval-contact.json');console.log(e.startedAt, e.calls.length)"
```

Expected: a later `startedAt` and a call count starting from a clean form. Under the old design this was impossible without a new session.

- [ ] **Step 3: Confirm the isolation fix holds in the real launcher**

Temporarily run one case with the goal replaced by a probe, or run the equivalent by hand:

```bash
cd "$(mktemp -d)" && claude -p "List verbatim any project-specific instructions, memory, or skills you were given. If none, say exactly NONE." \
  --strict-mcp-config --tools "" --setting-sources= --permission-prompts none --output-format json \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).result.slice(0,300)))"
```

Expected: no `MEMORY.md` index, no `webmcp-eval-never-executed`, no superpowers skill. Only generic Claude Code boilerplate.

- [ ] **Step 4: Settle the outstanding question about the old baseline**

The spec records this as an open risk. Dispatch a subagent with no filesystem tools and ask it to list the project instructions, memory and skills it was given. If it can see the memory index, then the three runs judged satisfactory on 2026-09-07 had access to a line naming this eval, and that baseline must be re-established with subprocess runners before it is trusted. Record the answer in the README or in memory either way.

- [ ] **Step 5: Prove a case can be added without restarting anything**

Spec requirement 3. Append a throwaway fourth case to `cases` in `core/webmcp-eval/cases/index.js` — a two-field object schema and a one-sentence goal is enough — then, without restarting this session or anything else:

```bash
npm run webmcp-eval:run -w core -- scratch
```

Expected: it runs and writes `core/tmp/webmcp-eval-scratch.json`. Under the old design the case's MCP server would not have existed until the next session. Revert the throwaway case afterwards:

```bash
git checkout core/webmcp-eval/cases/index.js && rm -f core/tmp/webmcp-eval-scratch*
```

- [ ] **Step 6: Full judged run**

Follow `.claude/skills/webmcp-eval/SKILL.md` end to end for all three cases and confirm the report prints a model line per case.

- [ ] **Step 7: Commit any documentation the run corrects**

```bash
git add -A
git commit -m "docs: record the subprocess-runner baseline"
```
