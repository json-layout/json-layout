import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'

import { cases } from '../webmcp-eval/cases/index.js'
import { buildConfig, TOOL_NAMES } from '../webmcp-eval/generate-config.js'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..')

/**
 * Splits an agent file into its frontmatter block and its prompt body. Anchored on the
 * two delimiter lines rather than splitting on every `---`, so a prompt that one day
 * contains a horizontal rule does not silently truncate the body the leak checks read.
 * @param {string} content
 * @returns {{ frontmatter: string, body: string }}
 */
function splitAgent (content) {
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(content)
  assert.ok(match, 'agent file must start with a frontmatter block')
  return { frontmatter: match[1], body: match[2] }
}

/**
 * Pulls one frontmatter field's raw value out of an agent file's rendered content.
 * @param {string} content
 * @param {string} field
 * @returns {string}
 */
function frontmatterField (content, field) {
  const match = splitAgent(content).frontmatter.match(new RegExp(`^${field}:\\s*(.*)$`, 'm'))
  assert.ok(match, `missing "${field}:" in frontmatter`)
  return match[1].trim()
}

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
      const server = config.mcpJson.mcpServers[`page-form-${evalCase.name}`]
      assert.ok(server, `missing server for ${evalCase.name}`)
      assert.deepEqual(server.args, ['core/webmcp-eval/server.js'])
      assert.equal(server.env.JL_WEBMCP_EVAL_CASE, evalCase.name)
    }
  })

  it('should write one runner agent definition per case', () => {
    assert.equal(config.agents.length, cases.length)
    for (const evalCase of cases) {
      assert.ok(
        config.agents.some((a) => a.path === `.claude/agents/page-form-runner-${evalCase.name}.md`),
        `missing agent for ${evalCase.name}`
      )
    }
  })

  it('should grant each runner exactly its own case tools and nothing else', () => {
    // A positive allow-list check, run for every agent: an empty TOOL_NAMES, or a tool
    // list scoped to the wrong case, must fail this test rather than pass it vacuously.
    assert.ok(TOOL_NAMES.length >= 8, 'TOOL_NAMES must not be emptied out, or this check is vacuous')
    for (const evalCase of cases) {
      const agent = config.agents.find((a) => a.path === `.claude/agents/page-form-runner-${evalCase.name}.md`)
      assert.ok(agent, `missing agent for ${evalCase.name}`)
      const entries = frontmatterField(agent.content, 'tools').split(',').map((t) => t.trim()).filter(Boolean)
      assert.equal(entries.length, TOOL_NAMES.length, `${agent.path} must declare exactly TOOL_NAMES.length tools`)
      const ownCasePattern = new RegExp(`^mcp__page-form-${evalCase.name}__\\w+$`)
      for (const entry of entries) {
        assert.ok(ownCasePattern.test(entry), `${agent.path} tool "${entry}" must scope to its own case only`)
      }
    }
  })

  it('should never grant a runner a filesystem or network tool', () => {
    for (const agent of config.agents) {
      const entries = frontmatterField(agent.content, 'tools').split(',').map((t) => t.trim())
      for (const forbidden of ['Read', 'Grep', 'Bash', 'Write', 'Edit', 'WebFetch', 'WebSearch', 'Glob']) {
        assert.ok(!entries.includes(forbidden), `${agent.path} must not grant ${forbidden}`)
      }
    }
  })

  it('should not tell the runner it is being evaluated', () => {
    // Being told changes behaviour; the run must look like an ordinary page visit. Tool
    // names sit in the runner's live context too, so the identifiers it can actually see
    // (name, description, prompt body) must all be checked, not just the prompt body.
    for (const agent of config.agents) {
      const body = splitAgent(agent.content).body
      assert.ok(body.trim().length > 0, 'an empty body would make this check vacuous')
      const name = frontmatterField(agent.content, 'name')
      const description = frontmatterField(agent.content, 'description')
      for (const leak of ['eval', 'judge', 'benchmark', 'test', 'score']) {
        assert.ok(!body.toLowerCase().includes(leak), `${agent.path} prompt leaks "${leak}"`)
        assert.ok(!name.toLowerCase().includes(leak), `${agent.path} name leaks "${leak}"`)
        assert.ok(!description.toLowerCase().includes(leak), `${agent.path} description leaks "${leak}"`)
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

  it('should match the checked-in .mcp.json and agent files on disk', () => {
    // The security property lives in the files Claude Code actually reads. A hand-edit
    // to an agent file, or a case added without re-running the generator, must fail here.
    const diskMcpJson = JSON.parse(readFileSync(join(repoRoot, '.mcp.json'), 'utf8'))
    assert.deepEqual(diskMcpJson, config.mcpJson, '.mcp.json on disk does not match the generator output — re-run npm run webmcp-eval:config -w core')
    for (const agent of config.agents) {
      const diskContent = readFileSync(join(repoRoot, agent.path), 'utf8')
      assert.equal(diskContent, agent.content, `${agent.path} on disk does not match the generator output — re-run npm run webmcp-eval:config -w core`)
    }
  })
})
