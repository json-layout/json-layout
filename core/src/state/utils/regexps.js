/** @type {Record<string, RegExp>} */
const cache = {}

/**
 * @param {string} str
 * @returns {RegExp}
 */
export function getRegexp (str) {
  cache[str] = cache[str] ?? new RegExp(str)
  return cache[str]
}
