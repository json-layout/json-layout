/**
 * @typedef {object} ProjectedNode
 * @property {string|number} key
 * @property {string} path
 * @property {string} comp
 * @property {unknown} data
 * @property {string} [title]
 * @property {string} [label]
 * @property {string} [help]
 * @property {string} [error]
 * @property {boolean} [childError]
 * @property {boolean} [required]
 * @property {boolean} [readOnly]
 * @property {Record<string, unknown>} [constraints]
 * @property {Array<{key: number, title: string}>} [oneOfItems]
 * @property {ProjectedNode[]} [children]
 */

/**
 * @typedef {object} ProjectedStateTree
 * @property {ProjectedNode} root
 * @property {boolean} valid
 */
