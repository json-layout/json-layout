# Code Edition MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make schema validation diagnostics and value autocomplete genuinely work end-to-end in the `@json-layout/code` JSON editor, expose them through a turnkey `JsonEditor` class, and demonstrate them in the `doc/` app.

**Architecture:** The CM6 wiring already exists but three browser behaviors are broken. We fix them at the source: (1) collapse the committed path into a single `linter()` source that owns both syntax and schema diagnostics — eliminating the `setDiagnostics`/linter clobbering risk; (2) make value-completion ranges quote-aware so CM's fuzzy filter stops discarding string candidates; (3) resolve property help at key positions. Then we add a framework-agnostic `JsonEditor` class over `jsonLayoutExtensions()` and make the doc app wrap it.

**Tech Stack:** JavaScript + JSDoc, ESM, `node:test`, CodeMirror 6 (`@codemirror/*`, `@lezer/json`), `@json-layout/core`, Playwright (browser e2e), Nuxt 4 + Vue 3 + Vuetify (`doc/`).

**Spec:** `docs/superpowers/specs/2026-06-01-code-edition-mvp-design.md`

**Working directory for all `node --test` and `npx playwright` commands:** `/home/alban/github/json-layout/code` unless stated otherwise. The repo root is `/home/alban/github/json-layout`.

**Diagnosed root causes (reference while implementing):**
- *Lint:* `code/src/editor/extensions.js` installs `linter(null)` (a no-op placeholder). CM's real `jsonParseLinter()` was never wired, so syntactically invalid JSON produces zero diagnostics. The committed path dispatches `setDiagnostics` from a separate ViewPlugin, which would clobber/be clobbered by any pull-based linter. Fix: one `linter()` source owning both.
- *Enum + dynamic completion:* `computeCompletions` / `computeDynamicCompletions` compute the completion range with a regex word-scan (`VALUE_WORD_RE` includes `"`), so for `{"color": "|"}` the range `from` lands on the opening quote (offset 10). CM's autocomplete then filters `red/amber/green` against the query `"` and discards them all — the popup never activates. The existing unit test only checks option *labels*, not the range, so it passes while the browser fails. Fix: a quote-aware value token range + bare-string `apply`.
- *Hover:* `offsetToPath` at a key position returns the *enclosing object's* path with `at: 'key'`, so `getHelp` resolves the object's help instead of the hovered property's. Fix: expose the key name and resolve the property path in hover.

---

## Task 1: Single linter source owning syntax + schema diagnostics

**Files:**
- Create: `code/src/editor/lint.js`
- Modify: `code/src/editor/extensions.js`
- Modify: `code/src/editor/sync.js` (remove `runCommittedSync`, keep `syncStatefulLayoutData`)
- Delete: `code/src/editor/sync-plugin.js`
- Modify: `code/src/editor/index.js` (exports)
- Modify: `code/test/editor/barrel.spec.js` (expected symbols)
- Modify: `code/test/editor/sync.spec.js` (drop `runCommittedSync` block)
- Modify: `code/test-browser/mount.js` (expose `window.__diagnostics`)
- Modify: `code/test-browser/specs/lint.browser.js` (assert on lint state, not DOM class)
- Create: `code/test-browser/specs/schema-diagnostics.browser.js`

- [ ] **Step 1: Create the linter source**

Create `code/src/editor/lint.js`:

```js
/**
 * @file Single CM6 linter source for the committed path. Owns BOTH syntax
 * errors (via CM's jsonParseLinter) and schema errors (via StatefulLayout).
 * Replaces the old sync ViewPlugin + setDiagnostics + linter(null) trio so
 * there is exactly one writer of the lint state — no clobbering.
 *
 * On every (debounced) lint run:
 *   1. If the JSON is syntactically invalid, return ONLY the syntax error and
 *      leave StatefulLayout frozen at its last good state.
 *   2. Otherwise parse, push the parsed value into StatefulLayout (which runs
 *      AJV + expressions), notify `onData`, and return the resolved schema
 *      diagnostics mapped to text ranges.
 */

import { linter } from '@codemirror/lint'
import { jsonParseLinter } from '@codemirror/lang-json'
import { collectDiagnostics } from '../shared/diagnostics.js'
import { jsonFormatAdapter } from '../json/adapter.js'
import { statefulLayoutField } from './stateful-layout-field.js'

/** @typedef {import('@codemirror/view').EditorView} EditorView */
/** @typedef {import('@codemirror/lint').Diagnostic} Diagnostic */

const DEBOUNCE_MS = 250
const syntaxLinter = jsonParseLinter()

/**
 * Build the json-layout linter extension.
 * @param {((data: unknown) => void)} [onData] — called with the parsed value
 *   after each successful committed sync (used by the JsonEditor class / doc app
 *   to avoid polling).
 * @returns {import('@codemirror/state').Extension}
 */
export function jsonLayoutLinter (onData) {
  return linter((view) => {
    const syntax = syntaxLinter(view)
    if (syntax.length) return syntax

    const statefulLayout = view.state.field(statefulLayoutField, false)
    if (!statefulLayout) return []

    const text = view.state.doc.toString()
    /** @type {unknown} */
    let parsed
    try {
      parsed = jsonFormatAdapter.parse(text)
    } catch {
      return []
    }
    statefulLayout.data = parsed
    if (onData) onData(statefulLayout.data)

    return /** @type {Diagnostic[]} */(collectDiagnostics(statefulLayout, text, jsonFormatAdapter))
  }, { delay: DEBOUNCE_MS })
}
```

- [ ] **Step 2: Rewrite `extensions.js` to use the linter and accept `onData`**

Replace the entire body of `code/src/editor/extensions.js` with:

```js
/**
 * @file CM6 extension factory for @json-layout/code. Composes the fast-path
 * wiring (JSON language, CompiledLayout StateField, schema-driven completion
 * and hover) and, when a StatefulLayout is passed, the committed-path wiring
 * (StatefulLayout StateField + the single json-layout linter that owns syntax
 * and schema diagnostics and feeds dynamic completion).
 */

import { autocompletion } from '@codemirror/autocomplete'
import { hoverTooltip } from '@codemirror/view'
import { jsonFormatAdapter } from '../json/adapter.js'
import { compiledLayoutField } from './compiled-layout-field.js'
import { statefulLayoutField } from './stateful-layout-field.js'
import { jsonLayoutLinter } from './lint.js'
import { jsonLayoutCompletion, jsonLayoutDynamicCompletion } from './completion.js'
import { jsonLayoutHover } from './hover.js'

/** @typedef {import('@json-layout/core').CompiledLayout} CompiledLayout */
/** @typedef {import('@json-layout/core').StatefulLayout} StatefulLayout */
/** @typedef {import('@codemirror/state').Extension} Extension */
/** @typedef {import('@codemirror/autocomplete').CompletionSource} CompletionSource */

/**
 * Build the CM6 extension array for a JSON-layout-backed editor. Pass a
 * `StatefulLayout` in `options` to activate the committed path (live schema
 * diagnostics + dynamic completion); omit it for fast-path only.
 * @param {CompiledLayout} compiledLayout
 * @param {{ statefulLayout?: StatefulLayout, onData?: (data: unknown) => void }} [options]
 * @returns {Extension[]}
 */
export function jsonLayoutExtensions (compiledLayout, options) {
  const statefulLayout = options?.statefulLayout
  /** @type {CompletionSource[]} */
  const completionSources = [jsonLayoutCompletion]
  if (statefulLayout) completionSources.push(jsonLayoutDynamicCompletion)

  /** @type {Extension[]} */
  const extensions = [
    jsonFormatAdapter.language,
    compiledLayoutField.init(() => compiledLayout),
    autocompletion({ override: completionSources }),
    hoverTooltip(jsonLayoutHover)
  ]

  if (statefulLayout) {
    extensions.push(
      statefulLayoutField.init(() => statefulLayout),
      jsonLayoutLinter(options?.onData)
    )
  }

  return extensions
}
```

- [ ] **Step 3: Trim `sync.js` to just the data helper**

Replace the entire body of `code/src/editor/sync.js` with (this drops `runCommittedSync` — the linter now owns diagnostics — and keeps `syncStatefulLayoutData`, which `sync.spec.js` still covers):

```js
/**
 * @file Pure helper for the committed path: apply a parsed buffer to a
 * StatefulLayout. Kept separate from the linter so the parse/freeze semantics
 * are unit-testable with no DOM.
 */

/** @typedef {import('@json-layout/core').StatefulLayout} StatefulLayout */
/** @typedef {import('../json/types.js').FormatAdapter} FormatAdapter */

/**
 * Try to parse `text` and assign it as the root data of `statefulLayout`.
 * Returns `true` on success, `false` on parse error (in which case
 * `statefulLayout.data` is left untouched — "freeze at last good").
 * @param {StatefulLayout} statefulLayout
 * @param {FormatAdapter} formatAdapter
 * @param {string} text
 * @returns {boolean}
 */
export function syncStatefulLayoutData (statefulLayout, formatAdapter, text) {
  /** @type {unknown} */
  let parsed
  try {
    parsed = formatAdapter.parse(text)
  } catch {
    return false
  }
  statefulLayout.data = parsed
  return true
}
```

- [ ] **Step 4: Delete the obsolete sync plugin**

Run: `git rm code/src/editor/sync-plugin.js`

- [ ] **Step 5: Update editor barrel exports**

Replace the entire body of `code/src/editor/index.js` with:

```js
export { jsonLayoutExtensions } from './extensions.js'
export { compiledLayoutField, setCompiledLayoutEffect } from './compiled-layout-field.js'
export { statefulLayoutField, setStatefulLayoutEffect } from './stateful-layout-field.js'
export { jsonLayoutLinter } from './lint.js'
export { syncStatefulLayoutData } from './sync.js'
export {
  computeCompletions,
  jsonLayoutCompletion,
  computeDynamicCompletions,
  jsonLayoutDynamicCompletion
} from './completion.js'
export { computeHover, jsonLayoutHover } from './hover.js'
```

- [ ] **Step 6: Update the barrel smoke test for the new symbol set**

In `code/test/editor/barrel.spec.js`, replace the `expectedEditorSymbols` array (lines 6–21) with:

```js
const expectedEditorSymbols = [
  'jsonLayoutExtensions',
  'compiledLayoutField',
  'setCompiledLayoutEffect',
  'statefulLayoutField',
  'setStatefulLayoutEffect',
  'jsonLayoutLinter',
  'syncStatefulLayoutData',
  'computeCompletions',
  'jsonLayoutCompletion',
  'computeDynamicCompletions',
  'jsonLayoutDynamicCompletion',
  'computeHover',
  'jsonLayoutHover'
]
```

- [ ] **Step 7: Drop the `runCommittedSync` tests from `sync.spec.js`**

In `code/test/editor/sync.spec.js`:
- Change the import on line 8 from `import { syncStatefulLayoutData, runCommittedSync } from '../../src/editor/sync.js'` to `import { syncStatefulLayoutData } from '../../src/editor/sync.js'`.
- Delete the unused imports that only the removed block used: remove line 3 (`import { EditorState } from '@codemirror/state'`), remove line 6 (`import { compiledLayoutField } from '../../src/editor/compiled-layout-field.js'`), remove line 7 (`import { statefulLayoutField } from '../../src/editor/stateful-layout-field.js'`), and remove line 9 (`import { setDiagnosticsEffect } from '@codemirror/lint'`).
- Delete the entire `describe('runCommittedSync', ...)` block (lines 44–133).

Keep the `describe('syncStatefulLayoutData', ...)` block and its imports (`compile`, `StatefulLayout`, `jsonFormatAdapter`) unchanged.

- [ ] **Step 8: Run the unit suite — expect green**

Run: `node --test 'test/**/*.spec.js'`
Expected: PASS, 0 failures (the barrel + sync specs reflect the new surface; `extensions.spec.js` still passes — it never referenced the removed symbols).

- [ ] **Step 9: Expose a diagnostics reader in the browser harness**

In `code/test-browser/mount.js`:
- Add `forEachDiagnostic` to the lint import. Change line 14's autocomplete import region by adding a new import after it:

```js
import { forEachDiagnostic } from '@codemirror/lint'
```

- Inside `mount`, after the existing `window.__computeCompletions = ...` assignment (around line 73), add:

```js
  window.__diagnostics = () => {
    /** @type {Array<{from:number,to:number,message:string,severity:string}>} */
    const out = []
    forEachDiagnostic(view.state, (d) => out.push({ from: d.from, to: d.to, message: d.message, severity: d.severity }))
    return out
  }
```

- [ ] **Step 10: Rewrite the lint e2e to assert on lint state (robust)**

`jsonParseLinter` reports a zero-width range, so a `.cm-diagnostic`/`.cm-lintRange` DOM assertion is flaky. Replace the entire body of `code/test-browser/specs/lint.browser.js` with:

```js
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

  // Malformed JSON (unquoted key + trailing comma).
  await setDocAndCursor(page, '{ color: red, }', 15)

  // Linter is debounced (250 ms); wait until the lint state holds a diagnostic.
  await page.waitForFunction(() => window.__diagnostics().length > 0, null, { timeout: 4000 })
  const diags = await page.evaluate(() => window.__diagnostics())
  expect(diags.length).toBeGreaterThan(0)
})
```

- [ ] **Step 11: Add the schema-diagnostics e2e (valid JSON, schema violation)**

Create `code/test-browser/specs/schema-diagnostics.browser.js`:

```js
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
  // The diagnostic is anchored to the /color value token, not offset 0.
  expect(diags[0].from).toBeGreaterThan(0)
})
```

- [ ] **Step 12: Run the two diagnostics e2e — expect green**

Run: `npx playwright test test-browser/specs/lint.browser.js test-browser/specs/schema-diagnostics.browser.js --config=test-browser/playwright.config.js`
Expected: 2 passed.

- [ ] **Step 13: Commit**

```bash
git add code/src/editor/lint.js code/src/editor/extensions.js code/src/editor/sync.js code/src/editor/index.js code/test/editor/barrel.spec.js code/test/editor/sync.spec.js code/test-browser/mount.js code/test-browser/specs/lint.browser.js code/test-browser/specs/schema-diagnostics.browser.js
git add -u code/src/editor/sync-plugin.js
git commit -m "fix(code): surface syntax + schema diagnostics via single linter source"
```

---

## Task 2: Quote-aware value completion (fixes enum + dynamic completion)

**Files:**
- Modify: `code/src/json/parser.js` (add `valueTokenAt`)
- Modify: `code/src/json/adapter.js` (export it)
- Modify: `code/src/json/types.ts` (`FormatAdapter` interface)
- Modify: `code/src/editor/completion.js` (use it in both completion paths)
- Modify: `code/test/parser.spec.js` (unit test for `valueTokenAt`)
- Modify: `code/test/editor/completion.spec.js` (assert range + apply, not just labels)

- [ ] **Step 1: Write the failing unit test for the completion range**

Add to `code/test/editor/completion.spec.js`, inside the `describe('computeCompletions', ...)` block (e.g. after the existing enum test at line 40):

```js
  it('places the completion range INSIDE the string quotes with bare apply text', async () => {
    const doc = '{"color": ""}'
    const state = await stateFor(doc, {
      type: 'object',
      properties: { color: { type: 'string', enum: ['red', 'green', 'blue'] } }
    })
    // Cursor between the two value quotes.
    const result = computeCompletions(state, 11, false)
    assert.ok(result, 'expected completions at /color value position')
    // Range must start AFTER the opening quote (offset 11), not on it (10) —
    // otherwise CM filters every candidate against the query '"'.
    assert.equal(result.from, 11)
    assert.equal(result.to, 11)
    const red = result.options.find((o) => o.label === 'red')
    assert.ok(red, 'red candidate missing')
    // Inside a string the apply text is the bare value, not a JSON literal.
    assert.equal(red.apply, 'red')
  })
```

- [ ] **Step 2: Run it — expect failure**

Run: `node --test test/editor/completion.spec.js`
Expected: FAIL — `result.from` is `10` (the opening quote) and `red.apply` is `"red"` (JSON literal).

- [ ] **Step 3: Add `valueTokenAt` to the parser**

In `code/src/json/parser.js`, add this exported function at the end of the file (it reuses the existing `smallestEnclosing` and `VALUE_TYPES`):

```js
/**
 * Locate the value token enclosing `offset` and report the range a value
 * completion should replace, plus whether that token is a quoted string.
 *
 * For a String token the range is the INTERIOR (between the quotes) so a
 * completion replaces the string contents without disturbing the quotes — and
 * so CM's fuzzy filter matches candidate labels against the typed contents
 * rather than against a leading `"`. For other scalar tokens (Number/True/
 * False/Null) the range is the whole token. Returns null at structural
 * positions (inside an Object/Array but not on a leaf value), where the caller
 * falls back to a word-range scan.
 * @param {string} text
 * @param {number} offset
 * @returns {{ from: number, to: number, quoted: boolean } | null}
 */
export function valueTokenAt (text, offset) {
  if (typeof text !== 'string' || typeof offset !== 'number') return null
  const tree = lezerJsonParser.parse(text)
  /** @type {import('@lezer/common').SyntaxNode | null} */
  let node = smallestEnclosing(tree.topNode, offset)
  while (node && !VALUE_TYPES.has(node.name)) node = node.parent
  if (!node) return null
  if (node.name === 'Object' || node.name === 'Array') return null
  if (node.name === 'String') return { from: node.from + 1, to: node.to - 1, quoted: true }
  return { from: node.from, to: node.to, quoted: false }
}
```

- [ ] **Step 4: Export `valueTokenAt` from the adapter**

In `code/src/json/adapter.js`:
- Change the parser import (line 6) to include `valueTokenAt`:

```js
import { parse, pathToRange, offsetToPath, valueTokenAt } from './parser.js'
```

- Add `valueTokenAt` to the adapter object (after `offsetToPath,` on line 18):

```js
  valueTokenAt,
```

- [ ] **Step 5: Add `valueTokenAt` to the `FormatAdapter` interface**

In `code/src/json/types.ts`, add this method to the `FormatAdapter` interface (after the `offsetToPath` line):

```ts
  valueTokenAt(text: string, offset: number): { from: number, to: number, quoted: boolean } | null
```

- [ ] **Step 6: Use the quote-aware range in `computeCompletions`**

In `code/src/editor/completion.js`:

Replace `valueCompletion` (lines 68–74) with a quote-aware version:

```js
/**
 * @param {CompletionCandidate} v
 * @param {boolean} quoted — true when the cursor sits inside a JSON string, so
 *   the apply text must be the bare value (the quotes already exist) rather
 *   than a JSON literal.
 * @returns {Completion}
 */
function valueCompletion (v, quoted) {
  const apply = quoted && typeof v.value === 'string' ? v.value : JSON.stringify(v.value)
  return { label: v.title, apply, type: 'enum' }
}
```

Replace the value branch at the end of `computeCompletions` (lines 136–143) with:

```js
  const normalized = lookupNormalizedLayout(compiledLayout, loc.path)
  const valueCandidates = getValueCandidates(normalized)
  const variants = getVariantCandidates(compiledLayout, loc.path)
  if (!valueCandidates.length && !variants.length) return null

  const token = jsonFormatAdapter.valueTokenAt(text, pos)
  const range = token ?? wordRangeAt(state, pos, VALUE_WORD_RE)
  const quoted = token ? token.quoted : false

  /** @type {Completion[]} */
  const options = []
  for (const v of valueCandidates) options.push(valueCompletion(v, quoted))
  for (const v of variants) options.push(variantCompletion(v))
  return { from: range.from, to: range.to, options }
```

- [ ] **Step 7: Use the same range in `computeDynamicCompletions`**

In `code/src/editor/completion.js`, replace the tail of `computeDynamicCompletions` (lines 170–174) with:

```js
  const candidates = await getDynamicCandidates(statefulLayout, loc.path)
  if (!candidates.length) return null

  const token = jsonFormatAdapter.valueTokenAt(text, pos)
  const range = token ?? wordRangeAt(state, pos, VALUE_WORD_RE)
  const quoted = token ? token.quoted : false
  return { from: range.from, to: range.to, options: candidates.map((c) => valueCompletion(c, quoted)) }
```

- [ ] **Step 8: Run the completion unit tests — expect green**

Run: `node --test test/editor/completion.spec.js`
Expected: PASS — including the new range/apply test. The existing variant test (`{"value": {}}`) still passes because `valueTokenAt` returns null at the Object position and the word-range fallback keeps the prior behavior.

- [ ] **Step 9: Add a `valueTokenAt` unit test**

Add to `code/test/parser.spec.js` a new `describe` block (place it after the existing top-level imports/blocks):

```js
describe('valueTokenAt', () => {
  it('returns the interior range of an empty string with quoted=true', () => {
    // {"color": ""}  — offset 11 is between the value quotes (10..12).
    assert.deepEqual(valueTokenAt('{"color": ""}', 11), { from: 11, to: 11, quoted: true })
  })

  it('returns the interior range of a non-empty string', () => {
    // {"color": "red"}  — String spans 10..15, interior 11..14.
    assert.deepEqual(valueTokenAt('{"color": "red"}', 12), { from: 11, to: 14, quoted: true })
  })

  it('returns the whole token for a number with quoted=false', () => {
    // {"n": 42}  — Number spans 6..8.
    assert.deepEqual(valueTokenAt('{"n": 42}', 7), { from: 6, to: 8, quoted: false })
  })

  it('returns null at a structural (empty object) position', () => {
    assert.equal(valueTokenAt('{ }', 1), null)
  })
})
```

Ensure `code/test/parser.spec.js` imports `valueTokenAt` — add it to the existing import from `../src/json/parser.js` (the file already imports `offsetToPath`/`pathToRange`; append `, valueTokenAt`). If `describe`/`assert` are not already imported at the top of the file, add `import { describe, it } from 'node:test'` and `import { strict as assert } from 'node:assert'`.

- [ ] **Step 10: Run the parser unit tests — expect green**

Run: `node --test test/parser.spec.js`
Expected: PASS.

- [ ] **Step 11: Run the enum + dynamic completion e2e — expect green**

Run: `npx playwright test test-browser/specs/enum-completion.browser.js test-browser/specs/dynamic-get-items.browser.js --config=test-browser/playwright.config.js`
Expected: 2 passed. (Both shared the quoted-range root cause; the dynamic test relies on the linter having synced data within its 350 ms settle window — the linter's 250 ms delay covers this.)

- [ ] **Step 12: Run the still-passing completion e2e to confirm no regression**

Run: `npx playwright test test-browser/specs/one-of-variant.browser.js test-browser/specs/required-scaffold.browser.js --config=test-browser/playwright.config.js`
Expected: 2 passed.

- [ ] **Step 13: Commit**

```bash
git add code/src/json/parser.js code/src/json/adapter.js code/src/json/types.ts code/src/editor/completion.js code/test/parser.spec.js code/test/editor/completion.spec.js
git commit -m "fix(code): make value completion ranges quote-aware so enum/dynamic candidates show"
```

---

## Task 3: Hover resolves property help at key positions

**Files:**
- Modify: `code/src/json/parser.js` (`offsetToPath` returns `key`)
- Modify: `code/src/json/types.ts` (`OffsetLocation` key variant)
- Modify: `code/src/editor/hover.js` (resolve property path at key)
- Modify: `code/test/parser.spec.js` (assert `key` at key positions)

- [ ] **Step 1: Write the failing unit test for the key name**

Add to `code/test/parser.spec.js`, inside whichever `describe` covers `offsetToPath` (or add a new `describe('offsetToPath key name', ...)`):

```js
describe('offsetToPath key name', () => {
  it('reports the key name at a property-name position', () => {
    // {"color": "red"}  — offset 3 is inside the "color" key token (1..8).
    const loc = offsetToPath('{"color": "red"}', 3)
    assert.ok(loc)
    assert.equal(loc.at, 'key')
    assert.equal(loc.path, '')
    assert.equal(loc.key, 'color')
  })
})
```

- [ ] **Step 2: Run it — expect failure**

Run: `node --test test/parser.spec.js`
Expected: FAIL — `loc.key` is `undefined`.

- [ ] **Step 3: Return the key name from `offsetToPath`**

In `code/src/json/parser.js`, replace the PropertyName branch in `offsetToPath` (lines 186–193) with:

```js
  // Key position: cursor inside a PropertyName.
  if (deepest.name === 'PropertyName') {
    const property = deepest.parent
    const obj = property?.parent
    if (obj) {
      const pathToObj = buildPathTo(obj, text)
      const key = unquote(text.slice(deepest.from, deepest.to))
      return { path: pathToObj, at: 'key', key }
    }
  }
```

- [ ] **Step 4: Add `key` to the `OffsetLocation` type**

In `code/src/json/types.ts`, replace the `OffsetLocation` union (lines 8–11) with:

```ts
export type OffsetLocation =
  | { path: string, at: 'key', key: string }
  | { path: string, at: 'value' }
  | { path: string, at: 'structural' }
```

- [ ] **Step 5: Run the parser unit test — expect green**

Run: `node --test test/parser.spec.js`
Expected: PASS.

- [ ] **Step 6: Resolve the property path in hover**

In `code/src/editor/hover.js`, replace the body of `computeHover` (lines 65–84) with:

```js
export function computeHover (state, pos) {
  const compiledLayout = state.field(compiledLayoutField, false)
  if (!compiledLayout) return null

  const text = state.doc.toString()
  const loc = jsonFormatAdapter.offsetToPath(text, pos)
  if (!loc) return null

  // At a key position, loc.path is the enclosing OBJECT — resolve help for the
  // property under the cursor, not for its parent object.
  const helpPath = loc.at === 'key'
    ? (loc.path === '' ? `/${loc.key}` : `${loc.path}/${loc.key}`)
    : loc.path

  const info = getHelp(compiledLayout, helpPath)
  if (!hasAnyText(info)) return null

  const range = jsonFormatAdapter.pathToRange(text, helpPath)
  const end = range ? range.to : pos
  return {
    pos,
    end,
    above: true,
    create: createDomFactory(/** @type {HelpInfo} */(info))
  }
}
```

- [ ] **Step 7: Run the full unit suite — expect green**

Run: `node --test 'test/**/*.spec.js'`
Expected: PASS, 0 failures.

- [ ] **Step 8: Run the hover e2e — expect green**

Run: `npx playwright test test-browser/specs/hover.browser.js --config=test-browser/playwright.config.js`
Expected: 1 passed (tooltip shows "Colour" + description when hovering the `color` key).

- [ ] **Step 9: Commit**

```bash
git add code/src/json/parser.js code/src/json/types.ts code/src/editor/hover.js code/test/parser.spec.js
git commit -m "fix(code): resolve property help on hover at key positions"
```

---

## Task 4: Turnkey `JsonEditor` class

**Files:**
- Modify: `code/package.json` (add `@codemirror/commands`)
- Create: `code/src/editor/json-editor.js`
- Modify: `code/src/editor/index.js` (export `JsonEditor`)
- Modify: `code/test/editor/barrel.spec.js` (expect `JsonEditor`)
- Modify: `code/test-browser/mount.js` (expose `window.__mountClass`)
- Create: `code/test-browser/specs/json-editor.browser.js`

- [ ] **Step 1: Add the commands dependency**

In `code/package.json`, add to `"dependencies"` (keep alphabetical-ish ordering near the other `@codemirror/*` entries):

```json
    "@codemirror/commands": "^6.6.0",
```

Then run (from the repo root `/home/alban/github/json-layout`): `npm install`
Expected: lockfile updates, no errors.

- [ ] **Step 2: Create the `JsonEditor` class**

Create `code/src/editor/json-editor.js`:

```js
/**
 * @file Turnkey, framework-agnostic JSON editor. Thin wrapper over
 * jsonLayoutExtensions(): compiles the schema, builds a StatefulLayout, mounts
 * a CodeMirror EditorView with a basic editing setup, and exposes a small
 * imperative API. Hosts that want full control should use jsonLayoutExtensions
 * directly instead.
 */

import { EditorView, lineNumbers, keymap } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { lintGutter, forEachDiagnostic } from '@codemirror/lint'
import { compile, StatefulLayout } from '@json-layout/core'
import { jsonLayoutExtensions } from './extensions.js'

/** @typedef {import('@codemirror/state').Extension} Extension */
/** @typedef {import('@codemirror/lint').Diagnostic} Diagnostic */

/**
 * @typedef {object} JsonEditorOptions
 * @property {object} schema — JSON Schema to compile.
 * @property {unknown} [data] — initial data (defaults to null).
 * @property {object} [statefulLayoutOptions] — merged into the StatefulLayout
 *   options (e.g. `{ context: {...} }` for getItems expressions).
 * @property {Extension} [theme] — optional CM6 theme extension.
 * @property {(data: unknown) => void} [onData] — called after each committed
 *   sync with the parsed data.
 * @property {(text: string) => void} [onText] — called on every doc change.
 */

export class JsonEditor {
  /**
   * @param {HTMLElement} parent
   * @param {JsonEditorOptions} options
   */
  constructor (parent, options) {
    /** @type {HTMLElement} */
    this._parent = parent
    /** @type {JsonEditorOptions} */
    this._options = options
    /** @type {EditorView | null} */
    this._view = null
    /** @type {StatefulLayout | null} */
    this._statefulLayout = null
    /** @type {unknown} */
    this._data = options.data ?? null
    /**
     * Resolves once the editor is mounted. Construction is async (compile is
     * async) so consumers that need the StatefulLayout must await this.
     * @type {Promise<JsonEditor>}
     */
    this.whenReady = this._init()
  }

  /** @returns {Promise<JsonEditor>} */
  async _init () {
    const compiledLayout = await compile(/** @type {any} */(this._options.schema))
    const statefulLayout = new StatefulLayout(
      compiledLayout,
      compiledLayout.skeletonTrees[compiledLayout.mainTree],
      { debounceInputMs: 0, initialValidation: 'always', ...this._options.statefulLayoutOptions },
      this._data
    )
    this._statefulLayout = statefulLayout

    const initialText = JSON.stringify(this._data, null, 2)
    /** @type {Extension[]} */
    const setup = [
      lineNumbers(),
      history(),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      lintGutter(),
      EditorView.updateListener.of((update) => {
        if (update.docChanged && this._options.onText) this._options.onText(update.state.doc.toString())
      })
    ]
    if (this._options.theme) setup.push(this._options.theme)

    this._view = new EditorView({
      parent: this._parent,
      state: EditorState.create({
        doc: initialText,
        extensions: [
          ...setup,
          ...jsonLayoutExtensions(compiledLayout, {
            statefulLayout,
            onData: (data) => {
              this._data = data
              if (this._options.onData) this._options.onData(data)
            }
          })
        ]
      })
    })
    return this
  }

  /** @returns {string} current editor text */
  get value () {
    return this._view ? this._view.state.doc.toString() : ''
  }

  /** @param {string} v */
  set value (v) {
    if (!this._view) return
    this._view.dispatch({ changes: { from: 0, to: this._view.state.doc.length, insert: v } })
  }

  /** @returns {unknown} last-committed parsed data (frozen-at-last-good while invalid) */
  get data () {
    return this._data
  }

  /** @returns {StatefulLayout | null} escape hatch for advanced consumers */
  get statefulLayout () {
    return this._statefulLayout
  }

  /** @returns {Diagnostic[]} current diagnostics from the lint state */
  get diagnostics () {
    /** @type {Diagnostic[]} */
    const out = []
    if (this._view) forEachDiagnostic(this._view.state, (d) => out.push(d))
    return out
  }

  focus () {
    if (this._view) this._view.focus()
  }

  destroy () {
    if (this._view) {
      this._view.destroy()
      this._view = null
    }
  }
}
```

- [ ] **Step 3: Export `JsonEditor` from the barrels**

In `code/src/editor/index.js`, add at the end:

```js
export { JsonEditor } from './json-editor.js'
```

(The root barrel `code/src/index.js` re-exports `./editor/index.js` via `export *`, so no change is needed there.)

- [ ] **Step 4: Add `JsonEditor` to the barrel smoke test**

In `code/test/editor/barrel.spec.js`, add `'JsonEditor'` to the `expectedEditorSymbols` array (append after `'jsonLayoutHover'`).

- [ ] **Step 5: Run the unit suite — expect green**

Run: `node --test 'test/**/*.spec.js'`
Expected: PASS (barrel test now asserts `JsonEditor` is exported).

- [ ] **Step 6: Add a class-mounting entry to the browser harness**

In `code/test-browser/mount.js`:
- Add `JsonEditor` to the `@json-layout/code` import (line 16):

```js
import { jsonLayoutExtensions, computeCompletions, JsonEditor } from '@json-layout/code'
```

- After `window.__mount = mount` (line 78), add:

```js
/**
 * Mount the turnkey JsonEditor class (rather than raw extensions) so e2e can
 * exercise the public class surface. Resolves once the editor is ready.
 * @param {object} schema
 * @param {unknown} data
 * @param {object} [statefulLayoutOptions]
 */
async function mountClass (schema, data, statefulLayoutOptions) {
  if (window.__editor) {
    window.__editor.destroy()
    host.innerHTML = ''
  }
  const editor = new JsonEditor(host, {
    schema,
    data,
    statefulLayoutOptions,
    onData: (d) => { window.__lastData = d }
  })
  await editor.whenReady
  window.__editor = editor
  window.__view = editor._view
  await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)))
}

window.__mountClass = mountClass
```

- [ ] **Step 7: Add the JsonEditor e2e**

Create `code/test-browser/specs/json-editor.browser.js`:

```js
import { test, expect } from '@playwright/test'
import { examples } from '../fixtures/examples.js'

test('JsonEditor: mounts, exposes value, and reports parsed data via onData', async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => window.__ready === true)

  const ex = examples.basic
  await page.evaluate(
    ([schema, data]) => window.__mountClass(schema, data),
    [ex.schema, ex.initialData]
  )

  // The class rendered a CodeMirror editor.
  await expect(page.locator('.cm-editor')).toBeVisible()

  // value getter returns the serialized initial data.
  const value = await page.evaluate(() => window.__editor.value)
  expect(value).toContain('"color"')

  // Edit to a different valid value; onData should fire with the parsed object.
  await page.evaluate(() => {
    const v = window.__editor._view
    v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: '{"color": "green"}' } })
  })
  await page.waitForFunction(() => window.__lastData && window.__lastData.color === 'green', null, { timeout: 4000 })
  const data = await page.evaluate(() => window.__editor.data)
  expect(data).toEqual({ color: 'green' })
})
```

- [ ] **Step 8: Run the JsonEditor e2e — expect green**

Run: `npx playwright test test-browser/specs/json-editor.browser.js --config=test-browser/playwright.config.js`
Expected: 1 passed.

- [ ] **Step 9: Commit**

```bash
git add code/package.json code/src/editor/json-editor.js code/src/editor/index.js code/test/editor/barrel.spec.js code/test-browser/mount.js code/test-browser/specs/json-editor.browser.js
git add ../package-lock.json
git commit -m "feat(code): add turnkey JsonEditor class over jsonLayoutExtensions"
```

---

## Task 5: Doc app wraps `JsonEditor` and fixes the get-items example

**Files:**
- Rewrite: `doc/components/JsonEditor.vue`
- Modify: `doc/pages/examples/[id].vue`
- Modify: `doc/examples/index.js` (fix the broken get-items example)

Background: `doc/components/JsonEditor.vue` currently re-implements the extension wiring and polls `statefulLayout.data` on a 120 ms timer. We replace it with a thin wrapper over the `JsonEditor` class using its `onData`/`onText` callbacks. The class owns compilation, so `[id].vue` stops compiling and receives the `StatefulLayout` back through a `ready` event (the `Inspector` needs it). The `get-items` example currently uses `getItems: ['France', ...]`, an array form the vocabulary does not accept (see `code/test-browser/fixtures/examples.js:82`); we switch it to a context expression matching the working browser fixture.

- [ ] **Step 1: Fix the get-items example to a dynamic context expression**

In `doc/examples/index.js`, replace the `get-items` example object (lines 105–126) with:

```js
  {
    id: 'get-items',
    title: 'Dynamic getItems',
    summary: 'Async completion via the committed path.',
    schema: {
      type: 'object',
      properties: {
        country: {
          type: 'string',
          title: 'Country',
          layout: {
            getItems: 'options.context.countries'
          }
        }
      }
    },
    initialData: { country: '' },
    statefulLayoutOptions: {
      context: { countries: ['France', 'Germany', 'Italy', 'Spain', 'Portugal'] }
    },
    teachingNotes: [
      'Place the cursor inside the empty `country` value and open completion. Candidates flow through the committed path (250ms debounce).',
      'After a short pause you should see France/Germany/Italy/Spain/Portugal in the completion menu.'
    ]
  }
```

Also extend the `Example` typedef (around line 8–16) to document the new optional field — add this line inside the typedef block:

```js
 * @property {object} [statefulLayoutOptions] — merged into StatefulLayout options (e.g. context for getItems).
```

- [ ] **Step 2: Rewrite the doc `JsonEditor.vue` to wrap the class**

Replace the entire contents of `doc/components/JsonEditor.vue` with:

```vue
<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { oneDark } from '@codemirror/theme-one-dark'
import { JsonEditor } from '@json-layout/code'

const props = defineProps({
  schema: { type: Object, required: true },
  initialData: { type: null, required: true },
  statefulLayoutOptions: { type: Object, default: () => ({}) }
})

const emit = defineEmits(['update:text', 'update:data', 'ready'])

const host = ref(/** @type {HTMLElement | null} */(null))
/** @type {JsonEditor | null} */
let editor = null

onMounted(async () => {
  if (!host.value) return
  editor = new JsonEditor(host.value, {
    schema: props.schema,
    data: props.initialData,
    statefulLayoutOptions: props.statefulLayoutOptions,
    theme: oneDark,
    onText: (text) => emit('update:text', text),
    onData: (data) => emit('update:data', data)
  })
  await editor.whenReady
  emit('ready', editor.statefulLayout)
})

onBeforeUnmount(() => {
  if (editor) {
    editor.destroy()
    editor = null
  }
})
</script>

<template>
  <div
    ref="host"
    class="jl-editor"
    data-testid="json-editor"
  />
</template>

<style scoped>
.jl-editor {
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 4px;
  min-height: 240px;
  font-family: 'Fira Code', 'Menlo', monospace;
  font-size: 13px;
}
.jl-editor :deep(.cm-editor) {
  min-height: 240px;
}
.jl-editor :deep(.cm-content) {
  padding: 8px 0;
}
</style>
```

- [ ] **Step 3: Update the example page to use the wrapper's new contract**

Replace the entire contents of `doc/pages/examples/[id].vue` with:

```vue
<script setup>
import { ref, shallowRef } from 'vue'
import { useRoute } from 'vue-router'
import examples from '~/examples/index.js'

const route = useRoute()
const example = examples.find((e) => e.id === route.params.id)
if (!example) {
  throw createError({ statusCode: 404, statusMessage: `Unknown example: ${route.params.id}` })
}

const initialText = JSON.stringify(example.initialData, null, 2)
const statefulLayout = shallowRef(null)
const liveData = ref(example.initialData)
const liveText = ref(initialText)

function onReady (sl) {
  statefulLayout.value = sl
}

function onUpdateText (text) {
  liveText.value = text
}

function onUpdateData (data) {
  liveData.value = data
}
</script>

<template>
  <v-row>
    <v-col cols="12">
      <h2 class="text-h5 mb-2">
        {{ example.title }}
      </h2>
      <ul class="mb-4">
        <li v-for="note in example.teachingNotes" :key="note">
          {{ note }}
        </li>
      </ul>
    </v-col>

    <v-col cols="12" md="7">
      <ClientOnly>
        <JsonEditor
          :key="example.id"
          :schema="example.schema"
          :initial-data="example.initialData"
          :stateful-layout-options="example.statefulLayoutOptions || {}"
          @ready="onReady"
          @update:text="onUpdateText"
          @update:data="onUpdateData"
        />
        <template #fallback>
          <div data-testid="editor-loading">
            Loading editor…
          </div>
        </template>
      </ClientOnly>
    </v-col>

    <v-col cols="12" md="5">
      <ClientOnly>
        <Inspector
          v-if="statefulLayout"
          :key="example.id"
          :data="liveData"
          :stateful-layout="statefulLayout"
          :text="liveText"
        />
      </ClientOnly>
    </v-col>
  </v-row>
</template>
```

- [ ] **Step 4: Verify the doc app builds**

Run (from the repo root `/home/alban/github/json-layout`): `npm run build -w code && npm run lint -w doc`
Expected: `code` builds (emits `types/`); `doc` lint passes. (A full `nuxt build` is slow and SSR-gated; lint + the e2e harness using the same class are sufficient signal for MVP. If a manual smoke is wanted: `npm run dev -w doc` and open `/examples/get-items`.)

- [ ] **Step 5: Commit**

```bash
git add doc/components/JsonEditor.vue doc/pages/examples/[id].vue doc/examples/index.js
git commit -m "feat(doc): wrap turnkey JsonEditor class and fix dynamic getItems example"
```

---

## Task 6: Full quality gate

**Files:** none (verification only), plus checking off the spec.

- [ ] **Step 1: Run the full workspace quality suite**

Run (from the repo root `/home/alban/github/json-layout`): `npm run quality`
Expected: lint → build → test all pass across `vocabulary`, `core`, `examples`, `code`. 0 failures.

If lint flags the modified `code` files (e.g. unused imports left after Task 1's deletions), fix them as reported and re-run.

- [ ] **Step 2: Run the full browser e2e suite — expect all green**

Run (from `/home/alban/github/json-layout/code`): `npm run test:browser`
Expected: all tests pass (the 6 previously-passing + the 4 now-fixed: lint, enum, dynamic, hover + the 2 new: schema-diagnostics, json-editor = 12 passing, 0 failing).

- [ ] **Step 3: Update the spec's Definition of Done**

The MVP is verified. No code change — confirm against `docs/superpowers/specs/2026-06-01-code-edition-mvp-design.md` "Definition of Done":
- All e2e green incl. new schema-diagnostics e2e ✓
- `JsonEditor` class shipped + doc app wraps it ✓
- Unit tests green ✓
- `npm run quality` passes ✓
- Hover e2e green (bonus) ✓

- [ ] **Step 4: Final commit (if any quality fixups were made)**

```bash
git add -A
git commit -m "chore(code): quality fixups for code-edition MVP"
```

---

## Self-Review

**Spec coverage:**
- Workstream 1 (validation) → Task 1 (syntax via `jsonParseLinter`, schema via `collectDiagnostics`, single linter source, new schema-diagnostics e2e). ✓
- Workstream 2 (autocomplete) → Task 2 (quote-aware range fixes enum + dynamic). ✓
- Workstream 3 (turnkey class) → Task 4 (`JsonEditor`) + Task 5 (doc app wraps it). ✓
- Workstream 4 (doc demo) → Task 5 (wrapper + fixed get-items example). ✓
- Secondary (hover) → Task 3. ✓
- Cut features (inline widgets, slots, modified gutter, multi-format) → not implemented; `JsonEditor` intentionally omits `setSavedData`/`modified`. ✓
- Risk "two diagnostic sources coexisting" → resolved by collapsing into one linter (Task 1). ✓
- Risk "data-change notification / polling" → resolved by `onData` (Task 1 extensions + Task 4 class + Task 5 doc app). ✓
- Risk "empty-string completion classification" → Task 2 `valueTokenAt`. ✓
- Risk "dynamic completion timing" → Task 2 Step 11 note (linter 250 ms < test 350 ms settle). ✓
- Definition of Done → Task 6. ✓

**Type/name consistency:** `jsonLayoutLinter(onData)` defined in Task 1 and consumed in `extensions.js` (Task 1) and indirectly by the class (Task 4). `valueTokenAt(text, offset) → { from, to, quoted } | null` defined in parser (Task 2 Step 3), declared in `FormatAdapter` (Task 2 Step 5), consumed in completion (Task 2 Steps 6–7). `OffsetLocation` key variant gains `key: string` (Task 3 Step 4) and is produced by `offsetToPath` (Task 3 Step 3) and consumed by hover (Task 3 Step 6). `JsonEditor` API (`value`/`data`/`statefulLayout`/`diagnostics`/`focus`/`destroy`/`whenReady`/`onData`/`onText`) is consistent between class (Task 4) and doc wrapper (Task 5). Barrel symbol list updated in lockstep across Tasks 1 and 4.

**Placeholder scan:** No TBD/TODO/"handle edge cases"/"similar to". Every code step shows full content. The only non-literal step is Task 5 Step 4's optional manual `npm run dev` smoke, which is explicitly optional and not a gate.
