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
