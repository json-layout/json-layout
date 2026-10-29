/**
 * @file A stateful form session over one resource: load, edit through the core
 * tools, save. The consumer supplies the I/O; the session supplies the form.
 */

import { isDeepStrictEqual } from 'node:util'

import { StatefulLayout } from '@json-layout/core/state'
import { WebMCP, generateSkill } from '@json-layout/core/webmcp'

import { unwrapEnvelope } from './envelope.js'
import { resolveCompiledLayout } from './layout-cache.js'

/** @typedef {import('./types.js').SaveContext} SaveContext */
/** @typedef {import('./types.js').FormTool} FormTool */
/** @typedef {import('./types.js').SessionSpec} SessionSpec */
/** @typedef {import('./types.js').SessionStatus} SessionStatus */

/**
 * How a session persists its document: `explicit`, only when the agent asks (`saveForm`, or
 * `save: true` on a write); `auto`, after every write that leaves the form valid, for a
 * document bound to a server-side draft. Explicit is the default: a record is edited, then
 * saved (`715eac0`: saving whenever the form was valid destroyed a draft).
 */
export const SAVE_MODES = /** @type {const} */(['explicit', 'auto'])

/** the core tools that write, which carry the save outcome */
const WRITE_TOOLS = ['setData', 'setFieldValue', 'editArray']

/**
 * @param {unknown} value
 * @returns {string}
 */
function abbreviate (value) {
  const text = JSON.stringify(value) ?? String(value)
  return text.length > 80 ? `${text.slice(0, 77)}...` : text
}

/**
 * @param {Array<{path: string, value: unknown}>} unpicked
 * @returns {string}
 */
function unpickedPhrase (unpicked) {
  const values = unpicked.map((u) => `${u.path} value ${abbreviate(u.value)}`)
  const named = values.length > 1 ? `${values.slice(0, -1).join(', ')} and ${values[values.length - 1]}` : values[0]
  return `${named} ${values.length > 1 ? 'were' : 'was'} not picked from the field's suggestions`
}

/**
 * @param {{ version: unknown, emptied?: boolean }} result
 * @returns {string}
 */
function savedLine (result) {
  const version = result.version === undefined ? '' : `, version ${String(result.version)}`
  return `saved${version}${result.emptied ? '; the form is empty again for a new record' : ''}`
}

/**
 * @param {any} result - an MCP tool result
 * @param {string[]} lines
 * @returns {any}
 */
function appendLines (result, lines) {
  if (!lines.length) return result
  const content = [...(result.content ?? [])]
  const last = content.length - 1
  if (last >= 0 && content[last].type === 'text') {
    content[last] = { ...content[last], text: `${content[last].text}\n${lines.join('\n')}` }
  } else {
    content.push({ type: 'text', text: lines.join('\n') })
  }
  return { ...result, content }
}

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

  /** @type {import('@json-layout/core').CompiledLayout | undefined} */
  _compiled

  /**
   * The version the load reported, given back to the form a create session empties.
   * @type {unknown}
   */
  _loadedVersion

  /**
   * Whether this session creates records: it loaded no document, so a successful save
   * empties the form for the next one.
   * @type {boolean}
   */
  _creating = false

  /**
   * In auto mode, the latest valid document waiting for the save in flight to settle, and
   * the save that will persist it: writes landing during a save coalesce into one.
   * @type {{ snapshot: unknown, promise: Promise<{ version: unknown, emptied?: boolean }> } | undefined}
   */
  _queuedSave

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
    if (!spec || (spec.load !== undefined && typeof spec.load !== 'function')) {
      throw new Error('a session\'s load must be a function, or absent for a session that creates records')
    }
    if (spec.saveMode !== undefined && !SAVE_MODES.includes(spec.saveMode)) {
      throw new Error(`unknown save mode "${String(spec.saveMode)}": one of ${SAVE_MODES.join(', ')}`)
    }
    if (spec.saveMode === 'auto' && typeof spec.save !== 'function') {
      throw new Error('auto-save needs a save function')
    }
    if (spec.saveMode === 'auto' && !spec.load) {
      throw new Error('auto-save needs a loaded document: a session that creates records saves explicitly')
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

  /** @returns {'explicit' | 'auto'} */
  get saveMode () { return this._spec.saveMode ?? 'explicit' }

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
   * conflict; every other failure marks it errored. `emptied` says a session creating
   * records emptied its form for the next one.
   * @param {{ allowInvalid?: boolean }} [options]
   * @returns {Promise<{ version: unknown, emptied?: boolean }>}
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

    // the document as it stands now, not as it stands when the consumer comes back: an
    // edit that lands while the save is in flight is not part of what was persisted
    return this._startSave(this._layout, this._layout.data)
  }

  /**
   * @param {StatefulLayout} layout
   * @param {unknown} snapshot
   * @returns {Promise<{ version: unknown, emptied?: boolean }>}
   */
  async _startSave (layout, snapshot) {
    this._status = 'saving'
    const saving = this._save(layout, snapshot, this._generation)
    this._savePromise = saving
    try {
      return await saving
    } finally {
      if (this._savePromise === saving) this._savePromise = undefined
    }
  }

  /**
   * Auto mode: persist the document as it now stands. A save in flight is never overlapped:
   * the document waits for it, and the writes landing meanwhile share one save of the last
   * of them.
   * @returns {Promise<{ version: unknown, emptied?: boolean }>}
   */
  _autoSave () {
    const layout = /** @type {StatefulLayout} */(this._layout)
    const snapshot = layout.data
    if (!this._savePromise) return this._startSave(layout, snapshot)
    if (this._queuedSave) {
      this._queuedSave.snapshot = snapshot
      return this._queuedSave.promise
    }
    const generation = this._generation
    /** @type {{ snapshot: unknown, promise: Promise<{ version: unknown, emptied?: boolean }> }} */
    const queued = {
      snapshot,
      promise: this._savePromise.catch(() => {}).then(() => {
        if (this._queuedSave === queued) this._queuedSave = undefined
        if (generation !== this._generation || layout !== this._layout) {
          throw sessionError(`"${this.title}" was closed before this edit was saved`, 'closed')
        }
        return this._startSave(layout, queued.snapshot)
      })
    }
    this._queuedSave = queued
    return queued.promise
  }

  /**
   * @param {StatefulLayout} layout - the layout the save was started from
   * @param {unknown} snapshot - the document handed to the consumer
   * @param {number} generation - the session generation the save was started in
   * @returns {Promise<{ version: unknown, emptied?: boolean }>}
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
      if (generation !== this._generation || layout !== this._layout) return { version: this._version }
      // a record being created is done: the next one starts from an empty form, without
      // the lists and picks of this one; unless an edit landed during the save, which an
      // empty form would lose
      if (this._creating && isDeepStrictEqual(layout.data, snapshot)) {
        const version = this._version
        this._install(/** @type {import('@json-layout/core').CompiledLayout} */(this._compiled), undefined)
        this._version = this._loadedVersion
        return { version, emptied: true }
      }
      // what was saved counts as loaded: a value saved despite the warning does not hold
      // every later save
      this._webmcp?.resetBaseline(snapshot)
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
    this._queuedSave = undefined
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
   * The fill-form skill of this session's form: the core guide to the tools, the "About
   * this …" section of the schema's agent guide, and how a session persists its document.
   * A server publishes it next to the tools (openapi-mcp serves it as the MCP skill of an
   * editor group), since a session has no sub-agent tool to hand it over itself.
   * @returns {string}
   */
  getSkill () {
    if (!this._layout) {
      throw sessionError('open the session before asking for its skill', 'closed')
    }
    const prefix = this._spec.prefixName ?? ''
    const skill = generateSkill(this.title, prefix, { guide: this._layout.compiledLayout.agentGuide, screen: false })
    const reload = `${prefix}reloadForm discards local changes and reloads the document from its source; use it after a version conflict.`
    if (this.saveMode === 'auto') {
      return `${skill.trimEnd()}

## Saving

Your edits are saved as they go: every write that leaves the form valid persists the whole document, a write that leaves it invalid stays in this session until a later one makes it valid. ${reload}
`
    }
    if (typeof this._spec.save !== 'function') {
      return `${skill.trimEnd()}

## Saving

This document is read-only here: your edits stay in this session and ${prefix}saveForm refuses. ${reload}
`
    }
    return `${skill.trimEnd()}

## Saving

Your edits stay in this session until you save them: pass save: true to ${prefix}setData, ${prefix}setFieldValue or ${prefix}editArray to save with the write, or call ${prefix}saveForm. A save persists the whole document and is refused while the form is invalid; save: true is also held while a list field holds a value not picked from its suggestions. ${reload}
`
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
    const auto = this.saveMode === 'auto'
    const canSave = typeof this._spec.save === 'function'
    const writeTools = new Set(WRITE_TOOLS.map((name) => `${prefix}${name}`))
    const coreTools = /** @type {FormTool[]} */(/** @type {WebMCP} */(this._webmcp).getTools().map((tool) => {
      const writes = writeTools.has(tool.name)
      /** @type {any} */
      const inputSchema = tool.inputSchema
      return {
        name: tool.name,
        description: tool.description,
        inputSchema: writes && canSave && !auto
          ? {
              ...inputSchema,
              properties: {
                ...inputSchema?.properties,
                save: { type: 'boolean', description: 'Save the form after this write, when the write leaves it valid (default false).' }
              }
            }
          : inputSchema,
        execute: async (/** @type {any} */ args) => {
          const current = this._coreTools?.get(tool.name)
          if (!current) {
            return { content: [{ type: 'text', text: `Error: "${title}" is not open` }], isError: true }
          }
          if (!writes || !canSave) return current.execute(args)
          const { save, ...rest } = args ?? {}
          const result = await current.execute(args ? rest : args)
          if (result?.isError) return result
          return appendLines(result, await this._afterWrite(save === true || save === 'true'))
        }
      }
    }))
    return [
      ...coreTools,
      ...(auto
        ? []
        : [{
            name: `${prefix}saveForm`,
            description: `Save the "${title}" form: persist the data currently in it through the session's save function. Refuses while the form is invalid. On a version conflict, reload first.`,
            inputSchema: { type: 'object', properties: {} },
            execute: async () => {
              try {
                const unpicked = this._webmcp?.unpickedValues() ?? []
                const result = await this.save()
                const suffix = result.version === undefined ? '' : ` (version ${String(result.version)})`
                const lines = [`Saved "${title}"${suffix}.${result.emptied ? ' The form is empty again for a new record.' : ''}`]
                if (unpicked.length) lines.push(`warning: ${unpickedPhrase(unpicked)}; saved anyway`)
                return { content: [{ type: 'text', text: lines.join('\n') }] }
              } catch (err) {
                return { content: [{ type: 'text', text: `Error: ${message(err)}` }], isError: true }
              }
            }
          }]),
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
   * What a write adds to its answer about saving: in explicit mode, only when it asked for
   * a save; in auto mode, always.
   * @param {boolean} requested - the write passed `save: true`
   * @returns {Promise<string[]>}
   */
  async _afterWrite (requested) {
    const prefix = this._spec.prefixName ?? ''
    if (this.saveMode === 'auto') {
      if (!this.valid) return ['not saved yet: the form is invalid']
      try {
        return [savedLine(await this._autoSave())]
      } catch (err) {
        return [`not saved: ${message(err)}`]
      }
    }
    if (!requested) return []
    const allowInvalid = this._spec.allowInvalid ?? false
    // the write's answer above lists the errors
    if (!this.valid && !allowInvalid) return ['not saved: the form is invalid, see the errors above']
    // the fast path carries only checked values; saveForm is the deliberate override
    const unpicked = this._webmcp?.unpickedValues() ?? []
    if (unpicked.length) {
      return [`not saved: ${unpickedPhrase(unpicked)}; pick them with ${prefix}getFieldSuggestions, or ${prefix}saveForm saves anyway`]
    }
    try {
      return [savedLine(await this.save())]
    } catch (err) {
      return [`not saved: ${message(err)}`]
    }
  }

  /**
   * Build the form over a document, with fresh tools state (suggestions, picks).
   * @param {import('@json-layout/core').CompiledLayout} compiled
   * @param {unknown} data
   */
  _install (compiled, data) {
    const mainTree = compiled.skeletonTrees[compiled.mainTree]
    const baseline = baselineOf(data, this.title)
    // server-side there is no typing to debounce, and input is the only arrival mode
    /** @type {Partial<import('@json-layout/core/state').StatefulLayoutOptions>} */
    const options = { validateOn: 'input', debounceInputMs: 0, ...this._spec.options }
    this._layout = new StatefulLayout(compiled, mainTree, options, data, baseline)
    this._webmcp = new WebMCP(this._layout, {
      dataTitle: this.title,
      prefixName: this._spec.prefixName,
      includeFillFormSkill: !!this._spec.includeFillFormSkill,
      includeSubAgent: !!this._spec.includeSubAgent,
      // edited server-side: there is no person's screen with tabs to open
      screen: false
    })
    this._coreTools = new Map(this._webmcp.getTools().map((tool) => [tool.name, tool]))
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
      const { value: data, version } = this._spec.load
        ? unwrapEnvelope(await this._spec.load(), 'data')
        : { value: undefined, version: undefined }
      if (data === undefined && this.saveMode === 'auto') {
        throw sessionError(`"${this.title}" loaded no document: auto-save needs one, a session that creates records saves explicitly`, 'document')
      }
      baselineOf(data, this.title)
      // closed while this was loading: whoever closed it wants nothing installed
      if (generation !== this._generation) return this
      this._version = version
      this._loadedVersion = version
      this._creating = data === undefined
      this._compiled = compiled
      this._install(compiled, data)
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
