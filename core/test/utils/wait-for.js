/**
 * @file Wait for a condition instead of guessing how long it takes.
 *
 * The lists-get-items suite used to sleep 10ms after triggering a getItems fetch and
 * assume the response had landed. That holds on an idle machine and fails under load:
 * `node --test` runs the spec files in parallel, so the full suite failed roughly one run
 * in five while the same file passed every time on its own.
 */

/**
 * @param {() => boolean | Promise<boolean>} condition
 * @param {{ timeout?: number, interval?: number, what?: string }} [options]
 * @returns {Promise<void>}
 */
export async function waitFor (condition, options = {}) {
  const { timeout = 2000, interval = 1, what = 'condition' } = options
  const start = Date.now()
  while (!(await condition())) {
    if (Date.now() - start > timeout) {
      throw new Error(`timed out after ${timeout}ms waiting for ${what}`)
    }
    await new Promise((resolve) => setTimeout(resolve, interval))
  }
}

/**
 * @param {import('../../src/index.js').StateNode} node
 * @returns {boolean}
 */
const isLoading = (node) => node.loading === true || (node.children ?? []).some(isLoading)

/**
 * Wait until no node in the tree is still fetching its items. This is the condition every
 * sleep in the getItems specs was standing in for: the request has come back and the
 * state tree has been rebuilt around the response.
 * @param {import('../../src/index.js').StatefulLayout} statefulLayout
 * @param {{ timeout?: number, interval?: number }} [options]
 * @returns {Promise<void>}
 */
export function waitForSettled (statefulLayout, options = {}) {
  return waitFor(() => !isLoading(statefulLayout.stateTree.root), {
    ...options,
    what: 'the form to finish loading its items'
  })
}
