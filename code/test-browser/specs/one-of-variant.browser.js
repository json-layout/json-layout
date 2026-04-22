import { test, expect } from '@playwright/test'
import { examples } from '../fixtures/examples.js'
import { setDocAndCursor, waitForCompletionLabels } from './_helpers.js'

test('one-of-variants: completion at payload value lists Text and Number variants', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => window.__ready === true)

  const ex = examples['one-of-variants']
  await page.evaluate(
    ([schema, data]) => window.__mount(schema, data),
    [ex.schema, ex.initialData]
  )

  // `{"payload": {}}` — cursor between the inner object's braces (offset 13).
  await setDocAndCursor(page, '{"payload": {}}', 13)
  await page.evaluate(() => window.__startCompletion())

  const labels = await waitForCompletionLabels(page)
  expect(labels).toEqual(expect.arrayContaining(['Text', 'Number']))
})
