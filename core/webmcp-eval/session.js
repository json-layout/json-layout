/**
 * @file An instrumented WebMCP session over one eval case.
 *
 * Wraps the same tool descriptors a browser page would register, and records every call
 * with the exact text it returned. That recording is the whole output: nothing here
 * decides whether a run went well — the transcript is evidence for the judge, and the
 * call counts and byte sizes travel with it as context rather than as thresholds.
 *
 * Shared by the stdio MCP server (agent-driven runs) and the in-process spec
 * (deterministic runs), so both produce evidence in the same shape.
 */

import { compile } from '../src/compile/index.js'
import { StatefulLayout } from '../src/state/index.js'
import { WebMCP } from '../src/webmcp/index.js'
import { generateSkill } from '../src/webmcp/tools/fill-form-skill.js'

/** @typedef {import('./cases/types.js').EvalCase} EvalCase */

/**
 * @typedef {object} RecordedCall
 * @property {string} tool - name of the tool the agent called
 * @property {unknown} args - arguments it passed
 * @property {string} response - the text the agent read back, verbatim
 * @property {number} outputBytes - size of that text
 * @property {boolean} isError - whether the tool reported a failure
 */

/**
 * @typedef {object} EvalEvidence
 * @property {string} case - the case name
 * @property {string} goal - the goal the agent was given
 * @property {string} startedAt - ISO timestamp of when the session was opened, so a
 *   transcript left behind by an earlier session cannot be read as a fresh run
 * @property {RecordedCall[]} calls - every tool call the agent made, in order
 * @property {unknown} data - the form data the session ended with
 * @property {boolean} valid - whether that data validates against the case's schema
 * @property {{ toolCalls: number, outputBytes: number }} metrics - run size, reported
 *   as context for the judge, not as a pass/fail threshold
 */

/**
 * Where the vendored data-fair app schemas fetch their pickers from. Both build relative
 * `api/v1/...` URLs, exactly as the deployed apps do, so the harness supplies the base a
 * page would get from its host — pointed at koumoul.com's public instance by default,
 * because a judged run is only meaningful if those lists resolve.
 */
export const DEFAULT_DATA_FAIR_URL = 'https://koumoul.com/data-fair/'

/**
 * Tool configurations a case can be run under. There is one, since every page now gets the
 * same tools: `no-schema` was retired with getSchema itself, once describeState carried the
 * validation constraints that only the raw schema used to hold. The machinery is kept
 * because the next ablation — running with and without the guide, say — plugs into it.
 */
export const VARIANTS = ['default']

/**
 * @param {EvalCase} evalCase
 * @param {string} [variant]
 * @returns {EvalCase}
 */
export function applyVariant (evalCase, variant) {
  if (!variant || variant === 'default') return evalCase
  // The 'no-schema' variant was retired with getSchema: there is no longer a second tool
  // configuration to compare against. The machinery stays because the next ablation — the
  // guide, say — plugs straight into it.
  throw new Error(`unknown variant "${variant}", available: ${VARIANTS.join(', ')}`)
}

/**
 * Evidence basename. The default variant keeps the plain name so nothing downstream
 * moves; other variants get a suffix so a comparison run never overwrites its control.
 * @param {string} name
 * @param {string} [variant]
 * @returns {string}
 */
export function evidenceName (name, variant) {
  return !variant || variant === 'default' ? name : `${name}--${variant}`
}

/**
 * @typedef {object} EvalSessionOptions
 * @property {string} [dataFairURL] - base for the schemas' relative API URLs; defaults to
 *   `JL_WEBMCP_EVAL_DATA_FAIR` or the public koumoul.com instance
 * @property {(url: string, options?: RequestInit) => Promise<any>} [fetch] - replaces the
 *   network for tests
 */

export class EvalSession {
  /** @type {EvalCase} */
  _case
  /** @type {StatefulLayout} */
  _layout
  /** @type {import('@mcp-b/webmcp-types').ToolDescriptor[]} */
  _tools
  /** @type {string} */
  _skill = ''
  /** @type {RecordedCall[]} */
  calls = []
  /**
   * When this session was opened. Evidence files persist in core/tmp/ and are only
   * overwritten when a case actually runs, so without a timestamp a stale transcript is
   * indistinguishable from a fresh one in the report.
   * @type {string}
   */
  startedAt = new Date().toISOString()

  /**
   * @param {EvalCase} evalCase
   * @param {EvalSessionOptions} [options]
   */
  constructor (evalCase, options = {}) {
    this._case = evalCase
    const compiled = compile(evalCase.schema, evalCase.compileOptions)
    const mainTree = compiled.skeletonTrees[compiled.mainTree]
    /** @type {import('../src/state/index.js').StatefulLayoutOptions} */
    const layoutOptions = {
      validateOn: 'input',
      fetchBaseURL: options.dataFairURL ?? process.env.JL_WEBMCP_EVAL_DATA_FAIR ?? DEFAULT_DATA_FAIR_URL,
      context: evalCase.context ?? {}
    }
    if (options.fetch) layoutOptions.fetch = options.fetch
    this._layout = new StatefulLayout(
      compiled,
      mainTree,
      layoutOptions,
      structuredClone(evalCase.data)
    )
    // No fillFormSkill tool: production pages enable includeSubAgent, which hands the
    // guide to the runner as its prompt. Clean runners never called the tool anyway —
    // only ones contaminated by a "always invoke a skill first" instruction did.
    const webmcp = new WebMCP(this._layout, { dataTitle: evalCase.title })
    this._tools = webmcp.getTools()
    // The same pair the subagent tool returns to a page: the guide, and the tools it
    // describes. The launcher injects them; nothing here is a tool the runner can call.
    this._skill = generateSkill(evalCase.title, '')
  }

  /** @returns {import('@mcp-b/webmcp-types').ToolDescriptor[]} */
  get tools () { return this._tools }

  /** @returns {StatefulLayout} */
  get layout () { return this._layout }

  /**
   * The form-filling guide. Production pages hand it to a runner as its prompt via the
   * subagent tool, so the launcher injects it rather than exposing a tool to fetch it.
   * @returns {string}
   */
  get skill () { return this._skill }

  /**
   * The tools the guide describes, in the order a page registers them.
   * @returns {string[]}
   */
  get toolNames () { return this._tools.map((t) => t.name) }

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
   * @returns {EvalEvidence}
   */
  evidence () {
    return {
      case: this._case.name,
      goal: this._case.goal,
      startedAt: this.startedAt,
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
