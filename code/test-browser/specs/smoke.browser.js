import { test, expect } from '@playwright/test'
import { examples } from '../fixtures/examples.js'

for (const id of Object.keys(examples)) {
  test(`smoke: ${id} mounts without errors`, async ({ page }) => {
    const errors = []
    page.on('pageerror', (err) => errors.push(err.message))
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    await page.goto('/')
    await page.waitForFunction(() => window.__ready === true)

    const ex = examples[id]
    await page.evaluate(
      ([schema, data, opts]) => window.__mount(schema, data, opts),
      [ex.schema, ex.initialData, ex.layoutOptions]
    )

    // Editor actually rendered — cm-content is the contenteditable CM6 injects.
    await expect(page.locator('.cm-content').first()).toBeVisible()

    // Layout constructed; doc has non-empty JSON text.
    const sanity = await page.evaluate(() => ({
      hasLayout: !!window.__layout,
      hasView: !!window.__view,
      docLength: window.__view?.state.doc.length ?? 0,
      dataIsObject: typeof window.__layout?.data === 'object' && window.__layout?.data !== null
    }))
    expect(sanity).toEqual({ hasLayout: true, hasView: true, dataIsObject: true, docLength: expect.any(Number) })
    expect(sanity.docLength).toBeGreaterThan(0)

    expect(errors, `page errors during ${id} mount: ${errors.join('\n')}`).toEqual([])
  })
}
