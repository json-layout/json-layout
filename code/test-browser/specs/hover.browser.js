import { test, expect } from '@playwright/test'
import { examples } from '../fixtures/examples.js'

test('basic: hover on color key surfaces the schema title and description', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => window.__ready === true)

  const ex = examples.basic
  await page.evaluate(
    ([schema, data]) => window.__mount(schema, data),
    [ex.schema, ex.initialData]
  )

  // Hover the character at doc position 4 (middle of "color"). Compute the
  // viewport coordinates from the CM6 view so we're not guessing at pixels.
  const coords = await page.evaluate(() => {
    const rect = window.__view.coordsAtPos(4)
    return { x: Math.round((rect.left + rect.right) / 2), y: Math.round((rect.top + rect.bottom) / 2) }
  })
  await page.mouse.move(coords.x, coords.y)

  const tooltip = page.locator('.cm-tooltip-hover').first()
  await expect(tooltip).toBeVisible({ timeout: 3000 })
  await expect(tooltip).toContainText('Colour')
  await expect(tooltip).toContainText('Which lamp is currently lit.')
})
