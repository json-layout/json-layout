# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: dynamic-get-items.browser.js >> get-items: dynamic completion lists country names from context
- Location: test-browser/specs/dynamic-get-items.browser.js:5:1

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

Expected: ArrayContaining ["France", "Germany", "Italy"]
Received: {"__failure": true, "cursor": 13, "doc": "{\"country\": \"\"}", "finalStatus": null, "tooltips": 0}
```

# Page snapshot

```yaml
- textbox [active] [ref=e5]:
  - generic [ref=e6]: "{\"country\": \"\"}"
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test'
  2  | import { examples } from '../fixtures/examples.js'
  3  | import { setDocAndCursor, waitForCompletionLabels } from './_helpers.js'
  4  | 
  5  | test('get-items: dynamic completion lists country names from context', async ({ page }) => {
  6  |   await page.goto('/')
  7  |   await page.waitForFunction(() => window.__ready === true)
  8  | 
  9  |   const ex = examples['get-items']
  10 |   await page.evaluate(
  11 |     ([schema, data, opts]) => window.__mount(schema, data, opts),
  12 |     [ex.schema, ex.initialData, ex.layoutOptions]
  13 |   )
  14 | 
  15 |   // `{"country": ""}` — cursor between the value quotes (offset 13). Let the
  16 |   // committed-path debounce settle (250 ms) before triggering completion.
  17 |   await setDocAndCursor(page, '{"country": ""}', 13)
  18 |   await page.waitForTimeout(350)
  19 |   await page.evaluate(() => window.__startCompletion())
  20 | 
  21 |   const labels = await waitForCompletionLabels(page, 4000)
> 22 |   expect(labels).toEqual(expect.arrayContaining(['France', 'Germany', 'Italy']))
     |                  ^ Error: expect(received).toEqual(expected) // deep equality
  23 | })
  24 | 
```