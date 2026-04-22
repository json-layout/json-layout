# Code Edition — CM6 Extension Factory + Fast-Path Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the CM6 extension factory (`jsonLayoutExtensions(compiledLayout)`) plus the two fast-path features that never need a `StatefulLayout` — schema-driven completion and hover tooltips. After this plan, a host can construct a CodeMirror 6 JSON editor whose content assist offers value/property/variant candidates and whose hover tooltip shows title/description/help — all from the `CompiledLayout` alone, without running expression evaluation or the debounced sync loop.

**Architecture:** New subfolder `code/src/editor/` holds CM6 wiring, parallel to `json/` (format adapter) and `shared/` (format-agnostic primitives). The JSON `FormatAdapter` grows its `language: LanguageSupport` field (deferred from Plan 2). A small CM6 `StateField` carries the `CompiledLayout` so completion and hover sources can read it off `state.field(...)`. The extension factory returns a flat `Extension[]` wiring: the JSON language, the StateField, an `autocompletion({ override: [...] })` with our completion source, and a `hoverTooltip(...)` with our hover source. Each source is split into a *pure* computation (`computeCompletions(state, pos, explicit)`, `computeHover(state, pos)`) that takes only `EditorState` + position — trivially testable in Node without a DOM — and a thin CM6 wrapper. Committed-path features (StatefulLayout sync, diagnostics linter, dynamic completion) are deliberately out of scope.

**Tech Stack:** Plain JS + JSDoc, `@codemirror/state`/`view`/`language`/`autocomplete`, `@codemirror/lang-json`, Node's built-in test runner. No DOM in tests.

**Spec:** `docs/superpowers/specs/2026-04-21-code-edition-design.md` — sections *"Public API"*, *"Completion"* (leaf value + property name + oneOf/anyOf scaffold + required-object scaffold), *"Help / description"*, and the *"Fast path"* half of *"Two-tier execution"*.

**Depends on:**
- Plan 1 (core exposures): `resolveSkeletonNode`, `lookupNormalizedLayout`, `scaffoldDefault`.
- Plan 2 (JSON adapter): `parse`, `pathToRange`, `offsetToPath`, `scaffold`, `insertProperty`, `jsonFormatAdapter`.
- Plan 3 (shared primitives): `getValueCandidates`, `getPropertyCandidates`, `getVariantCandidates`, `getHelp`. (`getDynamicCandidates` and `collectDiagnostics` exist but are deferred to Plan 5 — this plan does not consume them.)

**Out of scope for this plan** (Plan 5 and later):
- `StatefulLayout` sync loop (debounced parse → `statefulLayout.data = ...`, freeze-at-last-good-on-syntax-error).
- `@codemirror/lint` wiring with `collectDiagnostics`.
- Dynamic completion (`getDynamicCandidates`) — needs a live `StatefulLayout`.
- Inline widgets, slot mechanism, `JsonEditor` class, `doc/` app, modified gutter.

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `code/package.json` | Modify | Add CM6 deps: `@codemirror/state`, `@codemirror/view`, `@codemirror/language`, `@codemirror/autocomplete`, `@codemirror/lang-json` |
| `code/src/json/types.ts` | Modify | Add `language: LanguageSupport` to the `FormatAdapter` interface |
| `code/src/json/adapter.js` | Modify | Set `language: json()` on `jsonFormatAdapter` |
| `code/src/editor/compiled-layout-field.js` | Create | CM6 `StateField<CompiledLayout>` + its `setCompiledLayoutEffect` |
| `code/src/editor/completion.js` | Create | `computeCompletions(state, pos, explicit)` + `jsonLayoutCompletion(context)` CM6 wrapper |
| `code/src/editor/hover.js` | Create | `computeHover(state, pos)` + `jsonLayoutHover(view, pos, side)` CM6 wrapper |
| `code/src/editor/extensions.js` | Create | `jsonLayoutExtensions(compiledLayout): Extension[]` — assembles the above |
| `code/src/editor/index.js` | Create | Barrel exposing the public surface |
| `code/src/index.js` | Modify | `export * from './editor/index.js'` |
| `code/test/editor/compiled-layout-field.spec.js` | Create | StateField initializes + updates via effect |
| `code/test/editor/completion.spec.js` | Create | `computeCompletions` correctness for key/value/variant positions |
| `code/test/editor/hover.spec.js` | Create | `computeHover` correctness (returns tooltip descriptor with expected `pos`/`above` when info present; null otherwise) |
| `code/test/editor/extensions.spec.js` | Create | `jsonLayoutExtensions` returns a usable `Extension[]`; `EditorState.create` with it reads back the compiled layout and activates the JSON language |
| `code/test/json/language.spec.js` | Create | `jsonFormatAdapter.language` is a `LanguageSupport` that parses JSON |

All source files are plain JS with JSDoc types; `types.ts` continues to be the one TS file for shared interfaces, per the Plan 2 / Plan 3 precedent.

---

### Task 1: CM6 dependencies + `language` on JSON adapter

**Files:**
- Modify: `code/package.json`
- Modify: `code/src/json/types.ts`
- Modify: `code/src/json/adapter.js`
- Create: `code/test/json/language.spec.js`

Rationale: the adapter's `language` field was deferred in Plan 2 ("minus the CM6 `language` field, which arrives in a later plan together with the editor extensions"). Now is that later plan. Landing the dep + the field before any `editor/` code means all subsequent tasks can import CM6 freely.

- [ ] **Step 1: Add CM6 deps to `code/package.json`**

Modify `code/package.json`. The current `dependencies` block is:

```json
  "dependencies": {
    "@json-layout/core": "^2.7.1",
    "@lezer/json": "^1.0.3"
  }
```

Replace it with:

```json
  "dependencies": {
    "@codemirror/autocomplete": "^6.18.0",
    "@codemirror/lang-json": "^6.0.1",
    "@codemirror/language": "^6.10.0",
    "@codemirror/state": "^6.4.0",
    "@codemirror/view": "^6.26.0",
    "@json-layout/core": "^2.7.1",
    "@lezer/json": "^1.0.3"
  }
```

Rationale for these specific version ranges: current CM6 releases at time of writing. `@lezer/json` is already a dep and stays unchanged. These are regular `dependencies` (not peerDependencies) because `@json-layout/code` owns a coherent CM6 experience; host apps dedupe via npm's resolution and the version ranges are permissive (`^`) so a host pinning newer minor versions still works.

- [ ] **Step 2: Install**

Run from repo root: `npm install`
Expected: succeeds; `node_modules/@codemirror/*` populates; `package-lock.json` updates.

- [ ] **Step 3: Add `language` field to `FormatAdapter` type**

Modify `code/src/json/types.ts`. Current content:

```typescript
export interface Range {
  from: number
  to: number
}

export type OffsetLocation =
  | { path: string, at: 'key' }
  | { path: string, at: 'value' }
  | { path: string, at: 'structural' }

export interface IndentOptions {
  column: number
  unit: string
}

export interface InsertOp {
  from: number
  to: number
  insert: string
}

export interface FormatAdapter {
  parse(text: string): unknown
  pathToRange(text: string, path: string): Range | null
  offsetToPath(text: string, offset: number): OffsetLocation | null
  scaffold(value: unknown, indent: IndentOptions): string
  insertProperty(text: string, objectPath: string, name: string, value: unknown): InsertOp
}
```

Replace the `FormatAdapter` block at the end with:

```typescript
import type { LanguageSupport } from '@codemirror/language'

export interface FormatAdapter {
  language: LanguageSupport
  parse(text: string): unknown
  pathToRange(text: string, path: string): Range | null
  offsetToPath(text: string, offset: number): OffsetLocation | null
  scaffold(value: unknown, indent: IndentOptions): string
  insertProperty(text: string, objectPath: string, name: string, value: unknown): InsertOp
}
```

(The `import type` line goes at the top of the file above the interfaces — move it there to keep the file's style: imports-first, types-after.)

- [ ] **Step 4: Write failing test for the `language` field**

Create `code/test/json/language.spec.js`:

```javascript
import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { LanguageSupport } from '@codemirror/language'
import { jsonFormatAdapter } from '../../src/json/adapter.js'

describe('jsonFormatAdapter.language', () => {
  it('is a LanguageSupport instance', () => {
    assert.ok(jsonFormatAdapter.language instanceof LanguageSupport)
  })

  it('exposes the JSON parser via language.parser', () => {
    const parser = jsonFormatAdapter.language.language.parser
    assert.ok(parser, 'language.parser must exist')
    const tree = parser.parse('{"a": 1}')
    assert.ok(tree, 'parser must parse JSON text')
    // Sanity: the top node should have a name of "JsonText" (the @lezer/json top node).
    assert.equal(tree.topNode.name, 'JsonText')
  })
})
```

- [ ] **Step 5: Run to verify failure**

Run: `node --test code/test/json/language.spec.js`
Expected: FAIL — `jsonFormatAdapter.language` is `undefined`, so `instanceof LanguageSupport` is false.

- [ ] **Step 6: Add `language` to the JSON adapter**

Modify `code/src/json/adapter.js`. Current content:

```javascript
/**
 * @file Assembles the JSON FormatAdapter export.
 */

import { parse, pathToRange, offsetToPath } from './parser.js'
import { scaffold } from './scaffold.js'
import { insertProperty } from './insert-property.js'

/** @typedef {import('./types.js').FormatAdapter} FormatAdapter */

/** @type {FormatAdapter} */
export const jsonFormatAdapter = {
  parse,
  pathToRange,
  offsetToPath,
  scaffold,
  insertProperty
}
```

Replace with:

```javascript
/**
 * @file Assembles the JSON FormatAdapter export.
 */

import { json } from '@codemirror/lang-json'
import { parse, pathToRange, offsetToPath } from './parser.js'
import { scaffold } from './scaffold.js'
import { insertProperty } from './insert-property.js'

/** @typedef {import('./types.js').FormatAdapter} FormatAdapter */

/** @type {FormatAdapter} */
export const jsonFormatAdapter = {
  language: json(),
  parse,
  pathToRange,
  offsetToPath,
  scaffold,
  insertProperty
}
```

- [ ] **Step 7: Run tests**

Run: `node --test code/test/json/language.spec.js`
Expected: Both tests PASS.

Run: `npm test -w code`
Expected: 82 (Plan 3) + 2 new = 84 tests pass.

- [ ] **Step 8: Commit**

```bash
git add code/package.json package-lock.json code/src/json/types.ts code/src/json/adapter.js code/test/json/language.spec.js
git commit -m "feat(code): add CM6 deps and language field to JSON FormatAdapter"
```

---

### Task 2: `editor/compiled-layout-field.js` — CM6 StateField holding CompiledLayout

**Files:**
- Create: `code/src/editor/compiled-layout-field.js`
- Create: `code/test/editor/compiled-layout-field.spec.js`

Semantic contract:
- Export `compiledLayoutField: StateField<CompiledLayout | null>` — initial value `null`.
- Export `setCompiledLayoutEffect: StateEffectType<CompiledLayout>` — used to set the field value via a transaction effect.
- When a transaction includes the effect, the field updates to the effect's value. Otherwise the field keeps its current value.

Rationale: fast-path features read `state.field(compiledLayoutField)` on every keystroke. We use a StateField (not a Facet) because the value is settable via effect — the extension factory initializes the field via `init(() => compiledLayout)` on `EditorState.create`, and hosts can replace it later without rebuilding the whole state.

- [ ] **Step 1: Write failing tests**

Create `code/test/editor/compiled-layout-field.spec.js`:

```javascript
import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { EditorState } from '@codemirror/state'
import { compile } from '@json-layout/core'
import { compiledLayoutField, setCompiledLayoutEffect } from '../../src/editor/compiled-layout-field.js'

describe('compiledLayoutField', () => {
  it('defaults to null when unconfigured', () => {
    const state = EditorState.create({
      extensions: [compiledLayoutField]
    })
    assert.equal(state.field(compiledLayoutField), null)
  })

  it('initializes to a value via .init()', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: { a: { type: 'string' } }
    })
    const state = EditorState.create({
      extensions: [compiledLayoutField.init(() => compiledLayout)]
    })
    assert.equal(state.field(compiledLayoutField), compiledLayout)
  })

  it('updates when a transaction includes setCompiledLayoutEffect', async () => {
    const a = await compile({ type: 'object', properties: { a: { type: 'string' } } })
    const b = await compile({ type: 'object', properties: { b: { type: 'integer' } } })
    const initial = EditorState.create({
      extensions: [compiledLayoutField.init(() => a)]
    })
    const next = initial.update({ effects: setCompiledLayoutEffect.of(b) }).state
    assert.equal(next.field(compiledLayoutField), b)
  })

  it('preserves the value across unrelated transactions', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: { a: { type: 'string' } }
    })
    const state = EditorState.create({
      doc: '{}',
      extensions: [compiledLayoutField.init(() => compiledLayout)]
    })
    const after = state.update({ changes: { from: 0, to: 0, insert: ' ' } }).state
    assert.equal(after.field(compiledLayoutField), compiledLayout)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test code/test/editor/compiled-layout-field.spec.js`
Expected: FAIL — module `.../compiled-layout-field.js` not found.

- [ ] **Step 3: Implement the state field**

Create `code/src/editor/compiled-layout-field.js`:

```javascript
/**
 * @file CM6 StateField + StateEffect carrying the CompiledLayout on an
 * EditorState. Read via `state.field(compiledLayoutField)`; update via a
 * transaction with `setCompiledLayoutEffect.of(compiledLayout)`.
 */

import { StateEffect, StateField } from '@codemirror/state'

/** @typedef {import('@json-layout/core').CompiledLayout} CompiledLayout */

/** @type {import('@codemirror/state').StateEffectType<CompiledLayout>} */
export const setCompiledLayoutEffect = StateEffect.define()

/** @type {import('@codemirror/state').StateField<CompiledLayout | null>} */
export const compiledLayoutField = StateField.define({
  create () { return null },
  update (value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setCompiledLayoutEffect)) return effect.value
    }
    return value
  }
})
```

- [ ] **Step 4: Run tests**

Run: `node --test code/test/editor/compiled-layout-field.spec.js`
Expected: All 4 tests PASS.

Run: `npm test -w code`
Expected: 84 + 4 = 88 tests pass.

- [ ] **Step 5: Commit**

```bash
git add code/src/editor/compiled-layout-field.js code/test/editor/compiled-layout-field.spec.js
git commit -m "feat(code): add compiledLayoutField CM6 StateField"
```

---

### Task 3: `editor/extensions.js` — `jsonLayoutExtensions(compiledLayout)` factory (minimum viable)

**Files:**
- Create: `code/src/editor/extensions.js`
- Create: `code/src/editor/index.js`
- Create: `code/test/editor/extensions.spec.js`

Rationale: give the factory a skeleton that later tasks grow. At this point it wires the language + the state field only; Tasks 4 & 5 add completion and hover respectively.

- [ ] **Step 1: Write failing tests**

Create `code/test/editor/extensions.spec.js`:

```javascript
import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { EditorState } from '@codemirror/state'
import { compile } from '@json-layout/core'
import { jsonLayoutExtensions } from '../../src/editor/extensions.js'
import { compiledLayoutField } from '../../src/editor/compiled-layout-field.js'

describe('jsonLayoutExtensions', () => {
  it('returns an array of extensions', async () => {
    const compiledLayout = await compile({ type: 'object', properties: { a: { type: 'string' } } })
    const extensions = jsonLayoutExtensions(compiledLayout)
    assert.ok(Array.isArray(extensions))
    assert.ok(extensions.length > 0)
  })

  it('EditorState.create reads the compiled layout back via the field', async () => {
    const compiledLayout = await compile({ type: 'object', properties: { a: { type: 'string' } } })
    const state = EditorState.create({
      doc: '{"a": "hi"}',
      extensions: jsonLayoutExtensions(compiledLayout)
    })
    assert.equal(state.field(compiledLayoutField), compiledLayout)
  })

  it('activates the JSON language (state.doc parses via the configured parser)', async () => {
    const compiledLayout = await compile({ type: 'object', properties: { a: { type: 'string' } } })
    const state = EditorState.create({
      doc: '{"a": 1}',
      extensions: jsonLayoutExtensions(compiledLayout)
    })
    // syntaxTree() is the idiomatic way to check language activation.
    const { syntaxTree } = await import('@codemirror/language')
    const tree = syntaxTree(state)
    assert.equal(tree.topNode.name, 'JsonText')
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test code/test/editor/extensions.spec.js`
Expected: FAIL — module `.../extensions.js` not found.

- [ ] **Step 3: Implement the factory (minimum viable)**

Create `code/src/editor/extensions.js`:

```javascript
/**
 * @file CM6 extension factory for @json-layout/code. Fast-path wiring:
 * JSON language, CompiledLayout StateField. Completion and hover are
 * wired in subsequent tasks in this plan.
 */

import { jsonFormatAdapter } from '../json/adapter.js'
import { compiledLayoutField } from './compiled-layout-field.js'

/** @typedef {import('@json-layout/core').CompiledLayout} CompiledLayout */
/** @typedef {import('@codemirror/state').Extension} Extension */

/**
 * Build the CM6 extension array for a JSON-layout-backed editor. The passed
 * `compiledLayout` is carried on the EditorState via a StateField and read
 * by completion and hover sources on every keystroke.
 * @param {CompiledLayout} compiledLayout
 * @returns {Extension[]}
 */
export function jsonLayoutExtensions (compiledLayout) {
  return [
    jsonFormatAdapter.language,
    compiledLayoutField.init(() => compiledLayout)
  ]
}
```

- [ ] **Step 4: Create the editor barrel**

Create `code/src/editor/index.js`:

```javascript
export { jsonLayoutExtensions } from './extensions.js'
export { compiledLayoutField, setCompiledLayoutEffect } from './compiled-layout-field.js'
```

(Intentionally not re-exported from `code/src/index.js` yet — that happens in Task 6 alongside the other `editor/` symbols so the root barrel lands in one commit.)

- [ ] **Step 5: Run tests**

Run: `node --test code/test/editor/extensions.spec.js`
Expected: All 3 tests PASS.

Run: `npm test -w code`
Expected: 88 + 3 = 91 tests pass.

- [ ] **Step 6: Commit**

```bash
git add code/src/editor/extensions.js code/src/editor/index.js code/test/editor/extensions.spec.js
git commit -m "feat(code): add jsonLayoutExtensions factory wiring language + StateField"
```

---

### Task 4: `editor/completion.js` — schema-driven completion source

**Files:**
- Create: `code/src/editor/completion.js`
- Modify: `code/src/editor/extensions.js` (add `autocompletion` wiring)
- Modify: `code/src/editor/index.js` (expose `computeCompletions` + `jsonLayoutCompletion`)
- Create: `code/test/editor/completion.spec.js`

Semantic contract:
- Pure function `computeCompletions(state, pos, explicit) → CompletionResult | null`.
  - `state`: `EditorState` carrying the `compiledLayoutField`.
  - `pos`: current cursor position.
  - `explicit`: `boolean` — user pressed the keybinding (vs. auto-trigger). v1 returns `null` when the position yields no fast-path candidates regardless of this flag, but the argument is forwarded for symmetry with CM's API.
- CM6 wrapper `jsonLayoutCompletion(context) → context.state.doc` consumer that forwards to `computeCompletions`.
- Dispatch by `offsetToPath(text, pos).at`:
  - `'key'` → property-name candidates at the enclosing object (from `getPropertyCandidates`). `existingKeys` is derived from the current object's already-present keys parsed via `jsonFormatAdapter.parse(text)` (catch syntax errors and pass `undefined` to fall back to "no filter").
  - `'value'` → concat of `getValueCandidates(lookupNormalizedLayout(...))` and `getVariantCandidates(...)`.
  - `'structural'` → property-name candidates at the enclosing object (same as `'key'`). This handles the common "cursor inside empty object or between properties" case.
- When dispatch yields no candidates, returns `null`.
- `CompletionResult.from` is the token start (we use `offsetToPath` + the Lezer tree via `syntaxTree(state)` to find the enclosing token's `from`/`to`). For v1 we keep this simple: use the current word boundary — `context.matchBefore(/[\w"']*/)` or its explicit equivalent. Implementation details in Step 3.

Apply shape (also v1-simple):
- For `PropertyCandidate`: `label: name`, `type: 'property'`, `apply: '"' + name + '": ' + JSON.stringify(defaultValue)` when `defaultValue !== undefined`, else `apply: '"' + name + '": '`.
- For `CompletionCandidate` at a value position: `label: title`, `type: 'value'` or `'enum'`, `apply: JSON.stringify(value)`.
- For `VariantCandidate`: `label: title`, `type: 'class'`, `apply: JSON.stringify(value, null, 2)` (scaffolded objects can be multi-line; CM handles indent via the language's indent-on-new-line).

These shapes are deliberately minimal — they give correct behavior for the common cases and defer fancier context-aware apply strategies (reusing `insertProperty`, re-flowing indent, etc.) to a later plan.

- [ ] **Step 1: Write failing tests**

Create `code/test/editor/completion.spec.js`:

```javascript
import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { EditorState } from '@codemirror/state'
import { compile } from '@json-layout/core'
import { computeCompletions } from '../../src/editor/completion.js'
import { compiledLayoutField } from '../../src/editor/compiled-layout-field.js'
import { jsonLayoutExtensions } from '../../src/editor/extensions.js'

/**
 * Small helper: make an EditorState with the given doc and plan-4 extensions.
 * @param {string} doc
 * @param {unknown} schema
 */
async function stateFor (doc, schema) {
  const compiledLayout = await compile(/** @type {any} */(schema))
  return EditorState.create({
    doc,
    extensions: jsonLayoutExtensions(compiledLayout)
  })
}

describe('computeCompletions', () => {
  it('returns null when no compiled layout is on the state', () => {
    const state = EditorState.create({
      doc: '{}',
      extensions: [compiledLayoutField]
    })
    assert.equal(computeCompletions(state, 1, true), null)
  })

  it('returns enum value candidates at a value position', async () => {
    const doc = '{"color": ""}'
    // pos 11 is inside the empty string value of "color" (between the two quotes).
    const state = await stateFor(doc, {
      type: 'object',
      properties: { color: { type: 'string', enum: ['red', 'green', 'blue'] } }
    })
    const result = computeCompletions(state, 11, false)
    assert.ok(result, 'expected completions at /color value position')
    const labels = result.options.map((o) => o.label)
    assert.deepEqual(labels, ['red', 'green', 'blue'])
  })

  it('returns property-name candidates at a key position', async () => {
    const doc = '{"":""}'
    // pos 2 is inside the empty property-name (at the key position).
    const state = await stateFor(doc, {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string' },
        age: { type: 'integer' }
      }
    })
    const result = computeCompletions(state, 2, false)
    assert.ok(result, 'expected completions at key position')
    const labels = result.options.map((o) => o.label).sort()
    assert.deepEqual(labels, ['age', 'name'])
  })

  it('returns property-name candidates at a structural position in an empty object', async () => {
    const doc = '{ }'
    // pos 1 is inside an empty object (structural — between braces with whitespace).
    const state = await stateFor(doc, {
      type: 'object',
      properties: { a: { type: 'string' } }
    })
    const result = computeCompletions(state, 1, false)
    assert.ok(result, 'expected completions at structural position')
    const labels = result.options.map((o) => o.label)
    assert.deepEqual(labels, ['a'])
  })

  it('returns variant candidates at a oneOf value position', async () => {
    const doc = '{"value": {}}'
    // pos 11 is inside the inner empty object (value position for /value).
    const state = await stateFor(doc, {
      type: 'object',
      required: ['value'],
      properties: {
        value: {
          oneOf: [
            { title: 'Alpha', type: 'object', required: ['a'], properties: { a: { type: 'string', default: 'A' } } },
            { title: 'Beta', type: 'object', required: ['b'], properties: { b: { type: 'integer', default: 1 } } }
          ]
        }
      }
    })
    const result = computeCompletions(state, 11, false)
    assert.ok(result, 'expected variant candidates at /value position')
    const titles = result.options.map((o) => o.label)
    // Variants are added in childrenTrees order.
    assert.ok(titles.includes('Alpha'))
    assert.ok(titles.includes('Beta'))
  })

  it('filters out existing keys at a key position', async () => {
    const doc = '{"a": 1, "": 2}'
    // pos 10 is inside the empty property name for the second entry.
    const state = await stateFor(doc, {
      type: 'object',
      properties: {
        a: { type: 'string' },
        b: { type: 'integer' }
      }
    })
    const result = computeCompletions(state, 10, false)
    assert.ok(result, 'expected completions at key position')
    const labels = result.options.map((o) => o.label)
    assert.deepEqual(labels, ['b'])
  })

  it('returns null when offsetToPath yields no actionable position', async () => {
    // Comma at pos 5 is between two properties — offsetToPath returns structural
    // with root path '', but root properties are already offered here too
    // (because structural at an object is a key-position). The only truly null
    // case is when text is unparseable entirely.
    const compiledLayout = await compile({ type: 'object', properties: { a: { type: 'string' } } })
    const state = EditorState.create({
      doc: 'total garbage',
      extensions: jsonLayoutExtensions(compiledLayout)
    })
    const result = computeCompletions(state, 5, false)
    assert.equal(result, null)
  })

  it('property candidates scaffold default values in their apply text', async () => {
    const doc = '{}'
    const state = await stateFor(doc, {
      type: 'object',
      properties: {
        cfg: {
          type: 'object',
          required: ['enabled'],
          properties: { enabled: { type: 'boolean', default: true } }
        }
      }
    })
    const result = computeCompletions(state, 1, false) // inside {}
    assert.ok(result)
    const cfg = result.options.find((o) => o.label === 'cfg')
    assert.ok(cfg, 'cfg candidate missing')
    // apply should contain the scaffolded object.
    const applyText = typeof cfg.apply === 'string' ? cfg.apply : ''
    assert.ok(applyText.includes('"cfg"'), `apply missing key: ${applyText}`)
    assert.ok(applyText.includes('"enabled"'), `apply missing scaffolded child: ${applyText}`)
    assert.ok(applyText.includes('true'), `apply missing scaffolded value: ${applyText}`)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test code/test/editor/completion.spec.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `computeCompletions` and the CM6 wrapper**

Create `code/src/editor/completion.js`:

```javascript
/**
 * @file Fast-path completion source. Pure computation + CM6 wrapper.
 */

import { lookupNormalizedLayout } from '@json-layout/core'
import {
  getValueCandidates,
  getPropertyCandidates,
  getVariantCandidates
} from '../shared/completion/index.js'
import { jsonFormatAdapter } from '../json/adapter.js'
import { compiledLayoutField } from './compiled-layout-field.js'

/** @typedef {import('@codemirror/state').EditorState} EditorState */
/** @typedef {import('@codemirror/autocomplete').CompletionResult} CompletionResult */
/** @typedef {import('@codemirror/autocomplete').CompletionContext} CompletionContext */
/** @typedef {import('@codemirror/autocomplete').Completion} Completion */
/** @typedef {import('../shared/types.js').PropertyCandidate} PropertyCandidate */
/** @typedef {import('../shared/types.js').CompletionCandidate} CompletionCandidate */
/** @typedef {import('../shared/types.js').VariantCandidate} VariantCandidate */

const KEY_WORD_RE = /[\w"]*/
const VALUE_WORD_RE = /[\w"'.-]*/

/**
 * Parse `text` with the JSON adapter and return the keys of the object at
 * `objectPath`, or `undefined` if parsing fails or the path is not an object.
 * Used to filter already-present keys out of property-name completions.
 * @param {string} text
 * @param {string} objectPath
 * @returns {string[] | undefined}
 */
function existingKeysAt (text, objectPath) {
  /** @type {unknown} */
  let value
  try {
    value = jsonFormatAdapter.parse(text)
  } catch {
    return undefined
  }
  const segments = objectPath === '' || objectPath === '/' ? [] : objectPath.replace(/^\//, '').split('/')
  /** @type {any} */
  let current = value
  for (const seg of segments) {
    if (current == null || typeof current !== 'object') return undefined
    current = current[seg]
  }
  if (!current || typeof current !== 'object' || Array.isArray(current)) return undefined
  return Object.keys(current)
}

/**
 * Project a `PropertyCandidate` to a CM6 `Completion`.
 * @param {PropertyCandidate} pc
 * @returns {Completion}
 */
function propertyCompletion (pc) {
  const label = pc.key
  const scaffold = pc.defaultValue !== undefined ? JSON.stringify(pc.defaultValue) : null
  const apply = scaffold !== null ? `"${pc.key}": ${scaffold}` : `"${pc.key}": `
  /** @type {Completion} */
  const c = { label, apply, type: 'property' }
  if (pc.description) c.info = pc.description
  if (pc.title) c.detail = pc.title
  return c
}

/**
 * Project a `CompletionCandidate` (static value) to a CM6 `Completion`.
 * @param {CompletionCandidate} v
 * @returns {Completion}
 */
function valueCompletion (v) {
  return {
    label: v.title,
    apply: JSON.stringify(v.value),
    type: 'enum'
  }
}

/**
 * Project a `VariantCandidate` to a CM6 `Completion`.
 * @param {VariantCandidate} v
 * @returns {Completion}
 */
function variantCompletion (v) {
  return {
    label: v.title,
    apply: JSON.stringify(v.value, null, 2),
    type: 'class'
  }
}

/**
 * Compute the word boundary at `pos` in `state.doc.toString()` using `re`.
 * Returns { from, to } around the cursor. When there's no matchable text we
 * return { from: pos, to: pos } so the completion inserts at the cursor.
 * @param {EditorState} state
 * @param {number} pos
 * @param {RegExp} re
 * @returns {{ from: number, to: number }}
 */
function wordRangeAt (state, pos, re) {
  const line = state.doc.lineAt(pos)
  const lineText = line.text
  const col = pos - line.from
  let from = col
  let to = col
  while (from > 0 && re.test(lineText[from - 1])) from--
  while (to < lineText.length && re.test(lineText[to])) to++
  return { from: line.from + from, to: line.from + to }
}

/**
 * Pure fast-path completion computation.
 * @param {EditorState} state
 * @param {number} pos
 * @param {boolean} explicit
 * @returns {CompletionResult | null}
 */
export function computeCompletions (state, pos, explicit) {
  const compiledLayout = state.field(compiledLayoutField, false)
  if (!compiledLayout) return null

  const text = state.doc.toString()
  const loc = jsonFormatAdapter.offsetToPath(text, pos)
  if (!loc) return null

  if (loc.at === 'key' || loc.at === 'structural') {
    const existing = existingKeysAt(text, loc.path)
    const pcs = getPropertyCandidates(compiledLayout, loc.path, existing)
    if (!pcs.length) return null
    const { from, to } = wordRangeAt(state, pos, KEY_WORD_RE)
    return { from, to, options: pcs.map(propertyCompletion) }
  }

  // loc.at === 'value'
  const normalized = lookupNormalizedLayout(compiledLayout, loc.path)
  /** @type {Completion[]} */
  const options = []
  for (const v of getValueCandidates(normalized)) options.push(valueCompletion(v))
  for (const v of getVariantCandidates(compiledLayout, loc.path)) options.push(variantCompletion(v))
  if (!options.length) return null
  const { from, to } = wordRangeAt(state, pos, VALUE_WORD_RE)
  return { from, to, options }
}

/**
 * CM6 `CompletionSource` wrapper around `computeCompletions`.
 * @param {CompletionContext} context
 * @returns {CompletionResult | null}
 */
export function jsonLayoutCompletion (context) {
  return computeCompletions(context.state, context.pos, context.explicit)
}
```

Note on the `state.field(compiledLayoutField, false)` call: the second argument `false` tells CM6 to return `undefined` instead of throwing if the field is not installed on the state (which is the "returns null when no compiled layout is on the state" test case).

- [ ] **Step 4: Add `autocompletion` wiring to `extensions.js`**

Modify `code/src/editor/extensions.js`. Replace with:

```javascript
/**
 * @file CM6 extension factory for @json-layout/code. Fast-path wiring:
 * JSON language, CompiledLayout StateField, schema-driven completion.
 * Hover is wired in the next task.
 */

import { autocompletion } from '@codemirror/autocomplete'
import { jsonFormatAdapter } from '../json/adapter.js'
import { compiledLayoutField } from './compiled-layout-field.js'
import { jsonLayoutCompletion } from './completion.js'

/** @typedef {import('@json-layout/core').CompiledLayout} CompiledLayout */
/** @typedef {import('@codemirror/state').Extension} Extension */

/**
 * Build the CM6 extension array for a JSON-layout-backed editor. The passed
 * `compiledLayout` is carried on the EditorState via a StateField and read
 * by completion and hover sources on every keystroke.
 * @param {CompiledLayout} compiledLayout
 * @returns {Extension[]}
 */
export function jsonLayoutExtensions (compiledLayout) {
  return [
    jsonFormatAdapter.language,
    compiledLayoutField.init(() => compiledLayout),
    autocompletion({ override: [jsonLayoutCompletion] })
  ]
}
```

- [ ] **Step 5: Expose `computeCompletions` + `jsonLayoutCompletion` via the editor barrel**

Modify `code/src/editor/index.js`:

```javascript
export { jsonLayoutExtensions } from './extensions.js'
export { compiledLayoutField, setCompiledLayoutEffect } from './compiled-layout-field.js'
export { computeCompletions, jsonLayoutCompletion } from './completion.js'
```

- [ ] **Step 6: Run tests**

Run: `node --test code/test/editor/completion.spec.js`
Expected: All 8 tests PASS.

Run: `npm test -w code`
Expected: 91 + 8 = 99 tests pass.

If any test fails, DO NOT weaken its assertions. The three most likely failure modes and their fixes:
- *Position calculation off by one* — `offsetToPath` returns `{at: 'key'}` for positions inside a `PropertyName` token, inclusive of quotes. Use a scratch script to probe what `jsonFormatAdapter.offsetToPath(text, pos)` actually returns for each test's `doc`+`pos`.
- *Empty-object structural position not matching* — `offsetToPath('{ }', 1)` returns `{path: '', at: 'structural'}`. The implementation's `loc.at === 'structural'` branch must accept this. Verify.
- *Word-range calculation eating JSON punctuation* — if `apply` text lands wrong because `from/to` is wrong, tighten `KEY_WORD_RE` / `VALUE_WORD_RE`.

Investigate root cause, not symptom.

- [ ] **Step 7: Commit**

```bash
git add code/src/editor/completion.js code/src/editor/extensions.js code/src/editor/index.js code/test/editor/completion.spec.js
git commit -m "feat(code): add schema-driven completion source for CM6 editor"
```

---

### Task 5: `editor/hover.js` — schema-driven hover tooltip

**Files:**
- Create: `code/src/editor/hover.js`
- Modify: `code/src/editor/extensions.js` (add hoverTooltip wiring)
- Modify: `code/src/editor/index.js` (expose `computeHover` + `jsonLayoutHover`)
- Create: `code/test/editor/hover.spec.js`

Semantic contract:
- Pure function `computeHover(state, pos) → { pos, end, above, create } | null` matching the CM6 `Tooltip` shape.
- Returns `null` if:
  - No compiled layout on the state.
  - `offsetToPath(text, pos)` returns `null`.
  - `getHelp(compiledLayout, path)` returns `null` OR an empty `HelpInfo` (all fields undefined) — there's nothing to show.
- Otherwise returns a `Tooltip` with `pos` at the cursor, `end` at `pathToRange(text, path).to` (so the tooltip can span the value token visually), `above: true`, and a `create(view)` callback that builds a DOM element containing title/description/help (rendered as plain `<div>` children; no markdown rendering in v1 — `help` is already HTML-wrapped by core's markdown pass).

Tests exercise the *descriptor shape* only (the `create` callback is not invoked in unit tests — that would need a live view + DOM).

- [ ] **Step 1: Write failing tests**

Create `code/test/editor/hover.spec.js`:

```javascript
import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { EditorState } from '@codemirror/state'
import { compile } from '@json-layout/core'
import { computeHover } from '../../src/editor/hover.js'
import { compiledLayoutField } from '../../src/editor/compiled-layout-field.js'
import { jsonLayoutExtensions } from '../../src/editor/extensions.js'

/**
 * @param {string} doc
 * @param {unknown} schema
 */
async function stateFor (doc, schema) {
  const compiledLayout = await compile(/** @type {any} */(schema))
  return EditorState.create({
    doc,
    extensions: jsonLayoutExtensions(compiledLayout)
  })
}

describe('computeHover', () => {
  it('returns null when the state carries no compiled layout', () => {
    const state = EditorState.create({
      doc: '{}',
      extensions: [compiledLayoutField]
    })
    assert.equal(computeHover(state, 1), null)
  })

  it('returns a tooltip descriptor on a leaf with a title', async () => {
    const doc = '{"name": "Ada"}'
    const state = await stateFor(doc, {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          title: 'Full name',
          description: 'Given + family'
        }
      }
    })
    // pos 10 is inside the "Ada" value.
    const tip = computeHover(state, 10)
    assert.ok(tip, 'expected a tooltip descriptor')
    assert.equal(typeof tip?.pos, 'number')
    assert.equal(tip?.above, true)
    assert.equal(typeof tip?.create, 'function')
  })

  it('returns null on a path with no authored title/description/help', async () => {
    const doc = '{"x": 1}'
    const state = await stateFor(doc, {
      type: 'object',
      properties: { x: { type: 'integer' } }
    })
    // pos 6 is inside the value 1.
    assert.equal(computeHover(state, 6), null)
  })

  it('returns a tooltip descriptor for a help-only leaf', async () => {
    const doc = '{"n": 1}'
    const state = await stateFor(doc, {
      type: 'object',
      properties: { n: { type: 'integer', layout: { help: 'Between 0 and 100' } } }
    })
    // pos 6 is inside the value 1.
    const tip = computeHover(state, 6)
    assert.ok(tip, 'help-only leaf should still produce a tooltip')
  })

  it('returns null when offset is outside any resolvable token', async () => {
    const state = await stateFor('garbage', {
      type: 'object',
      properties: { a: { type: 'string' } }
    })
    assert.equal(computeHover(state, 3), null)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test code/test/editor/hover.spec.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `computeHover` and the CM6 wrapper**

Create `code/src/editor/hover.js`:

```javascript
/**
 * @file Fast-path hover tooltip source. Pure computation + CM6 wrapper.
 */

import { getHelp } from '../shared/help.js'
import { jsonFormatAdapter } from '../json/adapter.js'
import { compiledLayoutField } from './compiled-layout-field.js'

/** @typedef {import('@codemirror/state').EditorState} EditorState */
/** @typedef {import('@codemirror/view').EditorView} EditorView */
/** @typedef {import('@codemirror/view').Tooltip} Tooltip */
/** @typedef {import('../shared/types.js').HelpInfo} HelpInfo */

/**
 * True when `help` is a non-null object and at least one field is a string.
 * @param {HelpInfo | null} info
 * @returns {info is HelpInfo}
 */
function hasAnyText (info) {
  if (!info) return false
  return typeof info.title === 'string' ||
    typeof info.description === 'string' ||
    typeof info.help === 'string'
}

/**
 * Build the DOM element for a tooltip. Called lazily by CM6 when the tooltip
 * is opened; never invoked from unit tests (which assert the descriptor
 * shape only).
 * @param {HelpInfo} info
 * @returns {(view: EditorView) => { dom: HTMLElement }}
 */
function createDomFactory (info) {
  return (_view) => {
    const dom = document.createElement('div')
    dom.className = 'jl-hover-tip'
    if (info.title) {
      const h = document.createElement('div')
      h.className = 'jl-hover-title'
      h.textContent = info.title
      dom.appendChild(h)
    }
    if (info.description) {
      const d = document.createElement('div')
      d.className = 'jl-hover-description'
      d.textContent = info.description
      dom.appendChild(d)
    }
    if (info.help) {
      const p = document.createElement('div')
      p.className = 'jl-hover-help'
      // `help` may already be HTML (core's markdown pass renders it to HTML
      // when the raw field carries markdown). For raw authored strings the
      // content is plain; either way innerHTML is acceptable here because the
      // source is the schema author, not user input.
      p.innerHTML = info.help
      dom.appendChild(p)
    }
    return { dom }
  }
}

/**
 * Pure hover-tooltip computation. Returns a `Tooltip` descriptor or `null`.
 * @param {EditorState} state
 * @param {number} pos
 * @returns {Tooltip | null}
 */
export function computeHover (state, pos) {
  const compiledLayout = state.field(compiledLayoutField, false)
  if (!compiledLayout) return null

  const text = state.doc.toString()
  const loc = jsonFormatAdapter.offsetToPath(text, pos)
  if (!loc) return null

  const info = getHelp(compiledLayout, loc.path)
  if (!hasAnyText(info)) return null

  const range = jsonFormatAdapter.pathToRange(text, loc.path)
  const end = range ? range.to : pos
  return {
    pos,
    end,
    above: true,
    create: createDomFactory(/** @type {HelpInfo} */(info))
  }
}

/**
 * CM6 `hoverTooltip` source wrapper.
 * @param {EditorView} view
 * @param {number} pos
 * @param {-1 | 1} _side
 * @returns {Tooltip | null}
 */
export function jsonLayoutHover (view, pos, _side) {
  return computeHover(view.state, pos)
}
```

- [ ] **Step 4: Wire `hoverTooltip` into `extensions.js`**

Modify `code/src/editor/extensions.js`:

```javascript
/**
 * @file CM6 extension factory for @json-layout/code. Fast-path wiring:
 * JSON language, CompiledLayout StateField, schema-driven completion,
 * schema-driven hover.
 */

import { autocompletion } from '@codemirror/autocomplete'
import { hoverTooltip } from '@codemirror/view'
import { jsonFormatAdapter } from '../json/adapter.js'
import { compiledLayoutField } from './compiled-layout-field.js'
import { jsonLayoutCompletion } from './completion.js'
import { jsonLayoutHover } from './hover.js'

/** @typedef {import('@json-layout/core').CompiledLayout} CompiledLayout */
/** @typedef {import('@codemirror/state').Extension} Extension */

/**
 * Build the CM6 extension array for a JSON-layout-backed editor. The passed
 * `compiledLayout` is carried on the EditorState via a StateField and read
 * by completion and hover sources on every keystroke.
 * @param {CompiledLayout} compiledLayout
 * @returns {Extension[]}
 */
export function jsonLayoutExtensions (compiledLayout) {
  return [
    jsonFormatAdapter.language,
    compiledLayoutField.init(() => compiledLayout),
    autocompletion({ override: [jsonLayoutCompletion] }),
    hoverTooltip(jsonLayoutHover)
  ]
}
```

- [ ] **Step 5: Expose hover exports via editor barrel**

Modify `code/src/editor/index.js`:

```javascript
export { jsonLayoutExtensions } from './extensions.js'
export { compiledLayoutField, setCompiledLayoutEffect } from './compiled-layout-field.js'
export { computeCompletions, jsonLayoutCompletion } from './completion.js'
export { computeHover, jsonLayoutHover } from './hover.js'
```

- [ ] **Step 6: Run tests**

Run: `node --test code/test/editor/hover.spec.js`
Expected: All 5 tests PASS.

Run: `npm test -w code`
Expected: 99 + 5 = 104 tests pass.

- [ ] **Step 7: Commit**

```bash
git add code/src/editor/hover.js code/src/editor/extensions.js code/src/editor/index.js code/test/editor/hover.spec.js
git commit -m "feat(code): add schema-driven hover tooltip source for CM6 editor"
```

---

### Task 6: Root barrel + editor smoke test

**Files:**
- Modify: `code/src/index.js`
- Create: `code/test/editor/barrel.spec.js`

- [ ] **Step 1: Wire `editor/` through the root barrel**

Modify `code/src/index.js`. Current content:

```javascript
export * from './json/index.js'
export * from './shared/index.js'
```

Append one line so it becomes:

```javascript
export * from './json/index.js'
export * from './shared/index.js'
export * from './editor/index.js'
```

- [ ] **Step 2: Add a barrel smoke test**

Create `code/test/editor/barrel.spec.js`:

```javascript
import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import * as editorBarrel from '../../src/editor/index.js'
import * as rootBarrel from '../../src/index.js'

const expectedEditorSymbols = [
  'jsonLayoutExtensions',
  'compiledLayoutField',
  'setCompiledLayoutEffect',
  'computeCompletions',
  'jsonLayoutCompletion',
  'computeHover',
  'jsonLayoutHover'
]

describe('editor barrel', () => {
  for (const name of expectedEditorSymbols) {
    it(`exports ${name}`, () => {
      assert.ok((/** @type {any} */(editorBarrel))[name] !== undefined)
    })
  }
})

describe('root barrel forwards editor symbols', () => {
  for (const name of expectedEditorSymbols) {
    it(`re-exports ${name}`, () => {
      assert.ok((/** @type {any} */(rootBarrel))[name] !== undefined)
    })
  }

  it('still exposes plan-2/plan-3 symbols alongside editor', () => {
    assert.equal(typeof (/** @type {any} */(rootBarrel)).jsonFormatAdapter, 'object')
    assert.equal(typeof (/** @type {any} */(rootBarrel)).getValueCandidates, 'function')
    assert.equal(typeof (/** @type {any} */(rootBarrel)).collectDiagnostics, 'function')
  })
})
```

- [ ] **Step 3: Run tests**

Run: `node --test code/test/editor/barrel.spec.js`
Expected: All 15 tests PASS (7 editor + 7 root + 1 cross-plan).

Run: `npm test -w code`
Expected: 104 + 15 = 119 tests pass.

- [ ] **Step 4: Commit**

```bash
git add code/src/index.js code/test/editor/barrel.spec.js
git commit -m "feat(code): expose editor/ exports via root barrel + smoke test"
```

---

### Task 7: Final quality pass

**Files:** None (verification only).

- [ ] **Step 1: Run the full quality pipeline**

Run from repo root: `npm run quality`
Expected: lint + build + test pass for every workspace (vocabulary, core, examples, code).

- [ ] **Step 2: End-to-end public-surface smoke script**

Run:

```bash
node --input-type=module --eval "
import { compile } from '@json-layout/core'
import {
  jsonLayoutExtensions,
  computeCompletions,
  computeHover,
  jsonFormatAdapter
} from './code/src/index.js'
import { EditorState } from '@codemirror/state'

const compiled = await compile({
  type: 'object',
  required: ['color'],
  properties: {
    color: { type: 'string', enum: ['red', 'green', 'blue'], title: 'Colour' }
  }
})
const state = EditorState.create({
  doc: '{\"color\": \"\"}',
  extensions: jsonLayoutExtensions(compiled)
})
console.log('language:', !!jsonFormatAdapter.language)
console.log('completion at 11:', computeCompletions(state, 11, false)?.options.map(o => o.label))
console.log('hover at 11:', computeHover(state, 11))
"
```

Expected output (approximately):

```
language: true
completion at 11: [ 'red', 'green', 'blue' ]
hover at 11: { pos: 11, end: ..., above: true, create: [Function: ...] }
```

- [ ] **Step 3: Confirm no drift outside `code/`**

Run: `git diff --stat main..HEAD -- ':!code' ':!docs/superpowers'`
Expected: Only `package.json`/`package-lock.json`/`eslint.config.mjs` at the repo root (unchanged from Plan 2/3 state) and core changes committed on this branch (the `fix(core): re-export Display` from Plan 3 prereq, and the Plan 1 core exposures). No other files.

- [ ] **Step 4: Final summary**

Confirm deliverable vs goal:

- `code/src/editor/` exists with `compiled-layout-field.js`, `completion.js`, `hover.js`, `extensions.js`, `index.js`.
- `jsonFormatAdapter.language` is a `LanguageSupport`.
- `jsonLayoutExtensions(compiledLayout)` returns a composable `Extension[]` that activates the JSON language, carries the compiled layout on the state, wires schema-driven completion, and wires schema-driven hover.
- `npm run quality` green; ~119 tests across the code workspace; no DOM or `EditorView` needed for tests.

No additional commit — verification only.
