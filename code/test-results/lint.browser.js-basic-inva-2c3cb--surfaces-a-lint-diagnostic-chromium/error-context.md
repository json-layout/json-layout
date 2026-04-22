# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: lint.browser.js >> basic: invalid JSON surfaces a lint diagnostic
- Location: test-browser/specs/lint.browser.js:5:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('.cm-diagnostic').first()
Expected: visible
Timeout: 3000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 3000ms
  - waiting for locator('.cm-diagnostic').first()

```

# Page snapshot

```yaml
- textbox [active] [ref=e5]:
  - generic [ref=e6]: "{ color: red, }"
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test'
  2  | import { examples } from '../fixtures/examples.js'
  3  | import { setDocAndCursor } from './_helpers.js'
  4  | 
  5  | test('basic: invalid JSON surfaces a lint diagnostic', async ({ page }) => {
  6  |   await page.goto('/')
  7  |   await page.waitForFunction(() => window.__ready === true)
  8  | 
  9  |   const ex = examples.basic
  10 |   await page.evaluate(
  11 |     ([schema, data]) => window.__mount(schema, data),
  12 |     [ex.schema, ex.initialData]
  13 |   )
  14 | 
  15 |   // Replace with malformed JSON (trailing comma + unquoted key).
  16 |   await setDocAndCursor(page, '{ color: red, }', 15)
  17 | 
  18 |   // Linter runs on committed-path (debounced 250 ms). Allow some settle time.
  19 |   const diagnostic = page.locator('.cm-diagnostic').first()
> 20 |   await expect(diagnostic).toBeVisible({ timeout: 3000 })
     |                            ^ Error: expect(locator).toBeVisible() failed
  21 | })
  22 | 
```