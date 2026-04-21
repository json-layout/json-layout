/**
 * @file Insert a property into an existing JSON object literal in-place.
 */

import { parser as lezerJsonParser } from '@lezer/json'
import { scaffold } from './scaffold.js'

/** @typedef {import('./types.js').InsertOp} InsertOp */

const VALUE_TYPES = new Set(['Number', 'String', 'True', 'False', 'Null', 'Object', 'Array'])

/**
 * @param {string} raw
 * @returns {string}
 */
function unquote (raw) {
  try { return JSON.parse(raw) } catch { return raw.replace(/^"|"$/g, '') }
}

/**
 * @param {import('@lezer/common').SyntaxNode} valueNode
 * @param {string} text
 * @param {string[]} segments
 * @returns {import('@lezer/common').SyntaxNode | null}
 */
function walkValue (valueNode, text, segments) {
  if (segments.length === 0) return valueNode
  const [segment, ...rest] = segments
  if (valueNode.name === 'Object') {
    let child = valueNode.firstChild
    while (child) {
      if (child.name === 'Property') {
        const propNameNode = child.firstChild
        if (propNameNode?.name === 'PropertyName') {
          const key = unquote(text.slice(propNameNode.from, propNameNode.to))
          if (key === segment) {
            let valueChild = propNameNode.nextSibling
            while (valueChild && !VALUE_TYPES.has(valueChild.name)) valueChild = valueChild.nextSibling
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
 * Compute the column of the first non-whitespace character on the line that
 * contains `offset`.
 * @param {string} text
 * @param {number} offset
 * @returns {number}
 */
function columnOf (text, offset) {
  const lineStart = text.lastIndexOf('\n', offset - 1) + 1
  let col = 0
  for (let i = lineStart; i < offset; i++) {
    if (text[i] === ' ' || text[i] === '\t') col++
    else break
  }
  return col
}

/**
 * Insert `name: value` into the object at `objectPath`.
 * @param {string} text
 * @param {string} objectPath
 * @param {string} name
 * @param {unknown} value
 * @returns {InsertOp}
 */
export function insertProperty (text, objectPath, name, value) {
  const empty = { from: 0, to: 0, insert: '' }
  if (typeof text !== 'string') return empty
  const tree = lezerJsonParser.parse(text)
  const topNode = tree.topNode
  let rootValue = topNode.firstChild
  while (rootValue && !VALUE_TYPES.has(rootValue.name)) rootValue = rootValue.nextSibling
  if (!rootValue) return empty
  const segments = objectPath === '' || objectPath === '/' ? [] : objectPath.replace(/^\//, '').split('/')
  const target = walkValue(rootValue, text, segments)
  if (!target || target.name !== 'Object') return empty

  // Collect existing Property children
  /** @type {import('@lezer/common').SyntaxNode[]} */
  const properties = []
  let child = target.firstChild
  while (child) {
    if (child.name === 'Property') properties.push(child)
    child = child.nextSibling
  }

  const closingBraceIndex = target.to - 1 // position of `}`
  const keyJson = JSON.stringify(name)

  if (properties.length === 0) {
    // Empty object. Keep it single-line.
    const insert = `${keyJson}: ${JSON.stringify(value)}`
    return { from: target.from + 1, to: closingBraceIndex, insert }
  }

  const lastProperty = properties[properties.length - 1]
  const firstProperty = properties[0]
  const openBraceIndex = target.from

  // Determine multi-line vs single-line by checking whether the first property
  // sits on its own line.
  const isMultiline = text.lastIndexOf('\n', firstProperty.from) > openBraceIndex

  if (!isMultiline) {
    const insert = `, ${keyJson}: ${JSON.stringify(value)}`
    return { from: lastProperty.to, to: lastProperty.to, insert }
  }

  // Multi-line case: match the first property's column for indent.
  const column = columnOf(text, firstProperty.from)
  const valueText = scaffold(value, { column, unit: '  ' })
  const insert = `,\n${' '.repeat(column)}${keyJson}: ${valueText}`
  return { from: lastProperty.to, to: lastProperty.to, insert }
}
