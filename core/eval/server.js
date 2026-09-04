#!/usr/bin/env node
/**
 * @file Stdio MCP server exposing one eval case's form tools.
 *
 * This is what lets a coding agent drive a json-layout form for real instead of a test
 * replaying a sequence someone already knew was correct. The agent sees exactly what a
 * browser page would expose — same descriptors, same descriptions, same skill text —
 * so a run that goes badly is evidence about the protocol, not about the harness.
 *
 * Speaks JSON-RPC 2.0 over newline-delimited stdin/stdout, implementing only the three
 * methods a tool-using client needs (initialize, tools/list, tools/call). The official
 * SDK would pull a dependency tree into a package that deliberately has almost none,
 * for a surface this small.
 *
 * Usage (see .mcp.json):
 *   JL_EVAL_CASE=team node core/eval/server.js
 *
 * On exit it writes the recorded run to core/tmp/eval-<case>.json for score.js.
 */

import { createInterface } from 'node:readline'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { getCase } from './cases/index.js'
import { EvalSession } from './session.js'

const here = dirname(fileURLToPath(import.meta.url))
const caseName = process.env.JL_EVAL_CASE || 'contact'
const evalCase = getCase(caseName)
const session = new EvalSession(evalCase)

const transcriptPath = join(here, '..', 'tmp', `eval-${caseName}.json`)

/** Write the run so far to the transcript file scored by score.js. */
function persist () {
  try {
    mkdirSync(dirname(transcriptPath), { recursive: true })
    writeFileSync(transcriptPath, JSON.stringify({
      case: caseName,
      goal: evalCase.goal,
      calls: session.calls,
      data: session.data,
      valid: session.valid,
      score: session.score()
    }, null, 2))
  } catch (/** @type {any} */err) {
    // Never let a bookkeeping failure take down the session mid-run; the agent's work
    // is the valuable part and stderr is out-of-band for an MCP client.
    process.stderr.write(`failed to write transcript: ${err.message}\n`)
  }
}

/**
 * @param {unknown} id
 * @param {unknown} result
 */
function respond (id, result) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n')
}

/**
 * @param {unknown} id
 * @param {number} code
 * @param {string} message
 */
function respondError (id, code, message) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }) + '\n')
}

/**
 * @param {any} msg
 */
async function handle (msg) {
  const { id, method, params } = msg

  if (method === 'initialize') {
    respond(id, {
      // Echo the client's protocol version when it sends one: this server has no
      // version-specific behaviour, and refusing an unknown version would only break
      // clients over a field none of the three implemented methods depend on.
      protocolVersion: params?.protocolVersion ?? '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: `json-layout-eval:${caseName}`, version: '1.0.0' }
    })
    return
  }

  // Notifications carry no id and must not be answered.
  if (method === 'notifications/initialized' || id === undefined) return

  if (method === 'tools/list') {
    respond(id, {
      tools: session.tools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema ?? { type: 'object', properties: {} }
      }))
    })
    return
  }

  if (method === 'tools/call') {
    const name = params?.name
    const args = params?.arguments ?? {}
    try {
      const result = await session.call(name, args)
      persist()
      respond(id, {
        content: result?.content ?? [],
        ...(result?.structuredContent ? { structuredContent: result.structuredContent } : {}),
        isError: !!result?.isError
      })
    } catch (/** @type {any} */err) {
      // Surface a thrown tool as an MCP tool error rather than a transport error: the
      // agent can then react to it, and the run is still scoreable.
      persist()
      respond(id, { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true })
    }
    return
  }

  respondError(id, -32601, `method not found: ${method}`)
}

// The form is stateful, so requests are handled strictly in arrival order. Without
// this chain two pipelined writes could resolve out of order and land on the form in
// the wrong sequence — a race a client would have no way to see, since JSON-RPC lets
// responses come back in any order as long as the ids match.
let queue = Promise.resolve()

const rl = createInterface({ input: process.stdin })
rl.on('line', (line) => {
  const trimmed = line.trim()
  if (!trimmed) return
  let msg
  try {
    msg = JSON.parse(trimmed)
  } catch {
    respondError(null, -32700, 'parse error')
    return
  }
  queue = queue.then(() => handle(msg).catch((err) => respondError(msg?.id ?? null, -32603, err.message)))
})
rl.on('close', persist)

process.stderr.write(`json-layout eval server ready — case "${caseName}": ${evalCase.goal}\n`)
