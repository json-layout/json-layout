/**
 * @file A stateful form session over one resource: load, edit through the core
 * tools, save. The consumer supplies the I/O; the session supplies the form.
 */

import { StatefulLayout } from '@json-layout/core/state'
import { WebMCP } from '@json-layout/core/webmcp'

import { unwrapEnvelope } from './envelope.js'
import { resolveCompiledLayout } from './layout-cache.js'

/** @typedef {import('./types.js').SaveContext} SaveContext */
/** @typedef {import('./types.js').FormTool} FormTool */
/** @typedef {import('./types.js').SessionSpec} SessionSpec */
/** @typedef {import('./types.js').SessionStatus} SessionStatus */

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
 * The baseline `modified` is computed against. A document that loads as `undefined` -
 * a record being created - gets `null`, because the state layer reports nothing as
 * modified while its baseline is `undefined`.
 * @param {unknown} data
 * @param {string} title
 * @returns {unknown}
 */
function baselineOf (data, title) {
  if (data === undefined) return null
  try {
    return structuredClone(data)
  } catch (err) {
    throw sessionError(`"${title}" could not be copied (${message(err)}): a session edits a plain JSON document`, 'document')
  }
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

  /** @type {Promise<{ version: unknown }> | undefined} */
  _savePromise

  /**
   * Bumped by every `close`, so a load still in flight knows the session it was loading
   * for is gone and drops what it loaded instead of installing it.
   * @type {number}
   */
  _generation = 0

  /** @type {FormTool[] | undefined} */
  _tools

  /**
   * The core tools of the current WebMCP, by name. Rebuilt by every open; the facades in
   * `_tools` look their target up here at call time.
   * @type {Map<string, any> | undefined}
   */
  _coreTools

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
      const opening = this._open(this._generation).finally(() => {
        // a close during the load already dropped it and may have started another one
        if (this._openPromise === opening) this._openPromise = undefined
      })
      this._openPromise = opening
    }
    return this._openPromise
  }

  /**
   * Drop local changes and load again. Use after a save conflict.
   * @returns {Promise<FormSession>}
   */
  async reload () {
    this.close()
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
    if (this._savePromise) {
      throw sessionError(`"${this.title}" is already being saved: wait for that save to report before starting another`, 'saving')
    }
    const allowInvalid = options.allowInvalid ?? this._spec.allowInvalid ?? false
    if (!this.valid && !allowInvalid) {
      throw sessionError(`"${this.title}" is not valid: fix the reported errors, or allow invalid saves`, 'invalid')
    }

    this._status = 'saving'
    // the document as it stands now, not as it stands when the consumer comes back: an
    // edit that lands while the save is in flight is not part of what was persisted
    const saving = this._save(this._layout, this._layout.data, this._generation)
    this._savePromise = saving
    try {
      return await saving
    } finally {
      if (this._savePromise === saving) this._savePromise = undefined
    }
  }

  /**
   * @param {StatefulLayout} layout - the layout the save was started from
   * @param {unknown} snapshot - the document handed to the consumer
   * @param {number} generation - the session generation the save was started in
   * @returns {Promise<{ version: unknown }>}
   */
  async _save (layout, snapshot, generation) {
    /** @param {SessionStatus} status */
    const setStatus = (status) => {
      // a close or reload during the save left this one talking about a form that is gone
      if (generation === this._generation) this._status = status
    }
    try {
      const result = await /** @type {(data: unknown, context: SaveContext) => unknown} */(this._spec.save)(snapshot, {
        version: this._version,
        base: layout.savedData
      })
      if (result !== null && typeof result === 'object' && 'version' in result) {
        this._version = /** @type {{ version: unknown }} */(result).version
      } else {
        // the consumer persisted the document but reported no new version: keeping the
        // one loaded would make every later save conflict against a version the source
        // has moved past, so forget it rather than send a stale precondition
        this._version = undefined
      }
      // what the source now holds is the baseline; this clears the modified markers
      layout.savedData = snapshot
      setStatus('ready')
      return { version: this._version }
    } catch (/** @type {any} */err) {
      if (err?.status === 409 || err?.code === 'conflict') {
        setStatus('stale')
        const conflict = /** @type {Error & { code: string, cause: unknown }} */(
          sessionError(`"${this.title}" changed on the server since it was loaded (${message(err)}): reload to get the server's copy and re-apply your changes`, 'conflict')
        )
        conflict.cause = err
        throw conflict
      }
      setStatus('error')
      throw err
    }
  }

  /**
   * Forget the form. The session can be opened again, which loads afresh.
   */
  close () {
    this._generation += 1
    this._openPromise = undefined
    // a save still in flight was for the form being dropped: it settles on its own, and
    // must not hold back a save on the form that replaces it
    this._savePromise = undefined
    this._layout = undefined
    this._webmcp = undefined
    this._coreTools = undefined
    this._version = undefined
    this._status = 'closed'
  }

  /**
   * The tools over this session: core's six, plus `saveForm` and `reloadForm`. Names
   * carry the session's `prefixName`; execution results are MCP-shaped, so a consumer
   * hands them to whatever server SDK it uses.
   *
   * The same descriptors are returned for the life of the session, and they follow it
   * across a reload: a consumer registers them once, the way an MCP server does.
   * @returns {FormTool[]}
   */
  getTools () {
    if (!this._layout || !this._webmcp) {
      throw sessionError('open the session before asking for its tools', 'closed')
    }
    this._tools = this._tools ?? this._buildTools()
    return this._tools
  }

  /**
   * @returns {FormTool[]}
   */
  _buildTools () {
    const prefix = this._spec.prefixName ?? ''
    const title = this.title
    // Facades over core's tools rather than the descriptors themselves: `reload` builds a
    // new layout and a new WebMCP under the session, and a descriptor bound to the old one
    // would keep editing a form nobody reads any more.
    const coreTools = /** @type {FormTool[]} */(/** @type {WebMCP} */(this._webmcp).getTools().map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      execute: async (/** @type {any} */ args) => {
        const current = this._coreTools?.get(tool.name)
        if (!current) {
          return { content: [{ type: 'text', text: `Error: "${title}" is not open` }], isError: true }
        }
        return current.execute(args)
      }
    })))
    return [
      ...coreTools,
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
   * @param {number} generation - the session generation this load was started in
   * @returns {Promise<FormSession>}
   */
  async _open (generation) {
    try {
      const compiled = await resolveCompiledLayout(this._spec)
      const mainTree = compiled.skeletonTrees[compiled.mainTree]
      if (!mainTree) {
        throw new Error(`main skeleton tree "${compiled.mainTree}" not found in the compiled layout`)
      }
      const { value: data, version } = unwrapEnvelope(await this._spec.load(), 'data')
      const baseline = baselineOf(data, this.title)
      // closed while this was loading: whoever closed it wants nothing installed
      if (generation !== this._generation) return this
      this._version = version
      // server-side there is no typing to debounce, and input is the only arrival mode
      /** @type {Partial<import('@json-layout/core/state').StatefulLayoutOptions>} */
      const options = { validateOn: 'input', debounceInputMs: 0, ...this._spec.options }
      this._layout = new StatefulLayout(compiled, mainTree, options, data, baseline)
      this._webmcp = new WebMCP(this._layout, {
        dataTitle: this.title,
        prefixName: this._spec.prefixName,
        includeFillFormSkill: !!this._spec.includeFillFormSkill,
        includeSubAgent: !!this._spec.includeSubAgent
      })
      this._coreTools = new Map(this._webmcp.getTools().map((tool) => [tool.name, tool]))
      this._status = 'ready'
      return this
    } catch (err) {
      if (generation === this._generation) this._status = 'error'
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
