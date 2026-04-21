/**
 * @file JSON parse + Lezer-backed text/range helpers.
 */

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
