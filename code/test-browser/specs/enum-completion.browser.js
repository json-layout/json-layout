import { test, expect } from '@playwright/test'
import { examples } from '../fixtures/examples.js'
import { setDocAndCursor, waitForCompletionLabels } from './_helpers.js'

test('basic: completion inside an empty enum string lists red/amber/green', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => window.__ready === true)

  const ex = examples.basic
  await page.evaluate(
    ([schema, data]) => window.__mount(schema, data),
    [ex.schema, ex.initialData]
  )

  // `{"color": ""}` — cursor between the two quotes (offset 11).
  await setDocAndCursor(page, '{"color": ""}', 11)
  await page.evaluate(() => window.__startCompletion())

  const labels = await waitForCompletionLabels(page)
  expect(labels).toEqual(expect.arrayContaining(['red', 'amber', 'green']))
})
