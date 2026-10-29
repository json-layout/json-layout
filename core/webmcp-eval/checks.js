/**
 * @file Targeted checks a case can carry on a run's final data.
 *
 * Pure: no imports from src/. A check says what the data must look like when the run
 * ends, so a run can be scored on the outcome whatever path the agent took to get there.
 */

/**
 * @typedef {{ path: string, equals: unknown, label?: string }
 *   | { path: string, values: string[], separator?: string, label?: string }
 *   | { path: string, contains: Record<string, any>, label?: string }
 *   | { unchangedExcept: string[], label?: string }} EvalCheck
 */

/**
 * @typedef {object} CheckResult
 * @property {string} label - the check's label, or a rendering of it
 * @property {boolean} ok - whether the data satisfies the check
 * @property {string} detail - what was found when it does not, empty otherwise
 */

const MISSING = Symbol('missing')

/** @param {string} pointer */
const tokens = (pointer) => pointer.split('/').slice(1).map(t => t.replace(/~1/g, '/').replace(/~0/g, '~'))

/**
 * @param {any} data
 * @param {string} pointer
 */
const resolve = (data, pointer) => {
  let cur = data
  for (const t of tokens(pointer)) {
    if (cur === null || typeof cur !== 'object' || !(t in cur)) return MISSING
    cur = cur[t]
  }
  return cur
}

/** @param {unknown} v */
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

/**
 * First pointer at which a and b differ, or null when deep-equal. Holes left by
 * deleting array items are skipped on both sides, so the other indexes keep their meaning.
 * @param {any} a
 * @param {any} b
 * @param {string} at
 * @returns {string | null}
 */
const firstDiff = (a, b, at = '') => {
  if (a === b) return null
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) return at || '/'
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const k of keys) {
    const d = firstDiff(a[k], b[k], `${at}/${k.replace(/~/g, '~0').replace(/\//g, '~1')}`)
    if (d) return d
  }
  return null
}

/** @param {any} v */
const show = (v) => JSON.stringify(v)

/**
 * An expected string matches an actual number by its decimal rendering.
 * @param {unknown} expected
 * @param {unknown} actual
 */
const equalsNormalized = (expected, actual) => {
  if (typeof expected === 'string' && typeof actual === 'number') return String(actual) === expected
  return firstDiff(expected, actual) === null
}

/**
 * Every key of `partial` present in `item` with a deep-equal value, recursing into plain objects.
 * @param {any} item
 * @param {any} partial
 * @returns {boolean}
 */
const includes = (item, partial) => {
  if (isObject(partial)) {
    return isObject(item) && Object.keys(partial).every(k => k in item && includes(item[k], partial[k]))
  }
  return firstDiff(item, partial) === null
}

/**
 * @param {unknown} v
 * @param {string} separator
 */
const toSet = (v, separator) => {
  const list = Array.isArray(v) ? v : typeof v === 'string' ? v.split(separator) : null
  return list && new Set(list.map(i => String(i).trim()))
}

/**
 * @param {any} data
 * @param {string} pointer
 */
const without = (data, pointer) => {
  const copy = structuredClone(data)
  const t = tokens(pointer)
  const last = t.pop()
  let cur = copy
  for (const k of t) {
    if (cur === null || typeof cur !== 'object') return copy
    cur = cur[k]
  }
  if (cur !== null && typeof cur === 'object' && last !== undefined) delete cur[last]
  return copy
}

/**
 * @param {EvalCheck} check
 * @param {unknown} data
 * @param {unknown} start
 * @returns {CheckResult}
 */
const runCheck = (check, data, start) => {
  if ('unchangedExcept' in check) {
    const label = check.label ?? `unchanged except ${check.unchangedExcept.join(', ') || 'nothing'}`
    let a = data
    let b = start
    for (const p of check.unchangedExcept) { a = without(a, p); b = without(b, p) }
    const diff = firstDiff(a, b)
    return diff === null ? { label, ok: true, detail: '' } : { label, ok: false, detail: `changed at ${diff}` }
  }
  const actual = resolve(data, check.path)
  if ('equals' in check) {
    const label = check.label ?? `${check.path} equals ${show(check.equals)}`
    if (actual === MISSING) return { label, ok: false, detail: `${check.path} is missing` }
    const ok = equalsNormalized(check.equals, actual)
    return { label, ok, detail: ok ? '' : `got ${show(actual)}` }
  }
  if ('values' in check) {
    const label = check.label ?? `${check.path} has values ${show(check.values)}`
    if (actual === MISSING) return { label, ok: false, detail: `${check.path} is missing` }
    const got = toSet(actual, check.separator ?? ',')
    if (!got) return { label, ok: false, detail: `got ${show(actual)}, neither an array nor a string` }
    const want = toSet(check.values, ',')
    const ok = want && got.size === want.size && [...want].every(v => got.has(v))
    return { label, ok: !!ok, detail: ok ? '' : `got ${show([...got])}` }
  }
  const label = check.label ?? `${check.path} contains ${show(check.contains)}`
  if (actual === MISSING) return { label, ok: false, detail: `${check.path} is missing` }
  if (!Array.isArray(actual)) return { label, ok: false, detail: `${check.path} is not an array, got ${show(actual)}` }
  const ok = actual.some(item => includes(item, check.contains))
  return { label, ok, detail: ok ? '' : `no item of ${check.path} matches, got ${show(actual)}` }
}

/**
 * @param {EvalCheck[]} checks
 * @param {unknown} data - the run's final data
 * @param {unknown} start - the data the arm started from
 * @returns {CheckResult[]}
 */
export const runChecks = (checks, data, start) => checks.map(c => runCheck(c, data, start))
