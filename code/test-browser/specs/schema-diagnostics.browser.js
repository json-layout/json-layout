import { test, expect } from '@playwright/test'
import { examples } from '../fixtures/examples.js'
import { setDocAndCursor } from './_helpers.js'

test('basic: out-of-enum value surfaces a schema diagnostic', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => window.__ready === true)

  const ex = examples.basic
  await page.evaluate(
    ([schema, data]) => window.__mount(schema, data),
    [ex.schema, ex.initialData]
  )

  // Syntactically valid, but "purple" is not in enum [red, amber, green].
  await setDocAndCursor(page, '{"color": "purple"}', 18)

  await page.waitForFunction(() => window.__diagnostics().length > 0, null, { timeout: 4000 })
  const diags = await page.evaluate(() => window.__diagnostics())
  expect(diags.length).toBeGreaterThan(0)
  expect(diags[0].severity).toBe('error')
  // The diagnostic is anchored to the /color value token, not offset 0.
  expect(diags[0].from).toBeGreaterThan(0)
})
