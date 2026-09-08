import { strict as assert } from 'node:assert'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

import { cases, getCase } from '../webmcp-eval/cases/index.js'
import { buildLaunchArgs, DEFAULT_MODEL, MCP_SERVER_NAME, RUNNER_PROMPT, TOOL_NAMES, runCase, sidecarPath } from '../webmcp-eval/run-case.js'
import { applyVariant, evidenceName } from '../webmcp-eval/session.js'

/**
 * A fresh directory per test, so a stubbed run never writes into this package's own
 * `tmp/` and cannot corrupt the sidecar of a real, already-judged eval run.
 * @returns {string}
 */
function tmpSidecarDir () {
  return mkdtempSync(join(tmpdir(), 'webmcp-eval-sidecar-'))
}

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
    assert.ok(TOOL_NAMES.length >= 6, 'TOOL_NAMES must not be emptied out, or this check is vacuous')
    const args = buildLaunchArgs(getCase('contact'), options)
    const allowed = optionValue(args, '--allowedTools').split(',')
    assert.deepEqual(allowed, TOOL_NAMES.map((t) => `mcp__${MCP_SERVER_NAME}__${t}`))
    // --tools "" removes every built-in tool. The empty string is the whole point, so
    // assert it explicitly rather than just asserting the flag is present.
    assert.equal(optionValue(args, '--tools'), '')
    // Checked against the whole argument vector, not just `allowed`: `allowed` is by
    // construction a list of mcp__page-form__* strings, so a bare tool name could never
    // be an element of it and this loop would pass whether or not the guarantee held.
    // Scanning `args` also catches a forbidden tool leaking in through an added
    // --add-dir or --permission-mode bypassPermissions, which nothing above would.
    for (const forbidden of ['Read', 'Grep', 'Bash', 'Write', 'Edit', 'WebFetch', 'WebSearch', 'Glob']) {
      assert.ok(!args.includes(forbidden), `must not grant ${forbidden}`)
    }
    assert.ok(!args.includes('--add-dir'), 'must not grant access to another directory')
    assert.ok(!args.includes('--permission-mode'), 'must not switch to a mode that could bypass permission prompts')
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
      for (const leak of ['eval', 'judge', 'benchmark', 'test', 'score']) {
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

  it('should actually deliver the runner prompt via --append-system-prompt', () => {
    // Deleting this argument pair — losing the whole "you are helping a user with a
    // form on this page" framing that makes a run resemble a page visit — would leave
    // every other test in this file green, because they only inspect RUNNER_PROMPT's
    // content, never whether it is ever passed to claude.
    const args = buildLaunchArgs(getCase('contact'), options)
    assert.equal(optionValue(args, '--append-system-prompt'), RUNNER_PROMPT)
  })

  it('should default to DEFAULT_MODEL when nothing else pins the model', () => {
    const previous = process.env.JL_WEBMCP_EVAL_MODEL
    delete process.env.JL_WEBMCP_EVAL_MODEL
    try {
      const args = buildLaunchArgs(getCase('contact'), options)
      assert.equal(optionValue(args, '--model'), DEFAULT_MODEL)
    } finally {
      if (previous === undefined) delete process.env.JL_WEBMCP_EVAL_MODEL
      else process.env.JL_WEBMCP_EVAL_MODEL = previous
    }
  })
})

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
    await runCase(getCase('calendar'), { spawn, sidecarDir: tmpSidecarDir() })
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
    await runCase(getCase('contact'), { spawn, sidecarDir: tmpSidecarDir() })
    const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
    assert.ok(!seen.cwd.startsWith(repoRoot), `cwd ${seen.cwd} must be outside ${repoRoot}`)
  })

  it('should record the resolved model rather than the requested alias', async () => {
    const spawn = async () => ({ code: 0, stdout: claudeOutput(), stderr: '' })
    const record = await runCase(getCase('contact'), { spawn, model: 'opus', sidecarDir: tmpSidecarDir() })
    assert.equal(record.requestedModel, 'opus')
    assert.equal(record.model, 'claude-opus-5')
    assert.equal(record.costUsd, 0.12)
    assert.equal(record.turns, 4)
    assert.ok(record.ok)
  })

  it('should prefer the modelUsage entry matching the requested model over the first-inserted one', async () => {
    // modelUsage is keyed per model touched during the run, in whatever order each was
    // first used — not necessarily the requested one. Object.values(...)[0] would read
    // opus's entry here just because it happened to be inserted first, even though the
    // run was requested and reported against sonnet.
    const spawn = async () => ({
      code: 0,
      stdout: claudeOutput({
        modelUsage: {
          'claude-opus-5[1m]': { canonicalModel: 'claude-opus-5' },
          'claude-sonnet-5[1m]': { canonicalModel: 'claude-sonnet-5' }
        }
      }),
      stderr: ''
    })
    const record = await runCase(getCase('contact'), { spawn, model: 'sonnet', sidecarDir: tmpSidecarDir() })
    assert.equal(record.requestedModel, 'sonnet')
    assert.equal(record.model, 'claude-sonnet-5')
  })

  it('should fall back to the first modelUsage entry when none matches the requested model', async () => {
    const spawn = async () => ({
      code: 0,
      stdout: claudeOutput({
        modelUsage: {
          'claude-haiku-5[1m]': { canonicalModel: 'claude-haiku-5' }
        }
      }),
      stderr: ''
    })
    const record = await runCase(getCase('contact'), { spawn, model: 'opus', sidecarDir: tmpSidecarDir() })
    assert.equal(record.model, 'claude-haiku-5')
  })

  it('should fail a run whose tools were denied', async () => {
    // A denial means the allow-list and the tool set have drifted apart, so the run
    // measured a crippled agent. Judging it would be worse than not running it.
    const spawn = async () => ({ code: 0, stdout: claudeOutput({ permission_denials: [{ tool_name: 'mcp__page-form__editArray' }] }), stderr: '' })
    const record = await runCase(getCase('contact'), { spawn, sidecarDir: tmpSidecarDir() })
    assert.equal(record.ok, false)
    assert.equal(record.denials.length, 1)
  })

  it('should name a variant run so it cannot stand in for its control', () => {
    // There is no second variant to run since getSchema went, so this can no longer be
    // exercised end to end. What it guarded is still worth pinning: a variant's evidence
    // must not overwrite the run it exists to be compared against, and an unknown variant
    // must be refused rather than silently treated as the control.
    assert.equal(evidenceName('contact'), 'contact')
    assert.equal(evidenceName('contact', 'default'), 'contact')
    assert.equal(evidenceName('contact', 'guideless'), 'contact--guideless')
    assert.throws(() => applyVariant(getCase('contact'), 'no-schema'), /unknown variant/)
  })

  it('should surface a non-zero exit rather than swallow it', async () => {
    const spawn = async () => ({ code: 1, stdout: '', stderr: 'boom' })
    const record = await runCase(getCase('contact'), { spawn, sidecarDir: tmpSidecarDir() })
    assert.equal(record.ok, false)
    assert.equal(record.exitCode, 1)
    assert.match(record.error ?? '', /boom/)
  })

  it('should say plainly when the claude CLI is missing', async () => {
    const spawn = async () => { const err = new Error('spawn claude ENOENT'); throw Object.assign(err, { code: 'ENOENT' }) }
    const record = await runCase(getCase('contact'), { spawn, sidecarDir: tmpSidecarDir() })
    assert.equal(record.ok, false)
    assert.match(record.error ?? '', /claude/)
    assert.match(record.error ?? '', /PATH/)
  })

  it('should keep the real exit code when a clean exit prints unparsable stdout', async () => {
    // claude launched and exited 0 here — only its output is bad. Overwriting exitCode
    // and reporting a launch failure would actively lie about what happened.
    const spawn = async () => ({ code: 0, stdout: 'not json', stderr: '' })
    const record = await runCase(getCase('contact'), { spawn, sidecarDir: tmpSidecarDir() })
    assert.equal(record.ok, false)
    assert.equal(record.exitCode, 0)
    assert.match(record.error ?? '', /pars/i)
  })

  it('should explain an agent-side failure that carries no denials', async () => {
    // is_error with an empty denials list is a real, distinct scenario: something went
    // wrong on the agent's side that has nothing to do with the allow-list.
    const spawn = async () => ({ code: 0, stdout: claudeOutput({ is_error: true, permission_denials: [] }), stderr: '' })
    const record = await runCase(getCase('contact'), { spawn, sidecarDir: tmpSidecarDir() })
    assert.equal(record.ok, false)
    assert.equal(record.denials.length, 0)
    assert.ok(record.error && record.error.length > 0, 'error must not be empty')
  })

  it('should write the sidecar to disk with the resolved model and ok flag', async () => {
    const spawn = async () => ({ code: 0, stdout: claudeOutput(), stderr: '' })
    const sidecarDir = tmpSidecarDir()
    const record = await runCase(getCase('contact'), { spawn, sidecarDir })
    const written = JSON.parse(readFileSync(sidecarPath('contact', sidecarDir), 'utf8'))
    assert.equal(written.model, record.model)
    assert.equal(written.ok, record.ok)
    assert.equal(written.ok, true)
  })
})

describe('webmcp eval case selection', () => {
  it('should reject an unknown case name before any subprocess starts', () => {
    // The CLI resolves every requested name through getCase before calling runCase, so
    // a typo fails synchronously and cheaply instead of spending a subprocess launch to
    // discover it.
    assert.throws(
      () => getCase('does-not-exist'),
      /unknown eval case "does-not-exist"/
    )
    for (const evalCase of cases) {
      assert.throws(() => getCase('does-not-exist'), new RegExp(evalCase.name), 'error must name the available cases')
    }
  })
})
