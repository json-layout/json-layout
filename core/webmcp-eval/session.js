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
import { caseFetch, FIXTURE_BASE_URL } from './remote.js'
import { generateSkill } from '../src/webmcp/tools/fill-form-skill.js'
import { runChecks } from './checks.js'
import { RUNNER_PROMPT } from './prompts.js'

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
 * @property {'form'|'session'|'plain'} arm - which tool surface the agent was given
 * @property {unknown} start - the data the run started from, after the arm normalized it
 * @property {import('./checks.js').CheckResult[]} checks - the case's checks run on the final data
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
 * Tool configurations a case can be run under. `no-guide` is the control for a schema's
 * x-agent-guide: the same case with that annotation removed, so a guided case can be
 * compared with the tools alone.
 */
export const VARIANTS = ['default', 'no-guide']

/**
 * @param {EvalCase} evalCase
 * @param {string} [variant]
 * @returns {EvalCase}
 */
export function applyVariant (evalCase, variant) {
  if (!variant || variant === 'default') return evalCase
  if (variant === 'no-guide') {
    // the control for the schema's x-agent-guide: the same case, its guide removed
    const { 'x-agent-guide': _guide, 'x-i18n-x-agent-guide': _i18nGuide, ...schema } = evalCase.schema
    return { ...evalCase, schema }
  }
  // The 'no-schema' and 'overview' variants were retired. Everything else is a typo and must
  // be refused rather than silently run as the control.
  throw new Error(`unknown variant "${variant}", available: ${VARIANTS.join(', ')}`)
}

/**
 * Evidence basename, the single source every reader and writer shares. The default
 * variant and the default `form` arm keep the plain name so nothing downstream moves;
 * other variants and arms get a suffix so a comparison run never overwrites its control,
 * and a repeated run gets `.r<n>` so repeats never overwrite each other.
 * @param {string} name
 * @param {string} [variant]
 * @param {string} [arm]
 * @param {number} [run]
 * @returns {string}
 */
export function evidenceName (name, variant, arm, run) {
  let label = !variant || variant === 'default' ? name : `${name}--${variant}`
  if (arm && arm !== 'form') label += `--${arm}`
  if (run !== undefined) label += `.r${run}`
  return label
}

/**
 * The exact inverse of `evidenceName` for one case: the variant, arm and run it was built
 * from, or null when the label belongs to another case.
 * @param {string} label
 * @param {string} name
 * @returns {{ variant: string|undefined, arm: string, run: number|undefined }|null}
 */
export function parseEvidenceName (label, name) {
  if (label !== name && !label.startsWith(`${name}--`) && !label.startsWith(`${name}.r`)) return null
  let rest = label.slice(name.length)
  let run
  const runMatch = /\.r(\d+)$/.exec(rest)
  if (runMatch) {
    run = Number(runMatch[1])
    rest = rest.slice(0, runMatch.index)
  }
  let arm = 'form'
  const armMatch = /--(session|plain)$/.exec(rest)
  if (armMatch) {
    arm = armMatch[1]
    rest = rest.slice(0, armMatch.index)
  }
  if (rest && !rest.startsWith('--')) return null
  const variant = rest ? rest.slice(2) : undefined
  return { variant, arm, run }
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
  /**
   * The form's normalized starting data, which checks compare the final data against.
   * @type {unknown}
   */
  start
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
    const fetch = caseFetch(evalCase, options)
    if (fetch) layoutOptions.fetch = fetch
    if (evalCase.remote) layoutOptions.fetchBaseURL = FIXTURE_BASE_URL
    this._layout = new StatefulLayout(
      compiled,
      mainTree,
      layoutOptions,
      structuredClone(evalCase.data)
    )
    this.start = structuredClone(this._layout.data)
    // No fillFormSkill tool: production pages enable includeSubAgent, which hands the
    // guide to the runner as its prompt. Clean runners never called the tool anyway —
    // only ones contaminated by a "always invoke a skill first" instruction did.
    const webmcp = new WebMCP(this._layout, { dataTitle: evalCase.title })
    this._tools = webmcp.getTools()
    // The same pair the subagent tool returns to a page: the guide, and the tools it
    // describes. The launcher injects them; nothing here is a tool the runner can call.
    this._skill = generateSkill(evalCase.title, '', { guide: compiled.agentGuide })
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
   * The runner's whole system prompt: the base prompt, then the guide when there is one.
   * @returns {string}
   */
  get prompt () { return this._skill ? `${RUNNER_PROMPT}\n\n${this._skill}` : RUNNER_PROMPT }

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
      arm: 'form',
      startedAt: this.startedAt,
      start: this.start,
      calls: this.calls,
      data: this.data,
      checks: runChecks(this._case.checks ?? [], this.data, this.start),
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
