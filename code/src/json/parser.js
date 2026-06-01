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
 * Find the smallest node containing `offset`.
 * Uses half-open intervals (from <= offset < to) with a fallback for the
 * last token in the file (from <= offset <= to) so that end-of-input
 * offsets still resolve. When a token's end boundary equals `offset` AND
 * the very next sibling starts at `offset`, we prefer the next sibling
 * (avoids misclassifying the boundary between `:` and a value node).
 * @param {import('@lezer/common').SyntaxNode} node
 * @param {number} offset
 * @returns {import('@lezer/common').SyntaxNode | null}
 */
function smallestEnclosing (node, offset) {
  /** @type {import('@lezer/common').SyntaxNode | null} */
  let best = null
  let child = node.firstChild
  while (child) {
    const inRange = offset >= child.from && offset < child.to
    const atEnd = !inRange && offset === child.to
    if (inRange || atEnd) {
      // If we matched only at the end boundary, check if next sibling starts here
      if (atEnd && child.nextSibling && child.nextSibling.from === offset) {
        child = child.nextSibling
        continue
      }
      const deeper = smallestEnclosing(child, offset)
      best = deeper ?? child
      break
    }
    child = child.nextSibling
  }
  return best
}

/**
 * Compute the JSON pointer path from the root down to the Property/Array-item
 * containing `node`.
 * @param {import('@lezer/common').SyntaxNode} node
 * @param {string} text
 * @returns {string}
 */
function buildPathTo (node, text) {
  /** @type {string[]} */
  const segments = []
  /** @type {import('@lezer/common').SyntaxNode | null} */
  let cursor = node
  while (cursor && cursor.parent) {
    /** @type {import('@lezer/common').SyntaxNode} */
    const parent = cursor.parent
    if (parent.name === 'Property' && cursor.name !== 'PropertyName') {
      // cursor is the value half of a Property — the property's key contributes a segment
      const nameNode = parent.firstChild
      if (nameNode?.name === 'PropertyName') {
        segments.unshift(unquote(text.slice(nameNode.from, nameNode.to)))
      }
      cursor = parent.parent // skip Property itself; continue from its Object parent
      continue
    }
    if (parent.name === 'Array' && VALUE_TYPES.has(cursor.name)) {
      // cursor is an array element — count the element index
      let idx = 0
      let sib = parent.firstChild
      while (sib) {
        if (VALUE_TYPES.has(sib.name)) {
          if (sib.from === cursor.from && sib.to === cursor.to) break
          idx++
        }
        sib = sib.nextSibling
      }
      segments.unshift(String(idx))
      cursor = parent
      continue
    }
    cursor = parent
  }
  return segments.length === 0 ? '' : '/' + segments.join('/')
}

/**
 * Classify a cursor offset as key/value/structural and return the enclosing path.
 * @param {string} text
 * @param {number} offset
 * @returns {OffsetLocation | null}
 */
export function offsetToPath (text, offset) {
  if (typeof text !== 'string' || typeof offset !== 'number') return null
  if (offset < 0 || offset > text.length) return null
  const tree = lezerJsonParser.parse(text)
  const topNode = tree.topNode
  let rootValue = topNode.firstChild
  while (rootValue && !VALUE_TYPES.has(rootValue.name)) rootValue = rootValue.nextSibling
  if (!rootValue) return null

  const deepest = smallestEnclosing(topNode, offset) ?? rootValue

  // Key position: cursor inside a PropertyName.
  if (deepest.name === 'PropertyName') {
    const property = deepest.parent
    const obj = property?.parent
    if (obj) {
      const pathToObj = buildPathTo(obj, text)
      return { path: pathToObj, at: 'key' }
    }
  }

  // Value position: cursor is inside a VALUE_TYPES node.
  /** @type {import('@lezer/common').SyntaxNode | null} */
  let valueAncestor = deepest
  while (valueAncestor && !VALUE_TYPES.has(valueAncestor.name)) {
    valueAncestor = valueAncestor.parent
  }

  // Structural position: cursor is on punctuation or whitespace inside a container
  // but not inside a leaf value.
  if (!valueAncestor) {
    return { path: '', at: 'structural' }
  }

  const path = buildPathTo(valueAncestor, text)

  // If the ancestor is a container and the deepest node is either the container itself
  // or a structural/punctuation token (not a value type), treat as structural.
  if (valueAncestor.name === 'Object' || valueAncestor.name === 'Array') {
    if (deepest === valueAncestor || !VALUE_TYPES.has(deepest.name)) {
      return { path, at: 'structural' }
    }
  }

  return { path, at: 'value' }
}

/**
 * Locate the value token enclosing `offset` and report the range a value
 * completion should replace, plus whether that token is a quoted string.
 *
 * For a String token the range is the INTERIOR (between the quotes) so a
 * completion replaces the string contents without disturbing the quotes - and
 * so CM's fuzzy filter matches candidate labels against the typed contents
 * rather than against a leading `"`. For other scalar tokens (Number/True/
 * False/Null) the range is the whole token. Returns null at structural
 * positions (inside an Object/Array but not on a leaf value), where the caller
 * falls back to a word-range scan.
 * @param {string} text
 * @param {number} offset
 * @returns {{ from: number, to: number, quoted: boolean } | null}
 */
export function valueTokenAt (text, offset) {
  if (typeof text !== 'string' || typeof offset !== 'number') return null
  if (offset < 0 || offset > text.length) return null
  const tree = lezerJsonParser.parse(text)
  /** @type {import('@lezer/common').SyntaxNode | null} */
  let node = smallestEnclosing(tree.topNode, offset)
  while (node && !VALUE_TYPES.has(node.name)) node = node.parent
  if (!node) return null
  if (node.name === 'Object' || node.name === 'Array') return null
  // For a well-formed String, node.to - node.from >= 2 (the two quote chars),
  // so the interior range is valid (zero-width for ""). A malformed/unterminated
  // string could yield from > to; callers treat that as a harmless zero-width range.
  if (node.name === 'String') return { from: node.from + 1, to: node.to - 1, quoted: true }
  return { from: node.from, to: node.to, quoted: false }
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
