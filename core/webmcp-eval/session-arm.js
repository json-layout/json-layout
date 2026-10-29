/**
 * @file The server form session as an eval arm.
 *
 * The same case driven through `@json-layout/agents`' FormSession: the form tools plus an
 * explicit save. What the checks score is what was saved, because a record that was never
 * persisted is not a result. Same surface and recording as EvalSession and PlainApiSession.
 */

import { compile } from '../src/compile/index.js'
import * as agents from '../../agents/src/index.js'
import { caseFetch, FIXTURE_BASE_URL } from './remote.js'
import { DEFAULT_DATA_FAIR_URL } from './session.js'
import { SESSION_RUNNER_PROMPT } from './prompts.js'

/** @typedef {import('./cases/types.js').EvalCase} EvalCase */
/** @typedef {import('./session.js').RecordedCall} RecordedCall */
/** @typedef {import('./session.js').EvalSessionOptions} EvalSessionOptions */
/** @typedef {import('./session.js').EvalEvidence & { arm: 'session', start: unknown }} SessionEvidence */

const NO_AUTO_SAVE = 'FormSession has no auto-save mode yet'

/**
 * Auto-save is detected by the package announcing it, not assumed.
 * @returns {boolean}
 */
function supportsAutoSave () {
  const modes = /** @type {any} */ (agents).SAVE_MODES
  return Array.isArray(modes) && modes.includes('auto')
}

export class FormSessionArm {
  /** @type {EvalCase} */
  _case
  /** @type {import('../../agents/src/session.js').FormSession | undefined} */
  _session
  /** @type {import('ajv').ValidateFunction} */
  _validate
  /** @type {unknown} */
  _saved
  /** @type {RecordedCall[]} */
  calls = []
  /** @type {string} */
  startedAt = new Date().toISOString()
  /** @type {number} */
  saves = 0
  /** @type {unknown} */
  start
  /** @type {boolean} */
  runnable = true
  /** @type {string | undefined} */
  notRunnableReason

  /**
   * Use `FormSessionArm.create`: opening the session is asynchronous.
   * @param {EvalCase} evalCase
   */
  constructor (evalCase) {
    this._case = evalCase
    const compiled = compile(evalCase.schema, evalCase.compileOptions)
    this._validate = compiled.validates[compiled.skeletonTrees[compiled.mainTree].refPointer]
    this.start = structuredClone(evalCase.data)
  }

  /**
   * @param {EvalCase} evalCase
   * @param {EvalSessionOptions} [options]
   * @returns {Promise<FormSessionArm>}
   */
  static async create (evalCase, options = {}) {
    const arm = new FormSessionArm(evalCase)
    if (evalCase.saveMode === 'auto' && !supportsAutoSave()) {
      arm.runnable = false
      arm.notRunnableReason = NO_AUTO_SAVE
      return arm
    }
    /** @type {Record<string, any>} */
    const stateOptions = {
      fetchBaseURL: evalCase.remote ? FIXTURE_BASE_URL : options.dataFairURL ?? process.env.JL_WEBMCP_EVAL_DATA_FAIR ?? DEFAULT_DATA_FAIR_URL,
      context: evalCase.context ?? {}
    }
    const fetch = caseFetch(evalCase, options)
    if (fetch) stateOptions.fetch = fetch
    /** @type {Record<string, any>} */
    const spec = {
      title: evalCase.title,
      schema: () => evalCase.schema,
      compileOptions: evalCase.compileOptions,
      load: () => structuredClone(evalCase.data),
      save: (/** @type {unknown} */ data) => {
        arm._saved = structuredClone(data)
        arm.saves++
      },
      options: stateOptions
    }
    // only a session that knows the mode is told it
    if (evalCase.saveMode === 'auto') spec.saveMode = 'auto'
    arm._session = agents.createFormSession(/** @type {any} */ (spec))
    await arm._session.open()
    arm.start = structuredClone(arm._session.data)
    return arm
  }

  /** @returns {import('../../agents/src/types.js').FormTool[]} */
  get tools () { return this._session ? this._session.getTools() : [] }

  /** @returns {string[]} */
  get toolNames () { return this.tools.map((t) => t.name) }

  /**
   * The runner's whole system prompt: the task, then the session's own guide.
   * @returns {string}
   */
  get prompt () {
    return this._session ? `${SESSION_RUNNER_PROMPT}\n\n${this._session.getSkill()}` : ''
  }

  /**
   * What persisted: the last saved document, or the start when nothing was saved.
   * @returns {unknown}
   */
  get data () { return this.saves > 0 ? this._saved : this.start }

  /** @returns {boolean} */
  get valid () { return !!this._validate(this.data) }

  /**
   * Run one tool call, recording what it cost.
   * @param {string} name
   * @param {Record<string, unknown>} args
   * @returns {Promise<any>}
   */
  async call (name, args) {
    const tool = this.tools.find((t) => t.name === name)
    const result = tool
      ? await tool.execute(args)
      : { content: [{ type: 'text', text: `unknown tool "${name}", available: ${this.toolNames.join(', ')}` }], isError: true }
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

  /** @returns {SessionEvidence} */
  evidence () {
    return {
      case: this._case.name,
      goal: this._case.goal,
      arm: 'session',
      startedAt: this.startedAt,
      start: this.start,
      calls: this.calls,
      data: this.data,
      valid: this.valid,
      metrics: {
        toolCalls: this.calls.length,
        outputBytes: this.totalOutputBytes
      }
    }
  }

  /** @returns {string} */
  report () {
    const lines = [`eval case "${this._case.name}" (form session) — ${this.calls.length} calls, ${this.totalOutputBytes} bytes, ${this.saves} saves, valid=${this.valid}`]
    for (const [i, call] of this.calls.entries()) {
      lines.push(`  ${i + 1}. ${call.tool}${call.isError ? ' (error)' : ''} ${JSON.stringify(call.args)} → ${call.outputBytes}b`)
    }
    return lines.join('\n')
  }
}
