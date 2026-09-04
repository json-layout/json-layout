/**
 * @file An instrumented WebMCP session over one eval case.
 *
 * Wraps the same tool descriptors a browser page would register, but records every
 * call and its response size. That recording is the eval: the tools' correctness is
 * already covered by unit tests, what is not covered is the *cost* of using them —
 * how many round-trips and how much context an agent spends to reach valid data.
 *
 * Shared by the stdio MCP server (agent-driven runs) and the in-process spec
 * (deterministic runs), so both score identically.
 */

import { compile } from '../src/compile/index.js'
import { StatefulLayout } from '../src/state/index.js'
import { WebMCP } from '../src/webmcp/index.js'

/** @typedef {import('./cases/types.js').EvalCase} EvalCase */

/**
 * @typedef {object} RecordedCall
 * @property {string} tool - name of the tool the agent called
 * @property {unknown} args - arguments it passed
 * @property {string} response - the text the agent read back, verbatim
 * @property {number} outputBytes - size of that text
 * @property {boolean} isError - whether the tool reported a failure
 */

export class EvalSession {
  /** @type {EvalCase} */
  _case
  /** @type {StatefulLayout} */
  _layout
  /** @type {import('@mcp-b/webmcp-types').ToolDescriptor[]} */
  _tools
  /** @type {RecordedCall[]} */
  calls = []

  /**
   * @param {EvalCase} evalCase
   */
  constructor (evalCase) {
    this._case = evalCase
    const compiled = compile(evalCase.schema)
    const mainTree = compiled.skeletonTrees[compiled.mainTree]
    this._layout = new StatefulLayout(
      compiled,
      mainTree,
      { validateOn: 'input' },
      structuredClone(evalCase.data)
    )
    const webmcp = new WebMCP(this._layout, {
      dataTitle: evalCase.title,
      schema: evalCase.schema,
      // The skill is what an agent reads to learn the protocol, so an eval that hid it
      // would be measuring a different (harder) task than the one real pages present.
      includeFillFormSkill: true
    })
    this._tools = webmcp.getTools()
  }

  /** @returns {import('@mcp-b/webmcp-types').ToolDescriptor[]} */
  get tools () { return this._tools }

  /** @returns {unknown} */
  get data () { return this._layout.data }

  /** @returns {boolean} */
  get valid () { return this._layout.valid }

  /**
   * Run one tool call, recording what it cost.
   * @param {string} name
   * @param {Record<string, unknown>} args
   * @returns {Promise<any>}
   */
  async call (name, args) {
    const tool = this._tools.find((t) => t.name === name)
    if (!tool) {
      // Recorded too: an agent guessing a tool name is itself a protocol signal.
      const message = `unknown tool "${name}", available: ${this._tools.map((t) => t.name).join(', ')}`
      const result = { content: [{ type: 'text', text: message }], isError: true }
      this.calls.push({ tool: name, args, response: message, outputBytes: message.length, isError: true })
      return result
    }
    // @ts-ignore - descriptor execute signature comes from webmcp-types generics
    const result = await tool.execute(args)
    const text = (result?.content ?? [])
      .map((/** @type {any} */ part) => (typeof part?.text === 'string' ? part.text : ''))
      .join('')
    this.calls.push({
      tool: name,
      args,
      response: text,
      outputBytes: Buffer.byteLength(text, 'utf8'),
      isError: !!result?.isError
    })
    return result
  }

  /** @returns {number} */
  get totalOutputBytes () {
    return this.calls.reduce((sum, c) => sum + c.outputBytes, 0)
  }

  /**
   * Everything the judge reads. No verdict: the point of the redesign is that whether a
   * session went well is a judgement about the transcript, not a comparison against a
   * blob written by whoever wrote the case.
   * @returns {object}
   */
  evidence () {
    return {
      case: this._case.name,
      goal: this._case.goal,
      calls: this.calls,
      data: this.data,
      valid: this.valid,
      metrics: {
        toolCalls: this.calls.length,
        outputBytes: this.totalOutputBytes
      }
    }
  }

  /**
   * Human-readable transcript, for reading a run in the terminal.
   * @returns {string}
   */
  report () {
    const lines = [`eval case "${this._case.name}" — ${this.calls.length} calls, ${this.totalOutputBytes} bytes, valid=${this.valid}`]
    for (const [i, call] of this.calls.entries()) {
      lines.push(`  ${i + 1}. ${call.tool}${call.isError ? ' (error)' : ''} ${JSON.stringify(call.args)} → ${call.outputBytes}b`)
    }
    return lines.join('\n')
  }
}
