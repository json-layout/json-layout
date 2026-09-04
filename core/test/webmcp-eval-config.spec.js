import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'

import { cases } from '../webmcp-eval/cases/index.js'
import { buildConfig, TOOL_NAMES } from '../webmcp-eval/generate-config.js'

/**
 * The isolation guarantee is enforced here. A runner that could read the repository
 * would find its case's goal, the tool implementations and the review report, and the
 * run would be worthless without anyone noticing — so the absence of filesystem tools
 * is asserted, not assumed.
 */
describe('webmcp eval config generation', () => {
  const config = buildConfig(cases)

  it('should declare one MCP server per case', () => {
    const servers = Object.keys(config.mcpJson.mcpServers)
    assert.equal(servers.length, cases.length)
    for (const evalCase of cases) {
      const server = config.mcpJson.mcpServers[`webmcp-eval-${evalCase.name}`]
      assert.ok(server, `missing server for ${evalCase.name}`)
      assert.deepEqual(server.args, ['core/webmcp-eval/server.js'])
      assert.equal(server.env.JL_WEBMCP_EVAL_CASE, evalCase.name)
    }
  })

  it('should write one runner agent definition per case', () => {
    assert.equal(config.agents.length, cases.length)
    for (const evalCase of cases) {
      assert.ok(
        config.agents.some((a) => a.path === `.claude/agents/webmcp-eval-runner-${evalCase.name}.md`),
        `missing agent for ${evalCase.name}`
      )
    }
  })

  it('should grant a runner only its own case tools', () => {
    // Cross-case tools would let one runner see another form; filesystem tools would
    // let it read the case file. Both must be absent.
    const agent = config.agents.find((a) => a.path.endsWith('webmcp-eval-runner-contact.md'))
    assert.ok(agent)
    for (const tool of TOOL_NAMES) {
      assert.ok(agent.content.includes(`mcp__webmcp-eval-contact__${tool}`), `missing ${tool}`)
    }
    assert.ok(!agent.content.includes('webmcp-eval-charts'), 'must not reach another case')
  })

  it('should never grant a runner a filesystem or network tool', () => {
    for (const agent of config.agents) {
      for (const forbidden of ['Read', 'Grep', 'Bash', 'Write', 'Edit', 'WebFetch', 'WebSearch', 'Glob']) {
        assert.ok(
          !new RegExp(`(^|[\\s,:])${forbidden}([\\s,]|$)`, 'm').test(agent.content),
          `${agent.path} must not grant ${forbidden}`
        )
      }
    }
  })

  it('should not tell the runner it is being evaluated', () => {
    // Being told changes behaviour; the run must look like an ordinary page visit.
    for (const agent of config.agents) {
      const body = agent.content.split('---')[2] ?? ''
      for (const leak of ['eval', 'judge', 'benchmark', 'test', 'score']) {
        assert.ok(!body.toLowerCase().includes(leak), `${agent.path} prompt leaks "${leak}"`)
      }
    }
  })

  it('should not put the goal in the agent definition', () => {
    // The goal is passed at dispatch. Baking it in would make every run of a case
    // identical and would leak all goals into one file.
    for (const agent of config.agents) {
      for (const evalCase of cases) {
        assert.ok(!agent.content.includes(evalCase.goal), `${agent.path} must not embed a goal`)
      }
    }
  })
})
