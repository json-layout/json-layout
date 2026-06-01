/**
 * @file Turnkey, framework-agnostic JSON editor. Thin wrapper over
 * jsonLayoutExtensions(): compiles the schema, builds a StatefulLayout, mounts
 * a CodeMirror EditorView with a basic editing setup, and exposes a small
 * imperative API. Hosts that want full control should use jsonLayoutExtensions
 * directly instead.
 */

import { EditorView, lineNumbers, keymap } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { lintGutter, forEachDiagnostic } from '@codemirror/lint'
import { compile, StatefulLayout } from '@json-layout/core'
import { jsonLayoutExtensions } from './extensions.js'

/** @typedef {import('@codemirror/state').Extension} Extension */
/** @typedef {import('@codemirror/lint').Diagnostic} Diagnostic */

/**
 * @typedef {object} JsonEditorOptions
 * @property {object} schema - JSON Schema to compile.
 * @property {unknown} [data] - initial data (defaults to null).
 * @property {object} [statefulLayoutOptions] - merged into the StatefulLayout
 *   options (e.g. `{ context: {...} }` for getItems expressions).
 * @property {Extension} [theme] - optional CM6 theme extension.
 * @property {(data: unknown) => void} [onData] - called after each committed
 *   sync with the resolved data.
 * @property {(text: string) => void} [onText] - called on every doc change.
 */

export class JsonEditor {
  /**
   * @param {HTMLElement} parent
   * @param {JsonEditorOptions} options
   */
  constructor (parent, options) {
    /** @type {HTMLElement} */
    this._parent = parent
    /** @type {JsonEditorOptions} */
    this._options = options
    /** @type {EditorView | null} */
    this._view = null
    /** @type {StatefulLayout | null} */
    this._statefulLayout = null
    /** @type {unknown} */
    this._data = options.data ?? null
    /** @type {boolean} */
    this._destroyed = false
    /**
     * Resolves once the editor is mounted. Construction is async (compile is
     * async) so consumers that need the StatefulLayout must await this.
     * @type {Promise<JsonEditor>}
     */
    this.whenReady = this._init()
  }

  /** @returns {Promise<JsonEditor>} */
  async _init () {
    const compiledLayout = await compile(/** @type {any} */(this._options.schema))
    const statefulLayout = new StatefulLayout(
      compiledLayout,
      compiledLayout.skeletonTrees[compiledLayout.mainTree],
      { debounceInputMs: 0, initialValidation: 'always', ...this._options.statefulLayoutOptions },
      this._data
    )
    this._statefulLayout = statefulLayout

    const initialText = JSON.stringify(this._data, null, 2)
    /** @type {Extension[]} */
    const setup = [
      lineNumbers(),
      history(),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      lintGutter(),
      EditorView.updateListener.of((update) => {
        if (update.docChanged && this._options.onText) this._options.onText(update.state.doc.toString())
      })
    ]
    if (this._options.theme) setup.push(this._options.theme)

    if (this._destroyed) return this
    this._view = new EditorView({
      parent: this._parent,
      state: EditorState.create({
        doc: initialText,
        extensions: [
          ...setup,
          ...jsonLayoutExtensions(compiledLayout, {
            statefulLayout,
            onData: (data) => {
              this._data = data
              if (this._options.onData) this._options.onData(data)
            }
          })
        ]
      })
    })
    return this
  }

  /** @returns {string} current editor text */
  get value () {
    return this._view ? this._view.state.doc.toString() : ''
  }

  /** @param {string} v - no-op before the editor is ready (await whenReady first). */
  set value (v) {
    if (!this._view) return
    this._view.dispatch({ changes: { from: 0, to: this._view.state.doc.length, insert: v } })
  }

  /**
   * @returns {unknown} last-committed parsed data (frozen-at-last-good while
   *   invalid). Lags the current text by up to the linter debounce (~250 ms);
   *   set `value` to change text and `data` follows asynchronously via onData.
   */
  get data () {
    return this._data
  }

  /** @returns {StatefulLayout | null} escape hatch for advanced consumers */
  get statefulLayout () {
    return this._statefulLayout
  }

  /** @returns {Diagnostic[]} current diagnostics from the lint state */
  get diagnostics () {
    /** @type {Diagnostic[]} */
    const out = []
    if (this._view) forEachDiagnostic(this._view.state, (d) => out.push(d))
    return out
  }

  /** @returns {void} */
  focus () {
    if (this._view) this._view.focus()
  }

  /** @returns {void} */
  destroy () {
    this._destroyed = true
    if (this._view) {
      this._view.destroy()
      this._view = null
    }
  }
}
