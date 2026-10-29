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
