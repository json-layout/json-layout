/**
 * @file CM6 extension factory for @json-layout/code. Fast-path wiring:
 * JSON language, CompiledLayout StateField, schema-driven completion.
 * Hover is wired in the next task.
 */

import { autocompletion } from '@codemirror/autocomplete'
import { jsonFormatAdapter } from '../json/adapter.js'
import { compiledLayoutField } from './compiled-layout-field.js'
import { jsonLayoutCompletion } from './completion.js'

/** @typedef {import('@json-layout/core').CompiledLayout} CompiledLayout */
/** @typedef {import('@codemirror/state').Extension} Extension */

/**
 * Build the CM6 extension array for a JSON-layout-backed editor.
 * @param {CompiledLayout} compiledLayout
 * @returns {Extension[]}
 */
export function jsonLayoutExtensions (compiledLayout) {
  return [
    jsonFormatAdapter.language,
    compiledLayoutField.init(() => compiledLayout),
    autocompletion({ override: [jsonLayoutCompletion] })
  ]
}
