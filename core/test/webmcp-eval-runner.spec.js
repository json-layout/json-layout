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
})
