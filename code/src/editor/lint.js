/**
 * @file Single CM6 linter source for the committed path. Owns BOTH syntax
 * errors (via CM's jsonParseLinter) and schema errors (via StatefulLayout).
 * Replaces the old sync ViewPlugin + setDiagnostics + linter(null) trio so
 * there is exactly one writer of the lint state — no clobbering.
 *
 * On every (debounced) lint run:
 *   1. If the JSON is syntactically invalid, return ONLY the syntax error and
 *      leave StatefulLayout frozen at its last good state.
 *   2. Otherwise parse, push the parsed value into StatefulLayout (which runs
 *      AJV + expressions), notify `onData`, and return the resolved schema
 *      diagnostics mapped to text ranges.
 */

import { linter } from '@codemirror/lint'
import { jsonParseLinter } from '@codemirror/lang-json'
import { collectDiagnostics } from '../shared/diagnostics.js'
import { jsonFormatAdapter } from '../json/adapter.js'
import { statefulLayoutField } from './stateful-layout-field.js'
import { syncStatefulLayoutData } from './sync.js'

/** @typedef {import('@codemirror/view').EditorView} EditorView */
/** @typedef {import('@codemirror/lint').Diagnostic} Diagnostic */

const DEBOUNCE_MS = 250
const syntaxLinter = jsonParseLinter()

/**
 * Build the json-layout linter extension.
 * @param {((data: unknown) => void)} [onData] - called with the resolved
 *   StatefulLayout data after each successful committed sync (used by the
 *   JsonEditor class / doc app to avoid polling).
 * @returns {import('@codemirror/state').Extension}
 */
export function jsonLayoutLinter (onData) {
  return linter((view) => {
    // jsonParseLinter does its own JSON.parse for precise error positions; on
    // valid JSON we parse once more below via the adapter. The extra parse is
    // an accepted trade-off for better syntax-error locations.
    const syntax = syntaxLinter(view)
    if (syntax.length) return syntax

    const statefulLayout = view.state.field(statefulLayoutField, false)
    if (!statefulLayout) return []

    const text = view.state.doc.toString()
    // Parse + assign (freeze-at-last-good on syntax error) via the shared helper.
    if (!syncStatefulLayoutData(statefulLayout, jsonFormatAdapter, text)) return []
    if (onData) onData(statefulLayout.data)

    return /** @type {Diagnostic[]} */(collectDiagnostics(statefulLayout, text, jsonFormatAdapter))
  }, { delay: DEBOUNCE_MS })
}
