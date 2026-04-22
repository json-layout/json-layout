# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: hover.browser.js >> basic: hover on color key surfaces the schema title and description
- Location: test-browser/specs/hover.browser.js:4:1

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: locator('.cm-tooltip-hover').first()
Expected substring: "Colour"
Received string:    "Traffic light"
Timeout: 5000ms

Call log:
  - Expect "toContainText" with timeout 5000ms
  - waiting for locator('.cm-tooltip-hover').first()
    9 × locator resolved to <div class="cm-tooltip-hover cm-tooltip cm-tooltip-above">…</div>
      - unexpected value "Traffic light"

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - textbox [ref=e5]:
    - generic [ref=e6]: "{"
    - generic [ref=e7]: "\"color\": \"red\""
    - generic [ref=e8]: "}"
  - generic [ref=e11]: Traffic light
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test'
  2  | import { examples } from '../fixtures/examples.js'
  3  | 
  4  | test('basic: hover on color key surfaces the schema title and description', async ({ page }) => {
  5  |   await page.goto('/')
  6  |   await page.waitForFunction(() => window.__ready === true)
  7  | 
  8  |   const ex = examples.basic
  9  |   await page.evaluate(
  10 |     ([schema, data]) => window.__mount(schema, data),
  11 |     [ex.schema, ex.initialData]
  12 |   )
  13 | 
  14 |   // Hover the character at doc position 4 (middle of "color"). Compute the
  15 |   // viewport coordinates from the CM6 view so we're not guessing at pixels.
  16 |   const coords = await page.evaluate(() => {
  17 |     const rect = window.__view.coordsAtPos(4)
  18 |     return { x: Math.round((rect.left + rect.right) / 2), y: Math.round((rect.top + rect.bottom) / 2) }
  19 |   })
  20 |   await page.mouse.move(coords.x, coords.y)
  21 | 
  22 |   const tooltip = page.locator('.cm-tooltip-hover').first()
  23 |   await expect(tooltip).toBeVisible({ timeout: 3000 })
> 24 |   await expect(tooltip).toContainText('Colour')
     |                         ^ Error: expect(locator).toContainText(expected) failed
  25 |   await expect(tooltip).toContainText('Which lamp is currently lit.')
  26 | })
  27 | 
```