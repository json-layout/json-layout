import equal from 'fast-deep-equal'

/**
 * Resolve a JSON pointer data path against a data object.
 * @param {unknown} data
 * @param {string} dataPath - JSON pointer (e.g. '', '/a/b', '/arr/0')
 * @returns {unknown}
 */
export function resolveDataPath (data, dataPath) {
  if (dataPath === '') return data
  if (data === undefined || data === null) return undefined
  const segments = dataPath.slice(1).split('/')
  let current = data
  for (const segment of segments) {
    if (current === undefined || current === null || typeof current !== 'object') return undefined
    current = /** @type {any} */(current)[segment]
  }
  return current
}

/**
 * Compare a saved value against a current value.
 * The caller is responsible for checking if the feature is active (context.savedData !== undefined)
 * before calling this function.
 * @param {unknown} savedValue
 * @param {unknown} currentValue
 * @returns {boolean}
 */
export function isNodeModified (savedValue, currentValue) {
  if (savedValue === currentValue) return false
  return !equal(savedValue, currentValue)
}
