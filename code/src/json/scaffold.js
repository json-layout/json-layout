/**
 * @file Scaffold a JS value as a JSON string with caller-controlled indent.
 */

/** @typedef {import('./types.js').IndentOptions} IndentOptions */

/**
 * Serialize `value` as JSON with `indent.unit` as the base indentation, then
 * prefix every line after the first with `indent.column` spaces so the text
 * can be dropped into a buffer at a specific column without re-flowing.
 *
 * @param {unknown} value
 * @param {IndentOptions} indent
 * @returns {string}
 */
export function scaffold (value, indent) {
  const json = JSON.stringify(value, null, indent.unit)
  if (json === undefined) return ''
  if (!json.includes('\n')) return json
  const prefix = ' '.repeat(indent.column)
  const lines = json.split('\n')
  return lines[0] + '\n' + lines.slice(1).map(l => prefix + l).join('\n')
}
