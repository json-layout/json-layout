/**
 * @file CM6 extension factory for @json-layout/code. Fast-path wiring:
 * JSON language, CompiledLayout StateField. Completion and hover are
 * wired in subsequent tasks in this plan.
 */

import { jsonFormatAdapter } from '../json/adapter.js'
import { compiledLayoutField } from './compiled-layout-field.js'

/** @typedef {import('@json-layout/core').CompiledLayout} CompiledLayout */
/** @typedef {import('@codemirror/state').Extension} Extension */

/**
 * Build the CM6 extension array for a JSON-layout-backed editor. The passed
 * `compiledLayout` is carried on the EditorState via a StateField and read
 * by completion and hover sources on every keystroke.
 * @param {CompiledLayout} compiledLayout
 * @returns {Extension[]}
 */
export function jsonLayoutExtensions (compiledLayout) {
  return [
    jsonFormatAdapter.language,
    compiledLayoutField.init(() => compiledLayout)
  ]
}
