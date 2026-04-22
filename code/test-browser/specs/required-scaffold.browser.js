import { test, expect } from '@playwright/test'
import { examples } from '../fixtures/examples.js'
import { setDocAndCursor, waitForCompletionLabels } from './_helpers.js'

test('required-nested: completion inside empty root object offers cfg scaffold', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => window.__ready === true)

  const ex = examples['required-nested']
  await page.evaluate(
    ([schema, data]) => window.__mount(schema, data),
    [ex.schema, ex.initialData]
  )

  // `{}` — cursor between the braces (offset 1).
  await setDocAndCursor(page, '{}', 1)
  await page.evaluate(() => window.__startCompletion())

  const labels = await waitForCompletionLabels(page)
  expect(labels).toEqual(expect.arrayContaining(['cfg']))
})
