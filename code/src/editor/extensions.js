/**
 * @file CM6 extension factory for @json-layout/code. Composes the fast-path
 * wiring (JSON language, CompiledLayout StateField, schema-driven completion
 * and hover) and, when a StatefulLayout is passed, the committed-path wiring
 * (StatefulLayout StateField, debounced sync plugin, lint host, dynamic
 * completion source).
 */

import { autocompletion } from '@codemirror/autocomplete'
import { hoverTooltip } from '@codemirror/view'
import { linter } from '@codemirror/lint'
import { jsonFormatAdapter } from '../json/adapter.js'
import { compiledLayoutField } from './compiled-layout-field.js'
import { statefulLayoutField } from './stateful-layout-field.js'
import { statefulLayoutSyncPlugin } from './sync-plugin.js'
import { jsonLayoutCompletion, jsonLayoutDynamicCompletion } from './completion.js'
import { jsonLayoutHover } from './hover.js'

/** @typedef {import('@json-layout/core').CompiledLayout} CompiledLayout */
/** @typedef {import('@json-layout/core').StatefulLayout} StatefulLayout */
/** @typedef {import('@codemirror/state').Extension} Extension */
/** @typedef {import('@codemirror/autocomplete').CompletionSource} CompletionSource */

/**
 * Build the CM6 extension array for a JSON-layout-backed editor. Pass a
 * `StatefulLayout` in `options` to activate the committed path (live schema
 * diagnostics + dynamic completion); omit it for fast-path only.
 * @param {CompiledLayout} compiledLayout
 * @param {{ statefulLayout?: StatefulLayout }} [options]
 * @returns {Extension[]}
 */
export function jsonLayoutExtensions (compiledLayout, options) {
  const statefulLayout = options?.statefulLayout
  /** @type {CompletionSource[]} */
  const completionSources = [jsonLayoutCompletion]
  if (statefulLayout) completionSources.push(jsonLayoutDynamicCompletion)

  /** @type {Extension[]} */
  const extensions = [
    jsonFormatAdapter.language,
    compiledLayoutField.init(() => compiledLayout),
    autocompletion({ override: completionSources }),
    hoverTooltip(jsonLayoutHover)
  ]

  if (statefulLayout) {
    extensions.push(
      statefulLayoutField.init(() => statefulLayout),
      statefulLayoutSyncPlugin,
      linter(null)
    )
  }

  return extensions
}
