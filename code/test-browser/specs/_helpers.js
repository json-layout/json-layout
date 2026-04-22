/**
 * Spec helpers wrapping the window.__ harness surface. These run inside the
 * page via page.evaluate so they don't cross the serialization boundary more
 * than once per assertion.
 */

/**
 * Wait for the autocomplete plugin to reach "active" state. Runs the poll loop
 * inside the page so focus isn't lost between ticks — a common
 * autocomplete-vanishes-on-driver-context-switch flake.
 * @param {import('@playwright/test').Page} page
 * @param {number} [timeoutMs]
 * @returns {Promise<string[]>} labels, or a debug object if the wait timed out.
 */
export async function waitForCompletionLabels (page, timeoutMs = 3000) {
  return page.evaluate(async (budget) => {
    const start = Date.now()
    while (Date.now() - start < budget) {
      if (window.__completionStatus() === 'active') {
        return window.__currentCompletions().map((o) => o.label)
      }
      await new Promise((resolve) => setTimeout(resolve, 30))
    }
    return {
      __failure: true,
      finalStatus: window.__completionStatus(),
      doc: window.__view.state.doc.toString(),
      cursor: window.__view.state.selection.main.head,
      tooltips: document.querySelectorAll('.cm-tooltip').length
    }
  }, timeoutMs)
}

/**
 * Replace the entire document and park the cursor at `cursor`. Uses a single
 * transaction so the change + selection apply atomically.
 * @param {import('@playwright/test').Page} page
 * @param {string} doc
 * @param {number} cursor
 */
export async function setDocAndCursor (page, doc, cursor) {
  await page.evaluate(([text, pos]) => {
    const v = window.__view
    v.dispatch({
      changes: { from: 0, to: v.state.doc.length, insert: text },
      selection: { anchor: pos, head: pos }
    })
    v.focus()
  }, [doc, cursor])
}
