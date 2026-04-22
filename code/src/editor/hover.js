/**
 * @file Fast-path hover tooltip source. Pure computation + CM6 wrapper.
 */

import { getHelp } from '../shared/help.js'
import { jsonFormatAdapter } from '../json/adapter.js'
import { compiledLayoutField } from './compiled-layout-field.js'

/** @typedef {import('@codemirror/state').EditorState} EditorState */
/** @typedef {import('@codemirror/view').EditorView} EditorView */
/** @typedef {import('@codemirror/view').Tooltip} Tooltip */
/** @typedef {import('../shared/types.js').HelpInfo} HelpInfo */

/**
 * @param {HelpInfo | null} info
 * @returns {info is HelpInfo}
 */
function hasAnyText (info) {
  if (!info) return false
  return typeof info.title === 'string' ||
    typeof info.description === 'string' ||
    typeof info.help === 'string'
}

/**
 * Lazy DOM factory for the tooltip. CM6 invokes this only when the tooltip
 * is actually opened. Unit tests never call it (no DOM).
 * @param {HelpInfo} info
 * @returns {(view: EditorView) => { dom: HTMLElement }}
 */
function createDomFactory (info) {
  return (_view) => {
    const dom = document.createElement('div')
    dom.className = 'jl-hover-tip'
    if (info.title) {
      const h = document.createElement('div')
      h.className = 'jl-hover-title'
      h.textContent = info.title
      dom.appendChild(h)
    }
    if (info.description) {
      const d = document.createElement('div')
      d.className = 'jl-hover-description'
      d.textContent = info.description
      dom.appendChild(d)
    }
    if (info.help) {
      const p = document.createElement('div')
      p.className = 'jl-hover-help'
      // `help` may already be HTML-rendered from markdown by core. Source is
      // the schema author, not end-user input, so innerHTML is acceptable.
      p.innerHTML = info.help
      dom.appendChild(p)
    }
    return { dom }
  }
}

/**
 * Pure hover-tooltip computation. Returns a Tooltip descriptor or null.
 * @param {EditorState} state
 * @param {number} pos
 * @returns {Tooltip | null}
 */
export function computeHover (state, pos) {
  const compiledLayout = state.field(compiledLayoutField, false)
  if (!compiledLayout) return null

  const text = state.doc.toString()
  const loc = jsonFormatAdapter.offsetToPath(text, pos)
  if (!loc) return null

  const info = getHelp(compiledLayout, loc.path)
  if (!hasAnyText(info)) return null

  const range = jsonFormatAdapter.pathToRange(text, loc.path)
  const end = range ? range.to : pos
  return {
    pos,
    end,
    above: true,
    create: createDomFactory(/** @type {HelpInfo} */(info))
  }
}

/**
 * CM6 hoverTooltip source wrapper.
 * @param {EditorView} view
 * @param {number} pos
 * @param {-1 | 1} _side
 * @returns {Tooltip | null}
 */
export function jsonLayoutHover (view, pos, _side) {
  return computeHover(view.state, pos)
}
