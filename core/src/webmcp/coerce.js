/**
 * @file Tolerant input of the form tools' write layer
 * @description A tool call is JSON, and a model spells a value the way JSON makes easiest:
 * a 14-digit SIRET as a number, a single choice for a multi-valued select. Refusing these
 * costs a round trip (and the quoted retry stored the quotes). These few rules read the
 * intent instead; they are deliberately not ajv `coerceTypes`, which also coerces inside
 * `oneOf` branches and turns "" into 0.
 */

import { resolveNodeSchema } from './schema.js'

/** @typedef {import('../state/types.js').StateNode} StateNode */

const scalarTypes = ['string', 'number', 'integer', 'boolean']

/**
 * A `oneOf`/`anyOf` that is a list of labelled constants is a select; any other is a choice
 * between schemas, where a value must not be bent to fit a branch.
 * @param {Record<string, any>} schema
 * @returns {boolean}
 */
function isChoiceBetweenSchemas (schema) {
  return ['oneOf', 'anyOf'].some((keyword) => Array.isArray(schema[keyword]) &&
    !schema[keyword].every((/** @type {any} */ item) => item && typeof item === 'object' && 'const' in item))
}

/**
 * A number as the text a string field holds. An unsafe integer or an exponent spelling
 * would store something else than what was meant, so those stay refused.
 * @param {unknown} value
 * @returns {boolean}
 */
function isTextableNumber (value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return false
  if (Number.isInteger(value)) return Number.isSafeInteger(value)
  return !/e/i.test(String(value))
}

/**
 * @param {StateNode} node
 * @param {Record<string, any>} schema
 * @returns {string|undefined}
 */
function separatorOf (node, schema) {
  const separator = /** @type {any} */(node.layout)?.separator ?? schema.separator
  return typeof separator === 'string' && separator ? separator : undefined
}

/**
 * Read the value an agent meant for a field.
 * Rules, only for a node whose schema has a single type, outside a variant selector:
 * - a number for `type: 'string'` becomes its text;
 * - a scalar for an `array` of scalars becomes a one-item list, split and trimmed when it is
 *   a string holding the field's `separator`; the numbers of a list of texts become texts.
 * Never `""` to a number, never an object.
 * @param {StateNode} node
 * @param {unknown} value
 * @param {Record<string, any>} [schema] - the schema governing the node
 * @returns {{ value: unknown, coerced?: string }}
 */
export function coerceForNode (node, value, schema) {
  if (!schema || typeof schema !== 'object' || node.key === '$oneOf') return { value }
  if (typeof schema.type !== 'string' || isChoiceBetweenSchemas(schema)) return { value }

  if (schema.type === 'string') {
    return isTextableNumber(value) ? { value: String(value), coerced: 'number → string' } : { value }
  }

  if (schema.type === 'array') {
    const itemType = schema.items?.type
    if (!scalarTypes.includes(itemType) || (schema.items && isChoiceBetweenSchemas(schema.items))) return { value }
    const texts = itemType === 'string'
    if (Array.isArray(value)) {
      if (texts && value.some(isTextableNumber)) {
        return { value: value.map((item) => isTextableNumber(item) ? String(item) : item), coerced: 'number → string' }
      }
      return { value }
    }
    if (typeof value === 'string') {
      if (value === '') return { value }
      const separator = separatorOf(node, schema)
      if (separator && value.includes(separator)) {
        const parts = value.split(separator).map((part) => part.trim()).filter(Boolean)
        return { value: parts, coerced: `split on "${separator}"` }
      }
      return { value: [value], coerced: 'single value → list' }
    }
    if (isTextableNumber(value) || typeof value === 'boolean') {
      return texts && typeof value === 'number'
        ? { value: [String(value)], coerced: 'single value → list, number → string' }
        : { value: [value], coerced: 'single value → list' }
    }
  }

  return { value }
}

/**
 * Coerce the leaves of a data object that sit on a field of the form, walking the state tree
 * of the form as it is. A leaf is left alone when its field is not hydrated yet (the branch
 * of a variant the data is about to activate, an item of a list), and below a variant
 * selector. The given data is not modified.
 * @param {import('../state/index.js').StatefulLayout} statefulLayout
 * @param {Record<string, unknown>} data
 * @returns {{ data: Record<string, unknown>, coerced: string[] }}
 */
export function coerceDataForTree (statefulLayout, data) {
  /** @type {string[]} */
  const coerced = []
  /** @type {Record<string, unknown>|undefined} */
  let copy

  /**
   * @param {StateNode} node
   * @param {boolean} belowSelector
   */
  const visit = (node, belowSelector) => {
    const selector = belowSelector || node.key === '$oneOf'
    const segments = (node.dataPath ?? '').split('/').filter(Boolean)
    if (!selector && segments.length && !segments.some((segment) => /^\d+$/.test(segment))) {
      /** @type {any} */
      let holder = data
      for (const segment of segments.slice(0, -1)) {
        holder = holder && typeof holder === 'object' && !Array.isArray(holder) ? holder[segment] : undefined
      }
      const last = segments[segments.length - 1]
      if (holder && typeof holder === 'object' && !Array.isArray(holder) && Object.prototype.hasOwnProperty.call(holder, last)) {
        const result = coerceForNode(node, holder[last], resolveNodeSchema(node, statefulLayout))
        if (result.coerced) {
          copy ??= structuredClone(data)
          /** @type {any} */
          let target = copy
          for (const segment of segments.slice(0, -1)) target = target[segment]
          target[last] = result.value
          coerced.push(`/${segments.join('/')} ${result.coerced}`)
        }
      }
    }
    for (const child of node.children ?? []) visit(child, selector)
  }
  visit(statefulLayout.stateTree.root, false)
  return { data: copy ?? data, coerced }
}
