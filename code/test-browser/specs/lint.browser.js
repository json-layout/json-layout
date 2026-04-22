import { test, expect } from '@playwright/test'
import { examples } from '../fixtures/examples.js'
import { setDocAndCursor } from './_helpers.js'

test('basic: invalid JSON surfaces a lint diagnostic', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => window.__ready === true)

  const ex = examples.basic
  await page.evaluate(
    ([schema, data]) => window.__mount(schema, data),
    [ex.schema, ex.initialData]
  )

  // Replace with malformed JSON (trailing comma + unquoted key).
  await setDocAndCursor(page, '{ color: red, }', 15)

  // Linter runs on committed-path (debounced 250 ms). Allow some settle time.
  const diagnostic = page.locator('.cm-diagnostic').first()
  await expect(diagnostic).toBeVisible({ timeout: 3000 })
})
