#!/usr/bin/env node
/**
 * @file Generate .mcp.json and the runner agent definitions from the case registry.
 *
 * Both are generated from one source because drift between them breaks isolation
 * silently: an agent definition naming a server that no longer exists produces a runner
 * with no tools, which looks like a bad run rather than a broken setup.
 *
 * Usage: npm run webmcp-eval:config -w core
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { cases } from './cases/index.js'

/** @typedef {import('./cases/types.js').EvalCase} EvalCase */

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..')

/**
 * Tool names WebMCP registers when no prefixName is set. Listed explicitly rather than
 * derived from a live session, so the generator needs no compiled form to run.
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
 * evaluation, no tool names, no goal — the goal arrives at dispatch.
 */
const RUNNER_PROMPT = `You are assisting a user with a form on the page they are currently viewing.

Use the tools available to you to inspect the form and fill it in according to what the
user asks for. Work carefully: read the form's structure before writing to it, and check
that the values you write were accepted.

If you cannot determine a value from what the tools tell you, say so in your final
answer rather than guessing. When you are done, summarise what you filled in and
anything you could not complete.`

/**
 * @param {EvalCase[]} evalCases
 * @returns {{ mcpJson: object, agents: Array<{ path: string, content: string }> }}
 */
export function buildConfig (evalCases) {
  /** @type {Record<string, object>} */
  const mcpServers = {}
  /** @type {Array<{ path: string, content: string }>} */
  const agents = []

  for (const evalCase of evalCases) {
    const server = `webmcp-eval-${evalCase.name}`
    mcpServers[server] = {
      type: 'stdio',
      command: 'node',
      args: ['core/webmcp-eval/server.js'],
      env: { JL_WEBMCP_EVAL_CASE: evalCase.name }
    }

    const tools = TOOL_NAMES.map((tool) => `mcp__${server}__${tool}`).join(', ')
    agents.push({
      path: `.claude/agents/webmcp-eval-runner-${evalCase.name}.md`,
      content: `---
name: webmcp-eval-runner-${evalCase.name}
description: Fills in the form on the page the user is viewing.
tools: ${tools}
---

${RUNNER_PROMPT}
`
    })
  }

  return { mcpJson: { mcpServers }, agents }
}

// Only write files when run as a CLI, so importing this in a test has no side effects.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { mcpJson, agents } = buildConfig(cases)
  writeFileSync(join(repoRoot, '.mcp.json'), JSON.stringify(mcpJson, null, 2) + '\n')
  mkdirSync(join(repoRoot, '.claude', 'agents'), { recursive: true })
  for (const agent of agents) {
    writeFileSync(join(repoRoot, agent.path), agent.content)
  }
  console.log(`wrote .mcp.json and ${agents.length} runner agent definitions`)
}
