/**
 * @file CM6 extension factory for @json-layout/code. Fast-path wiring:
 * JSON language, CompiledLayout StateField, schema-driven completion,
 * schema-driven hover.
 */

import { autocompletion } from '@codemirror/autocomplete'
import { hoverTooltip } from '@codemirror/view'
import { jsonFormatAdapter } from '../json/adapter.js'
import { compiledLayoutField } from './compiled-layout-field.js'
import { jsonLayoutCompletion } from './completion.js'
import { jsonLayoutHover } from './hover.js'

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
    autocompletion({ override: [jsonLayoutCompletion] }),
    hoverTooltip(jsonLayoutHover)
  ]
}
