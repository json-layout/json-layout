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
 * @property {number} outputBytes - size of the text the agent actually reads back
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
      this.calls.push({ tool: name, args, outputBytes: message.length, isError: true })
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
   * Score the run against the case.
   * @returns {{ passed: boolean, checks: { name: string, passed: boolean, detail: string }[] }}
   */
  score () {
    const { expected, expectedIsPartial, budget } = this._case
    const data = /** @type {Record<string, unknown>} */(this.data ?? {})

    /** @type {{ name: string, passed: boolean, detail: string }[]} */
    const checks = []

    const mismatches = []
    for (const [key, want] of Object.entries(expected)) {
      const got = data[key]
      if (JSON.stringify(got) !== JSON.stringify(want)) {
        mismatches.push(`${key}: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`)
      }
    }
    checks.push({
      name: 'data',
      passed: mismatches.length === 0,
      detail: mismatches.length ? mismatches.join('; ') : 'all expected values present'
    })

    if (!expectedIsPartial) {
      const extra = Object.keys(data).filter((k) => !(k in expected) && data[k] !== undefined)
      checks.push({
        name: 'no-extra-data',
        passed: extra.length === 0,
        detail: extra.length ? `unexpected keys: ${extra.join(', ')}` : 'no unexpected keys'
      })
    }

    checks.push({
      name: 'valid',
      passed: this.valid,
      detail: this.valid ? 'form reports valid' : 'form still reports validation errors'
    })

    checks.push({
      name: 'tool-calls',
      passed: this.calls.length <= budget.toolCalls,
      detail: `${this.calls.length} / ${budget.toolCalls} allowed`
    })

    checks.push({
      name: 'output-bytes',
      passed: this.totalOutputBytes <= budget.outputBytes,
      detail: `${this.totalOutputBytes} / ${budget.outputBytes} allowed`
    })

    return { passed: checks.every((c) => c.passed), checks }
  }

  /** @returns {string} */
  report () {
    const { passed, checks } = this.score()
    const lines = [`eval case "${this._case.name}": ${passed ? 'PASS' : 'FAIL'}`]
    for (const check of checks) {
      lines.push(`  ${check.passed ? 'ok  ' : 'FAIL'} ${check.name}: ${check.detail}`)
    }
    lines.push('  calls: ' + (this.calls.map((c) => c.tool).join(' → ') || '(none)'))
    return lines.join('\n')
  }
}
