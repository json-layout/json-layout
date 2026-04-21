/**
 * @file JSON parse + Lezer-backed text/range helpers.
 */

import { parser as lezerJsonParser } from '@lezer/json'

/** @typedef {import('./types.js').Range} Range */
/** @typedef {import('./types.js').OffsetLocation} OffsetLocation */

/**
 * Parse `text` as JSON, returning the JS value.
 * Throws SyntaxError on invalid input — callers in the committed-path sync loop
 * catch this and freeze the last good state.
 * @param {string} text
 * @returns {unknown}
 */
export function parse (text) {
  return JSON.parse(text)
}

const VALUE_TYPES = new Set(['Number', 'String', 'True', 'False', 'Null', 'Object', 'Array'])

/**
 * Unescape a JSON PropertyName (a quoted string) to its JS string key.
 * @param {string} raw
 * @returns {string}
 */
function unquote (raw) {
  try {
    return JSON.parse(raw)
  } catch {
    // Lezer returned a malformed PropertyName — fall back to stripping quotes
    return raw.replace(/^"|"$/g, '')
  }
}

/**
 * @param {import('@lezer/common').SyntaxNode} node
 * @returns {import('@lezer/common').SyntaxNode | null}
 */
function nextValueSibling (node) {
  let n = node.nextSibling
  while (n && !VALUE_TYPES.has(n.name)) n = n.nextSibling
  return n
}

/**
 * @param {import('@lezer/common').SyntaxNode} valueNode
 * @param {string} text
 * @param {string[]} segments
 * @returns {Range | null}
 */
function walkValue (valueNode, text, segments) {
  if (segments.length === 0) return { from: valueNode.from, to: valueNode.to }
  const [segment, ...rest] = segments
  if (valueNode.name === 'Object') {
    let child = valueNode.firstChild
    while (child) {
      if (child.name === 'Property') {
        const propNameNode = child.firstChild
        if (propNameNode?.name === 'PropertyName') {
          const key = unquote(text.slice(propNameNode.from, propNameNode.to))
          if (key === segment) {
            const valueChild = nextValueSibling(propNameNode)
            if (!valueChild) return null
            return walkValue(valueChild, text, rest)
          }
        }
      }
      child = child.nextSibling
    }
    return null
  }
  if (valueNode.name === 'Array') {
    const index = /^\d+$/.test(segment) ? parseInt(segment, 10) : -1
    if (index < 0) return null
    let i = 0
    let child = valueNode.firstChild
    while (child) {
      if (VALUE_TYPES.has(child.name)) {
        if (i === index) return walkValue(child, text, rest)
        i++
      }
      child = child.nextSibling
    }
    return null
  }
  return null
}

/**
 * Map a JSON pointer path to the text range of its value token.
 * Returns null if the path cannot be resolved (path missing, text not parseable
 * as a JSON value, etc.).
 * @param {string} text
 * @param {string} path
 * @returns {Range | null}
 */
export function pathToRange (text, path) {
  if (typeof text !== 'string' || typeof path !== 'string') return null
  const tree = lezerJsonParser.parse(text)
  const topNode = tree.topNode
  // Find the single value child of JsonText
  let valueNode = topNode.firstChild
  while (valueNode && !VALUE_TYPES.has(valueNode.name)) valueNode = valueNode.nextSibling
  if (!valueNode) return null
  const segments = path === '' || path === '/' ? [] : path.replace(/^\//, '').split('/')
  return walkValue(valueNode, text, segments)
}
