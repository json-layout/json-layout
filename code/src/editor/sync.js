/**
 * @file Pure helpers for the committed path: apply a parsed buffer to a
 * StatefulLayout and derive the matching setDiagnostics transaction. Split
 * out of the ViewPlugin so all behavior is testable with an EditorState and
 * a stub `dispatch` — no DOM required.
 */

import { setDiagnostics } from '@codemirror/lint'
import { collectDiagnostics } from '../shared/diagnostics.js'
import { jsonFormatAdapter } from '../json/adapter.js'
import { compiledLayoutField } from './compiled-layout-field.js'
import { statefulLayoutField } from './stateful-layout-field.js'

/** @typedef {import('@codemirror/state').EditorState} EditorState */
/** @typedef {import('@codemirror/state').TransactionSpec} TransactionSpec */
/** @typedef {import('@json-layout/core').StatefulLayout} StatefulLayout */
/** @typedef {import('../json/types.js').FormatAdapter} FormatAdapter */

/**
 * Try to parse `text` and assign it as the root data of `statefulLayout`.
 * Returns `true` on success, `false` on parse error (in which case
 * `statefulLayout.data` is left untouched — "freeze at last good").
 * @param {StatefulLayout} statefulLayout
 * @param {FormatAdapter} formatAdapter
 * @param {string} text
 * @returns {boolean}
 */
export function syncStatefulLayoutData (statefulLayout, formatAdapter, text) {
  /** @type {unknown} */
  let parsed
  try {
    parsed = formatAdapter.parse(text)
  } catch {
    return false
  }
  statefulLayout.data = parsed
  return true
}

/**
 * Run one committed sync: pull the StatefulLayout off `state`, re-sync it
 * against the current doc, and (on success) dispatch a setDiagnostics
 * transaction with the resolved schema diagnostics. Does nothing if no
 * StatefulLayout is installed or if the doc is unparseable.
 * @param {EditorState} state
 * @param {(tr: TransactionSpec) => void} dispatch
 * @returns {void}
 */
export function runCommittedSync (state, dispatch) {
  const statefulLayout = state.field(statefulLayoutField, false)
  if (!statefulLayout) return
  const compiledLayout = state.field(compiledLayoutField, false)
  if (!compiledLayout) return

  const text = state.doc.toString()
  if (!syncStatefulLayoutData(statefulLayout, jsonFormatAdapter, text)) return

  const diagnostics = collectDiagnostics(statefulLayout, text, jsonFormatAdapter)
  dispatch(setDiagnostics(state, diagnostics))
}
