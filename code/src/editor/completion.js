/**
 * @file Fast-path completion source. Pure computation + CM6 wrapper.
 */

import { lookupNormalizedLayout } from '@json-layout/core'
import {
  getValueCandidates,
  getPropertyCandidates,
  getVariantCandidates,
  getDynamicCandidates
} from '../shared/completion/index.js'
import { jsonFormatAdapter } from '../json/adapter.js'
import { compiledLayoutField } from './compiled-layout-field.js'
import { statefulLayoutField } from './stateful-layout-field.js'

/** @typedef {import('@codemirror/state').EditorState} EditorState */
/** @typedef {import('@codemirror/autocomplete').CompletionResult} CompletionResult */
/** @typedef {import('@codemirror/autocomplete').CompletionContext} CompletionContext */
/** @typedef {import('@codemirror/autocomplete').Completion} Completion */
/** @typedef {import('../shared/types.js').PropertyCandidate} PropertyCandidate */
/** @typedef {import('../shared/types.js').CompletionCandidate} CompletionCandidate */
/** @typedef {import('../shared/types.js').VariantCandidate} VariantCandidate */

const KEY_WORD_RE = /[\w"]/
const VALUE_WORD_RE = /[\w"'.-]/

/**
 * Parse `text` via the JSON adapter and return keys of the object at
 * `objectPath`, or undefined if parsing fails or the path is not an object.
 * Used to filter already-present keys out of property-name completions.
 * @param {string} text
 * @param {string} objectPath
 * @returns {string[] | undefined}
 */
function existingKeysAt (text, objectPath) {
  /** @type {unknown} */
  let value
  try {
    value = jsonFormatAdapter.parse(text)
  } catch {
    return undefined
  }
  const segments = objectPath === '' || objectPath === '/' ? [] : objectPath.replace(/^\//, '').split('/')
  /** @type {any} */
  let current = value
  for (const seg of segments) {
    if (current == null || typeof current !== 'object') return undefined
    current = current[seg]
  }
  if (!current || typeof current !== 'object' || Array.isArray(current)) return undefined
  return Object.keys(current)
}

/**
 * @param {PropertyCandidate} pc
 * @returns {Completion}
 */
function propertyCompletion (pc) {
  const scaffold = pc.defaultValue !== undefined ? JSON.stringify(pc.defaultValue) : null
  const apply = scaffold !== null ? `"${pc.key}": ${scaffold}` : `"${pc.key}": `
  /** @type {Completion} */
  const c = { label: pc.key, apply, type: 'property' }
  if (pc.description) c.info = pc.description
  if (pc.title) c.detail = pc.title
  return c
}

/**
 * @param {CompletionCandidate} v
 * @param {boolean} quoted - true when the cursor sits inside a JSON string, so
 *   the apply text must be the bare value (the quotes already exist) rather
 *   than a JSON literal.
 * @returns {Completion}
 */
function valueCompletion (v, quoted) {
  const apply = quoted && typeof v.value === 'string' ? v.value : JSON.stringify(v.value)
  return { label: v.title, apply, type: 'enum' }
}

/**
 * @param {VariantCandidate} v
 * @returns {Completion}
 */
function variantCompletion (v) {
  return { label: v.title, apply: JSON.stringify(v.value, null, 2), type: 'class' }
}

/**
 * Compute word boundary at `pos` using `re` (one-char regex tested per char).
 * @param {EditorState} state
 * @param {number} pos
 * @param {RegExp} re
 * @returns {{ from: number, to: number }}
 */
function wordRangeAt (state, pos, re) {
  const line = state.doc.lineAt(pos)
  const lineText = line.text
  const col = pos - line.from
  let from = col
  let to = col
  while (from > 0 && re.test(lineText[from - 1])) from--
  while (to < lineText.length && re.test(lineText[to])) to++
  return { from: line.from + from, to: line.from + to }
}

/**
 * Resolve the text range a value completion should replace at `pos`, and
 * whether the cursor sits inside a JSON string (so apply text must be bare).
 * Prefers the quote-aware value token; falls back to a word-range scan at
 * structural positions.
 * @param {EditorState} state
 * @param {string} text
 * @param {number} pos
 * @returns {{ from: number, to: number, quoted: boolean }}
 */
function resolveValueRange (state, text, pos) {
  const token = jsonFormatAdapter.valueTokenAt(text, pos)
  if (token) return token
  const range = wordRangeAt(state, pos, VALUE_WORD_RE)
  return { from: range.from, to: range.to, quoted: false }
}

/**
 * Pure fast-path completion computation.
 * @param {EditorState} state
 * @param {number} pos
 * @param {boolean} _explicit
 * @returns {CompletionResult | null}
 */
export function computeCompletions (state, pos, _explicit) {
  const compiledLayout = state.field(compiledLayoutField, false)
  if (!compiledLayout) return null

  const text = state.doc.toString()
  const loc = jsonFormatAdapter.offsetToPath(text, pos)
  if (!loc) return null

  if (loc.at === 'key' || loc.at === 'structural') {
    const existing = existingKeysAt(text, loc.path)
    const pcs = getPropertyCandidates(compiledLayout, loc.path, existing)
    if (pcs.length) {
      const { from, to } = wordRangeAt(state, pos, KEY_WORD_RE)
      return { from, to, options: pcs.map(propertyCompletion) }
    }
    // Structural positions can also land inside an empty oneOf placeholder —
    // fall through to variant candidates before giving up.
    if (loc.at === 'structural') {
      const variants = getVariantCandidates(compiledLayout, loc.path)
      if (variants.length) {
        const { from, to } = wordRangeAt(state, pos, VALUE_WORD_RE)
        return { from, to, options: variants.map(variantCompletion) }
      }
    }
    return null
  }

  const normalized = lookupNormalizedLayout(compiledLayout, loc.path)
  const valueCandidates = getValueCandidates(normalized)
  const variants = getVariantCandidates(compiledLayout, loc.path)
  if (!valueCandidates.length && !variants.length) return null

  const { from, to, quoted } = resolveValueRange(state, text, pos)

  /** @type {Completion[]} */
  const options = []
  for (const v of valueCandidates) options.push(valueCompletion(v, quoted))
  for (const v of variants) options.push(variantCompletion(v))
  return { from, to, options }
}

/**
 * CM6 CompletionSource wrapper.
 * @param {CompletionContext} context
 * @returns {CompletionResult | null}
 */
export function jsonLayoutCompletion (context) {
  return computeCompletions(context.state, context.pos, context.explicit)
}

/**
 * Async dynamic completion computation. Returns candidates only at value
 * positions and only when a StatefulLayout is installed on the state.
 * @param {EditorState} state
 * @param {number} pos
 * @returns {Promise<CompletionResult | null>}
 */
export async function computeDynamicCompletions (state, pos) {
  const statefulLayout = state.field(statefulLayoutField, false)
  if (!statefulLayout) return null

  const text = state.doc.toString()
  const loc = jsonFormatAdapter.offsetToPath(text, pos)
  if (!loc || loc.at !== 'value') return null

  const candidates = await getDynamicCandidates(statefulLayout, loc.path)
  if (!candidates.length) return null

  const { from, to, quoted } = resolveValueRange(state, text, pos)
  return { from, to, options: candidates.map((c) => valueCompletion(c, quoted)) }
}

/**
 * CM6 async CompletionSource wrapper for dynamic (getItems) candidates.
 * @param {CompletionContext} context
 * @returns {Promise<CompletionResult | null>}
 */
export async function jsonLayoutDynamicCompletion (context) {
  return computeDynamicCompletions(context.state, context.pos)
}
