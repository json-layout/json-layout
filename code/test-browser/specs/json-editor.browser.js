import { test, expect } from '@playwright/test'
import { examples } from '../fixtures/examples.js'

test('JsonEditor: mounts, exposes value, and reports parsed data via onData', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => window.__ready === true)

  const ex = examples.basic
  await page.evaluate(
    ([schema, data]) => window.__mountClass(schema, data),
    [ex.schema, ex.initialData]
  )

  // The class rendered a CodeMirror editor.
  await expect(page.locator('.cm-editor')).toBeVisible()

  // value getter returns the serialized initial data.
  const value = await page.evaluate(() => window.__editor.value)
  expect(value).toContain('"color"')

  // Edit to a different valid value; onData should fire with the parsed object.
  await page.evaluate(() => {
    const v = window.__editor._view
    v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: '{"color": "green"}' } })
  })
  await page.waitForFunction(() => window.__lastData && window.__lastData.color === 'green', null, { timeout: 4000 })
  const data = await page.evaluate(() => window.__editor.data)
  expect(data).toEqual({ color: 'green' })
})
