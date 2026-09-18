/**
 * @file A stateful form session over one resource: load, edit through the core
 * tools, save. The consumer supplies the I/O; the session supplies the form.
 */

import { StatefulLayout } from '@json-layout/core/state'
import { WebMCP } from '@json-layout/core/webmcp'

import { unwrapEnvelope } from './envelope.js'
import { resolveCompiledLayout } from './layout-cache.js'

/** @typedef {import('@json-layout/core').CompiledLayout} CompiledLayout */
/** @typedef {import('@json-layout/core').PartialCompileOptions} PartialCompileOptions */

/**
 * @typedef {object} SaveContext
 * @property {unknown} [version] - the version the document was loaded at, when the
 *   consumer's `load` returned one
 * @property {unknown} [base] - the document as loaded, before any edit
 */

/**
 * @typedef {object} FormTool
 * @property {string} name - the tool name, prefixed when the session sets one
 * @property {string} description - what the agent reads to decide when to call it
 * @property {object} [inputSchema] - JSON Schema of the accepted arguments
 * @property {(args?: any) => Promise<any>} execute - returns an MCP-shaped tool result
 */

/**
 * @typedef {object} SessionSpec
 * @property {() => unknown} load - returns the resource document, or `{ data, version }`
 * @property {(data: unknown, context: SaveContext) => unknown} [save] - persists the
 *   document; absent means the session is read-only
 * @property {() => unknown} [schema] - returns a JSON Schema, or `{ schema, version }`
 * @property {CompiledLayout} [layout] - an already compiled layout; wins over `schema`
 * @property {string} title - what the form edits, e.g. "portal page"; goes into every
 *   tool description
 * @property {Partial<import('@json-layout/core/state').StatefulLayoutOptions>} [options] -
 *   forwarded to the state layer (notably `fetch` and `fetchBaseURL` for remote items)
 * @property {PartialCompileOptions} [compileOptions] - only used when compiling `schema`
 * @property {boolean} [allowInvalid] - let `save` persist a document that fails the
 *   schema's validation (default false)
 * @property {string} [prefixName] - prefix for every tool name, for a consumer that
 *   registers several sessions in one namespace
 * @property {boolean} [includeFillFormSkill] - include the guide-as-a-tool from core
 *   (default false; production pages pass the guide to a sub-agent instead)
 * @property {boolean} [includeSubAgent] - include core's sub-agent entry tool
 *   (default false)
 */

/**
 * @typedef {'closed' | 'opening' | 'ready' | 'stale' | 'saving' | 'error'} SessionStatus
 */

/**
 * @param {string} message
 * @param {string} code
 * @returns {Error & { code: string }}
 */
function sessionError (message, code) {
  const error = /** @type {Error & { code: string }} */(new Error(message))
  error.code = code
  return error
}

/**
 * @param {unknown} err
 * @returns {string}
 */
function message (err) {
  return err instanceof Error ? err.message : String(err)
}

/**
 * One resource being edited by an agent: the compiled layout, the live state tree and
 * the tools over it, plus the load/save functions that turn it into real work.
 */
export class FormSession {
  /** @type {SessionSpec} */
  _spec

  /** @type {StatefulLayout | undefined} */
  _layout

  /** @type {WebMCP | undefined} */
  _webmcp

  /** @type {unknown} */
  _version

  /** @type {SessionStatus} */
  _status = 'closed'

  /** @type {Promise<FormSession> | undefined} */
  _openPromise

  /**
   * @param {SessionSpec} spec
   */
  constructor (spec) {
    if (!spec || typeof spec.load !== 'function') {
      throw new Error('a session needs a load function')
    }
    if (!spec.layout && typeof spec.schema !== 'function') {
      throw new Error('a session needs either a compiled layout or a schema function')
    }
    this._spec = spec
  }

  /** @returns {string} */
  get title () { return this._spec.title }

  /** @returns {SessionStatus} */
  get status () { return this._status }

  /** @returns {unknown} */
  get version () { return this._version }

  /** @returns {boolean} */
  get isOpen () { return !!this._layout }

  /** @returns {StatefulLayout | undefined} */
  get layout () { return this._layout }

  /** @returns {unknown} */
  get data () { return this._layout?.data }

  /** @returns {boolean} */
  get valid () { return this._layout ? this._layout.valid : false }

  /**
   * Whether the document differs from what the last load or save established.
   * @returns {boolean}
   */
  get modified () { return this._layout ? this._layout.modified : false }

  /**
   * Load the resource and build the form. Idempotent, and concurrent calls share one
   * load. Returns this, so `await session.open()` can be chained.
   * @returns {Promise<FormSession>}
   */
  async open () {
    if (this._layout) return this
    if (!this._openPromise) {
      this._status = 'opening'
      this._openPromise = this._open().finally(() => {
        this._openPromise = undefined
      })
    }
    return this._openPromise
  }

  /**
   * Drop local changes and load again. Use after a save conflict.
   * @returns {Promise<FormSession>}
   */
  async reload () {
    if (this._openPromise) await this._openPromise.catch(() => {})
    this._layout = undefined
    this._webmcp = undefined
    this._version = undefined
    this._status = 'closed'
    return this.open()
  }

  /**
   * Drop local changes without loading. The next `open` loads again.
   */
  discard () {
    this.close()
  }

  /**
   * Persist the document through the consumer's save function. Refuses an invalid
   * document unless the consumer opted into `allowInvalid`. A consumer throw carrying
   * `status: 409` or `code: 'conflict'` marks the session stale and is reported as a
   * conflict; every other failure marks it errored.
   * @param {{ allowInvalid?: boolean }} [options]
   * @returns {Promise<{ version: unknown }>}
   */
  async save (options = {}) {
    if (!this._layout) throw sessionError(`"${this.title}" is not open`, 'closed')
    if (typeof this._spec.save !== 'function') {
      throw sessionError(`"${this.title}" is read-only: no save function was provided`, 'readonly')
    }
    const allowInvalid = options.allowInvalid ?? this._spec.allowInvalid ?? false
    if (!this.valid && !allowInvalid) {
      throw sessionError(`"${this.title}" is not valid: fix the reported errors, or allow invalid saves`, 'invalid')
    }

    this._status = 'saving'
    try {
      const result = await this._spec.save(this._layout.data, {
        version: this._version,
        base: this._layout.savedData
      })
      if (result !== null && typeof result === 'object' && 'version' in result) {
        this._version = /** @type {{ version: unknown }} */(result).version
      }
      // what the server now holds is the baseline; this clears the modified markers
      this._layout.savedData = this._layout.data
      this._status = 'ready'
      return { version: this._version }
    } catch (/** @type {any} */err) {
      if (err?.status === 409 || err?.code === 'conflict') {
        this._status = 'stale'
        const conflict = /** @type {Error & { code: string, cause: unknown }} */(
          sessionError(`"${this.title}" changed on the server since it was loaded (${message(err)}): reload to get the server's copy and re-apply your changes`, 'conflict')
        )
        conflict.cause = err
        throw conflict
      }
      this._status = 'error'
      throw err
    }
  }

  /**
   * Forget the form. The session can be opened again, which loads afresh.
   */
  close () {
    this._layout = undefined
    this._webmcp = undefined
    this._version = undefined
    this._status = 'closed'
  }

  /**
   * The tools over this session: core's six, plus `saveForm` and `reloadForm`. Names
   * carry the session's `prefixName`; execution results are MCP-shaped, so a consumer
   * hands them to whatever server SDK it uses.
   * @returns {FormTool[]}
   */
  getTools () {
    if (!this._layout || !this._webmcp) {
      throw sessionError('open the session before asking for its tools', 'closed')
    }
    const prefix = this._spec.prefixName ?? ''
    const title = this.title
    return [
      // @ts-ignore - the descriptor type is generic over client arguments
      ...this._webmcp.getTools(),
      {
        name: `${prefix}saveForm`,
        description: `Save the "${title}" form: persist the data currently in it through the session's save function. Refuses while the form is invalid. On a version conflict, reload first.`,
        inputSchema: { type: 'object', properties: {} },
        execute: async () => {
          try {
            const { version } = await this.save()
            const suffix = version === undefined ? '' : ` (version ${String(version)})`
            return { content: [{ type: 'text', text: `Saved "${title}"${suffix}.` }] }
          } catch (err) {
            return { content: [{ type: 'text', text: `Error: ${message(err)}` }], isError: true }
          }
        }
      },
      {
        name: `${prefix}reloadForm`,
        description: `Reload the "${title}" form from its source, discarding local changes. Use it to resolve a save conflict.`,
        inputSchema: { type: 'object', properties: {} },
        execute: async () => {
          try {
            await this.reload()
            return { content: [{ type: 'text', text: `Reloaded "${title}" from its source; local changes were discarded.` }] }
          } catch (err) {
            return { content: [{ type: 'text', text: `Error: ${message(err)}` }], isError: true }
          }
        }
      }
    ]
  }

  /**
   * @returns {Promise<FormSession>}
   */
  async _open () {
    try {
      const compiled = await resolveCompiledLayout(this._spec)
      const mainTree = compiled.skeletonTrees[compiled.mainTree]
      if (!mainTree) {
        throw new Error(`main skeleton tree "${compiled.mainTree}" not found in the compiled layout`)
      }
      const { value: data, version } = unwrapEnvelope(await this._spec.load(), 'data')
      this._version = version
      // server-side there is no typing to debounce, and input is the only arrival mode
      const options = { validateOn: 'input', debounceInputMs: 0, ...this._spec.options }
      this._layout = new StatefulLayout(compiled, mainTree, options, data, structuredClone(data))
      this._webmcp = new WebMCP(this._layout, {
        dataTitle: this.title,
        prefixName: this._spec.prefixName,
        includeFillFormSkill: !!this._spec.includeFillFormSkill,
        includeSubAgent: !!this._spec.includeSubAgent
      })
      this._status = 'ready'
      return this
    } catch (err) {
      this._status = 'error'
      throw err
    }
  }
}

/**
 * @param {SessionSpec} spec
 * @returns {FormSession}
 */
export function createFormSession (spec) {
  return new FormSession(spec)
}
