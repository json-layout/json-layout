/**
 * @file Offline remote lists for an eval case.
 *
 * A case that declares `remote` answers every getItems URL from a fixture, so a run needs
 * no network and no live data-fair instance. Shared by every arm that fetches.
 */

/** @typedef {import('./cases/types.js').EvalCase} EvalCase */

/** Base the fixture URLs resolve against; the fixture only ever sees the path and query. */
export const FIXTURE_BASE_URL = 'http://eval.local/'

/**
 * The state layer's `fetch` option returns the parsed JSON body, not a Response, so
 * the fixture value is handed back as is.
 * @param {EvalCase} evalCase
 * @param {{ fetch?: Function }} [options] - used when the case has no fixture
 * @returns {((url: string, init?: RequestInit) => Promise<any>) | undefined}
 */
export function caseFetch (evalCase, options = {}) {
  const remote = evalCase.remote
  if (!remote) return /** @type {any} */ (options.fetch)
  return async (url) => {
    const value = remote(new URL(url, FIXTURE_BASE_URL))
    if (value === undefined) throw new Error(`404 Not Found: ${url}`)
    return value
  }
}

/**
 * The key a captured response is stored under: the path and the query, so the host does
 * not matter, with data-fair's `/data-fair` mount prefix dropped (a dataset's `href` is
 * absolute under it, the schemas' URLs are relative to it), the parameters sorted and
 * the empty ones dropped (an unfilled `q={q}`), so a URL an agent writes by hand finds
 * the response the form's own spelling of it was captured under.
 * @param {URL} url
 * @returns {string}
 */
export function remoteKey (url) {
  const path = url.pathname.replace(/^\/data-fair\//, '/')
  const params = [...url.searchParams].filter(([, value]) => value !== '')
    .sort(([a, va], [b, vb]) => a === b ? va.localeCompare(vb) : a.localeCompare(b))
  return params.length ? `${path}?${new URLSearchParams(params)}` : path
}
