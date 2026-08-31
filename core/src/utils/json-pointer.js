/**
 * @file JSON pointer traversal, shared by the compilation step and the webmcp tools
 * @description Pointers are produced by concatenation in the compilation step
 * (`${refPointerPrefix}/properties/${propertyKey}` and similar), their segments are
 * therefore consumed raw: they are deliberately not unescaped as RFC 6901 would
 * prescribe, so that resolution stays symmetric with the way pointers are built.
 */

/**
 * Resolve the fragment part of a JSON pointer (what follows the '#') in a schema or any object.
 * @param {unknown} root
 * @param {string} fragment - e.g. '/properties/address/items', leading and empty segments are ignored
 * @returns {{found: true, value: unknown} | {found: false, path: string[]}} - the resolved value, or
 * the segments consumed up to and including the missing one, to report where the resolution failed
 */
export function resolvePointerFragment (root, fragment) {
  /** @type {string[]} */
  const path = []
  let current = root
  for (const segment of fragment.split('/')) {
    if (!segment) continue
    path.push(segment)
    if (current === null || typeof current !== 'object' || !(segment in current)) {
      return { found: false, path }
    }
    current = /** @type {any} */(current)[segment]
  }
  return { found: true, value: current }
}
