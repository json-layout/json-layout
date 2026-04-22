# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: enum-completion.browser.js >> basic: completion inside an empty enum string lists red/amber/green
- Location: test-browser/specs/enum-completion.browser.js:5:1

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

Expected: ArrayContaining ["red", "amber", "green"]
Received: {"__failure": true, "cursor": 11, "doc": "{\"color\": \"\"}", "finalStatus": null, "tooltips": 0}
```

# Page snapshot

```yaml
- textbox [active] [ref=e5]:
  - generic [ref=e6]: "{\"color\": \"\"}"
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test'
  2  | import { examples } from '../fixtures/examples.js'
  3  | import { setDocAndCursor, waitForCompletionLabels } from './_helpers.js'
  4  | 
  5  | test('basic: completion inside an empty enum string lists red/amber/green', async ({ page }) => {
  6  |   await page.goto('/')
  7  |   await page.waitForFunction(() => window.__ready === true)
  8  | 
  9  |   const ex = examples.basic
  10 |   await page.evaluate(
  11 |     ([schema, data]) => window.__mount(schema, data),
  12 |     [ex.schema, ex.initialData]
  13 |   )
  14 | 
  15 |   // `{"color": ""}` — cursor between the two quotes (offset 11).
  16 |   await setDocAndCursor(page, '{"color": ""}', 11)
  17 |   await page.evaluate(() => window.__startCompletion())
  18 | 
  19 |   const labels = await waitForCompletionLabels(page)
> 20 |   expect(labels).toEqual(expect.arrayContaining(['red', 'amber', 'green']))
     |                  ^ Error: expect(received).toEqual(expected) // deep equality
  21 | })
  22 | 
```