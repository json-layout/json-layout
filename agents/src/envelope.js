/**
 * @file Envelope unwrapping for the load and schema functions.
 */

/**
 * Recognize the optional `{ <key>, version }` envelope a consumer function may return
 * when optimistic concurrency is wanted. Anything else is the bare value.
 *
 * A document that itself carries the payload key and a root `version` key is
 * indistinguishable from an envelope: keep the two apart by not naming a root data
 * property `version`, or by returning the bare document and handling concurrency
 * entirely inside `save`.
 * @param {unknown} result
 * @param {string} key
 * @returns {{ value: unknown, version: unknown }}
 */
export function unwrapEnvelope (result, key) {
  if (result !== null && typeof result === 'object' && !Array.isArray(result) &&
      key in result && 'version' in result &&
      Object.keys(result).every((k) => k === key || k === 'version')) {
    return { value: /** @type {Record<string, unknown>} */(result)[key], version: /** @type {{ version: unknown }} */(result).version }
  }
  return { value: result, version: undefined }
}
