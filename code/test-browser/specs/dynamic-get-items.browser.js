import { test, expect } from '@playwright/test'
import { examples } from '../fixtures/examples.js'
import { setDocAndCursor, waitForCompletionLabels } from './_helpers.js'

test('get-items: dynamic completion lists country names from context', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => window.__ready === true)

  const ex = examples['get-items']
  await page.evaluate(
    ([schema, data, opts]) => window.__mount(schema, data, opts),
    [ex.schema, ex.initialData, ex.layoutOptions]
  )

  // `{"country": ""}` — cursor between the value quotes (offset 13). Let the
  // committed-path debounce settle (250 ms) before triggering completion.
  await setDocAndCursor(page, '{"country": ""}', 13)
  await page.waitForTimeout(350)
  await page.evaluate(() => window.__startCompletion())

  const labels = await waitForCompletionLabels(page, 4000)
  expect(labels).toEqual(expect.arrayContaining(['France', 'Germany', 'Italy']))
})
