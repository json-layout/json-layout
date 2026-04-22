# Code Edition — Committed Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the committed-path wiring: a `StatefulLayout` sync loop that keeps a host-owned `StatefulLayout` in step with the parsed buffer, schema diagnostics surfaced through `@codemirror/lint`, and dynamic completion candidates (`getItems`) merged into the autocompletion flow. After this plan, a host can construct a CodeMirror 6 JSON editor whose schema errors underline live as the user types, and whose completion menu includes async `getItems` suggestions — on top of the fast-path features already delivered by Plan 4.

**Architecture:** A new `statefulLayoutField` StateField carries the host's `StatefulLayout` on the editor state. A `statefulLayoutSyncPlugin` CM6 ViewPlugin debounces doc changes (250ms), parses the buffer via the JSON adapter, mutates `statefulLayout.data` on success (freeze-at-last-good on parse error), then dispatches diagnostics via `@codemirror/lint`'s `setDiagnostics`. Dynamic completion is added as a *second* async CM6 completion source (`jsonLayoutDynamicCompletion`) so static candidates still appear instantly while async results arrive on the next menu refresh. The extension factory grows a second optional argument — `{ statefulLayout }` — so hosts that only want the fast path from Plan 4 keep the Plan 4 signature.

**Tech Stack:** Plain JS + JSDoc, `@codemirror/state`/`view`/`lint`/`autocomplete`, `@codemirror/lang-json` (already wired in Plan 4), Node's built-in test runner. No DOM in tests — the ViewPlugin logic is extracted into a pure `runCommittedSync(state, dispatch)` helper tested with a stub `dispatch`.

**Spec:** `docs/superpowers/specs/2026-04-21-code-edition-design.md` — sections *"Two-tier execution"* (committed path), *"Sync triggers"* (debounce fallback), *"Behavior while syntactically invalid"*, *"Diagnostics"*, *"Completion"* (dynamic `getItems` branch).

**Depends on:**
- Plan 1 (core exposures): `StatefulLayout`, `getFieldSuggestions`.
- Plan 2 (JSON adapter): `parse`, `pathToRange`, `jsonFormatAdapter`.
- Plan 3 (shared primitives): `collectDiagnostics`, `getDynamicCandidates`.
- Plan 4 (editor wiring): `compiledLayoutField`, `jsonLayoutExtensions`, `computeCompletions`.

**Out of scope for this plan** (later plans):
- Commit-point detection (closing `}`/`]`/`"` heuristics). This plan ships the 250ms debounce fallback only; heuristic commit points are a small orthogonal delta for a later plan.
- `forceLinting` on explicit-save transactions.
- Inline widgets, slot mechanism, `JsonEditor` class, `doc/` app, modified gutter.
- Path-level diffing into `StatefulLayout` (v1 re-assigns `.data` wholesale, per spec).

---

## File Structure

Note: `@codemirror/lint` (^6.8.0) is already a dependency in `code/package.json` — it rode in on the Plan 4 Task 1 commit (`1f246d5`). No package changes are needed in this plan.

| File | Action | Responsibility |
|------|--------|----------------|
| `code/src/editor/stateful-layout-field.js` | Create | CM6 `StateField<StatefulLayout\|null>` + `setStatefulLayoutEffect` |
| `code/src/editor/sync.js` | Create | Pure helpers: `syncStatefulLayoutData(sl, fmt, text)` + `runCommittedSync(state, dispatch)` |
| `code/src/editor/sync-plugin.js` | Create | `statefulLayoutSyncPlugin` ViewPlugin — 250ms debounce → `runCommittedSync` |
| `code/src/editor/completion.js` | Modify | Add `computeDynamicCompletions` + `jsonLayoutDynamicCompletion` (async source) |
| `code/src/editor/extensions.js` | Modify | Accept optional `{ statefulLayout }` opts; wire field + sync plugin + linter + dynamic completion |
| `code/src/editor/index.js` | Modify | Export new symbols |
| `code/src/index.js` | Modify | Already re-exports `editor/*` — nothing to do (barrel smoke test updated) |
| `code/test/editor/stateful-layout-field.spec.js` | Create | StateField init/update/preserve |
| `code/test/editor/sync.spec.js` | Create | `syncStatefulLayoutData` + `runCommittedSync` correctness |
| `code/test/editor/dynamic-completion.spec.js` | Create | `computeDynamicCompletions` returns/skips candidates |
| `code/test/editor/extensions.spec.js` | Modify | Add cases for the `{ statefulLayout }` opt |
| `code/test/editor/barrel.spec.js` | Modify | Add new symbols to the expected-exports list |

---

### Task 1: `editor/stateful-layout-field.js` — CM6 StateField holding the StatefulLayout

**Files:**
- Create: `code/src/editor/stateful-layout-field.js`
- Create: `code/test/editor/stateful-layout-field.spec.js`

Semantic contract:
- Export `statefulLayoutField: StateField<StatefulLayout | null>` — initial value `null`.
- Export `setStatefulLayoutEffect: StateEffectType<StatefulLayout>` — swap the current value.
- The field holds a *reference* to the host's `StatefulLayout`. Mutations to `.data` happen out-of-band in the sync plugin; the field's value identity does not change on data mutation (we never clone or replace the instance via a no-op effect). The StateField exists so fast-path sources can *read* the reference off `state.field(...)`.

Rationale: directly mirrors `compiledLayoutField` (Plan 4, Task 2). A StateField (not a Facet) is the correct shape because hosts can replace the instance via effect (e.g., if they re-create the `StatefulLayout` with different options). The `null` default means Plan 4's fast-path-only hosts — those that don't install this field — keep working unchanged.

- [ ] **Step 1: Write failing tests**

Create `code/test/editor/stateful-layout-field.spec.js`:

```javascript
import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { EditorState } from '@codemirror/state'
import { compile, StatefulLayout } from '@json-layout/core'
import {
  statefulLayoutField,
  setStatefulLayoutEffect
} from '../../src/editor/stateful-layout-field.js'

const defaultOptions = { debounceInputMs: 0, initialValidation: 'always' }

/**
 * @param {unknown} schema
 * @param {unknown} data
 */
async function newSL (schema, data) {
  const compiled = await compile(/** @type {any} */(schema))
  return new StatefulLayout(
    compiled,
    compiled.skeletonTrees[compiled.mainTree],
    defaultOptions,
    data
  )
}

describe('statefulLayoutField', () => {
  it('defaults to null when unconfigured', () => {
    const state = EditorState.create({ extensions: [statefulLayoutField] })
    assert.equal(state.field(statefulLayoutField), null)
  })

  it('initializes to a value via .init()', async () => {
    const sl = await newSL({ type: 'object', properties: { a: { type: 'string' } } }, { a: 'x' })
    const state = EditorState.create({
      extensions: [statefulLayoutField.init(() => sl)]
    })
    assert.equal(state.field(statefulLayoutField), sl)
  })

  it('updates when a transaction includes setStatefulLayoutEffect', async () => {
    const a = await newSL({ type: 'object', properties: { a: { type: 'string' } } }, { a: 'x' })
    const b = await newSL({ type: 'object', properties: { b: { type: 'integer' } } }, { b: 1 })
    const initial = EditorState.create({
      extensions: [statefulLayoutField.init(() => a)]
    })
    const next = initial.update({ effects: setStatefulLayoutEffect.of(b) }).state
    assert.equal(next.field(statefulLayoutField), b)
  })

  it('preserves the reference across unrelated transactions', async () => {
    const sl = await newSL({ type: 'object', properties: { a: { type: 'string' } } }, { a: 'x' })
    const state = EditorState.create({
      doc: '{}',
      extensions: [statefulLayoutField.init(() => sl)]
    })
    const after = state.update({ changes: { from: 0, to: 0, insert: ' ' } }).state
    assert.equal(after.field(statefulLayoutField), sl)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test code/test/editor/stateful-layout-field.spec.js`
Expected: FAIL — module `.../stateful-layout-field.js` not found.

- [ ] **Step 3: Implement the state field**

Create `code/src/editor/stateful-layout-field.js`:

```javascript
/**
 * @file CM6 StateField + StateEffect carrying a host-owned StatefulLayout on
 * an EditorState. The field holds a reference; `.data` mutations happen
 * out-of-band in the sync plugin and do not change field identity. Read via
 * `state.field(statefulLayoutField)`; replace via a transaction with
 * `setStatefulLayoutEffect.of(statefulLayout)`.
 */

import { StateEffect, StateField } from '@codemirror/state'

/** @typedef {import('@json-layout/core').StatefulLayout} StatefulLayout */

/** @type {import('@codemirror/state').StateEffectType<StatefulLayout>} */
export const setStatefulLayoutEffect = StateEffect.define()

/** @type {import('@codemirror/state').StateField<StatefulLayout | null>} */
export const statefulLayoutField = StateField.define({
  create () { return null },
  update (value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setStatefulLayoutEffect)) return effect.value
    }
    return value
  }
})
```

- [ ] **Step 4: Run tests**

Run: `node --test code/test/editor/stateful-layout-field.spec.js`
Expected: All 4 tests PASS.

Run: `npm test -w code`
Expected: 119 (Plan 4) + 4 new = 123 tests pass.

- [ ] **Step 5: Commit**

```bash
git add code/src/editor/stateful-layout-field.js code/test/editor/stateful-layout-field.spec.js
git commit -m "feat(code): add statefulLayoutField CM6 StateField"
```

---

### Task 2: `editor/sync.js` — pure sync helpers

**Files:**
- Create: `code/src/editor/sync.js`
- Create: `code/test/editor/sync.spec.js`

Semantic contract:

1. `syncStatefulLayoutData(statefulLayout, formatAdapter, text) → boolean`
   - Parses `text` via `formatAdapter.parse`. On syntax error: return `false`, leave `statefulLayout.data` unchanged ("freeze at last good").
   - On success: assign `statefulLayout.data = parsed` (which triggers `updateState()` internally). Return `true`.
   - Does *not* touch diagnostics — pure data sync.

2. `runCommittedSync(state, dispatch) → void`
   - Reads `statefulLayoutField` and `compiledLayoutField` from `state`.
   - If no `StatefulLayout` on the state: no-op.
   - Calls `syncStatefulLayoutData`. If it returned `false`, dispatches **nothing** (freeze behavior — existing diagnostics remain).
   - If it returned `true`, calls `collectDiagnostics(statefulLayout, text, jsonFormatAdapter)` and dispatches the `setDiagnostics(state, diagnostics)` TransactionSpec via `dispatch`.
   - `dispatch` is injected (mirrors `EditorView.dispatch` shape) so tests can capture dispatched transactions without a DOM.

Rationale: extracting the two pure halves means the ViewPlugin in Task 3 is ~15 lines of glue (create debounce timer, clear on destroy, invoke `runCommittedSync(view.state, view.dispatch)`). All real logic lives in `sync.js` where it is unit-testable with an `EditorState` and a stub dispatch — no CM view, no DOM.

- [ ] **Step 1: Write failing tests**

Create `code/test/editor/sync.spec.js`:

```javascript
import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { EditorState } from '@codemirror/state'
import { compile, StatefulLayout } from '@json-layout/core'
import { jsonFormatAdapter } from '../../src/json/adapter.js'
import { compiledLayoutField } from '../../src/editor/compiled-layout-field.js'
import { statefulLayoutField } from '../../src/editor/stateful-layout-field.js'
import { syncStatefulLayoutData, runCommittedSync } from '../../src/editor/sync.js'
import { setDiagnosticsEffect } from '@codemirror/lint'

const defaultOptions = { debounceInputMs: 0, initialValidation: 'always' }

/**
 * @param {unknown} schema
 * @param {unknown} data
 */
async function newSL (schema, data) {
  const compiled = await compile(/** @type {any} */(schema))
  return new StatefulLayout(
    compiled,
    compiled.skeletonTrees[compiled.mainTree],
    defaultOptions,
    data
  )
}

describe('syncStatefulLayoutData', () => {
  it('assigns parsed data on success and returns true', async () => {
    const sl = await newSL({ type: 'object', properties: { name: { type: 'string' } } }, { name: 'old' })
    const ok = syncStatefulLayoutData(sl, jsonFormatAdapter, '{"name": "new"}')
    assert.equal(ok, true)
    assert.deepEqual(sl.data, { name: 'new' })
  })

  it('returns false and leaves data unchanged on parse error', async () => {
    const sl = await newSL({ type: 'object', properties: { name: { type: 'string' } } }, { name: 'frozen' })
    const before = sl.data
    const ok = syncStatefulLayoutData(sl, jsonFormatAdapter, '{"name": frozen')
    assert.equal(ok, false)
    assert.deepEqual(sl.data, before)
  })
})

describe('runCommittedSync', () => {
  /**
   * @param {string} doc
   * @param {any} compiledLayout
   * @param {any} sl
   */
  function makeState (doc, compiledLayout, sl) {
    return EditorState.create({
      doc,
      extensions: [
        compiledLayoutField.init(() => compiledLayout),
        ...(sl ? [statefulLayoutField.init(() => sl)] : [statefulLayoutField])
      ]
    })
  }

  it('is a no-op when no StatefulLayout is on the state', async () => {
    const compiled = await compile({ type: 'object', properties: { a: { type: 'string' } } })
    const state = makeState('{"a": "x"}', compiled, null)
    /** @type {any[]} */
    const dispatched = []
    runCommittedSync(state, (tr) => dispatched.push(tr))
    assert.equal(dispatched.length, 0)
  })

  it('dispatches setDiagnostics with schema errors on valid JSON', async () => {
    const compiled = await compile({
      type: 'object',
      properties: { age: { type: 'integer', minimum: 0 } }
    })
    const sl = new StatefulLayout(
      compiled,
      compiled.skeletonTrees[compiled.mainTree],
      defaultOptions,
      { age: 0 }
    )
    const state = makeState('{"age": -1}', compiled, sl)
    /** @type {any[]} */
    const dispatched = []
    runCommittedSync(state, (tr) => dispatched.push(tr))
    assert.equal(dispatched.length, 1)
    const effects = /** @type {any} */(dispatched[0]).effects
    const setDiagEffect = Array.isArray(effects)
      ? effects.find((e) => e.is(setDiagnosticsEffect))
      : (effects && effects.is(setDiagnosticsEffect) ? effects : null)
    assert.ok(setDiagEffect, 'expected a setDiagnosticsEffect in the dispatched transaction')
    assert.ok(setDiagEffect.value.length >= 1, 'expected at least one diagnostic')
    assert.equal(setDiagEffect.value[0].severity, 'error')
  })

  it('dispatches setDiagnostics with [] when data is valid', async () => {
    const compiled = await compile({
      type: 'object',
      properties: { name: { type: 'string' } }
    })
    const sl = new StatefulLayout(
      compiled,
      compiled.skeletonTrees[compiled.mainTree],
      defaultOptions,
      { name: 'ok' }
    )
    const state = makeState('{"name": "ok"}', compiled, sl)
    /** @type {any[]} */
    const dispatched = []
    runCommittedSync(state, (tr) => dispatched.push(tr))
    assert.equal(dispatched.length, 1)
    const effects = /** @type {any} */(dispatched[0]).effects
    const setDiagEffect = Array.isArray(effects)
      ? effects.find((e) => e.is(setDiagnosticsEffect))
      : (effects && effects.is(setDiagnosticsEffect) ? effects : null)
    assert.ok(setDiagEffect)
    assert.deepEqual(setDiagEffect.value, [])
  })

  it('does not dispatch on parse error (freeze-at-last-good)', async () => {
    const compiled = await compile({ type: 'object', properties: { a: { type: 'string' } } })
    const sl = new StatefulLayout(
      compiled,
      compiled.skeletonTrees[compiled.mainTree],
      defaultOptions,
      { a: 'frozen' }
    )
    const state = makeState('{"a": frozen', compiled, sl)
    /** @type {any[]} */
    const dispatched = []
    runCommittedSync(state, (tr) => dispatched.push(tr))
    assert.equal(dispatched.length, 0)
    // And the StatefulLayout's data is still the last good value.
    assert.deepEqual(sl.data, { a: 'frozen' })
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test code/test/editor/sync.spec.js`
Expected: FAIL — module `.../sync.js` not found.

- [ ] **Step 3: Implement `sync.js`**

Create `code/src/editor/sync.js`:

```javascript
/**
 * @file Pure helpers for the committed path: apply a parsed buffer to a
 * StatefulLayout and derive the matching setDiagnostics transaction. Split
 * out of the ViewPlugin so all behavior is testable with an EditorState and
 * a stub `dispatch` — no DOM required.
 */

import { setDiagnostics } from '@codemirror/lint'
import { collectDiagnostics } from '../shared/diagnostics.js'
import { jsonFormatAdapter } from '../json/adapter.js'
import { compiledLayoutField } from './compiled-layout-field.js'
import { statefulLayoutField } from './stateful-layout-field.js'

/** @typedef {import('@codemirror/state').EditorState} EditorState */
/** @typedef {import('@codemirror/state').TransactionSpec} TransactionSpec */
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

/**
 * Run one committed sync: pull the StatefulLayout off `state`, re-sync it
 * against the current doc, and (on success) dispatch a setDiagnostics
 * transaction with the resolved schema diagnostics. Does nothing if no
 * StatefulLayout is installed or if the doc is unparseable.
 * @param {EditorState} state
 * @param {(tr: TransactionSpec) => void} dispatch
 * @returns {void}
 */
export function runCommittedSync (state, dispatch) {
  const statefulLayout = state.field(statefulLayoutField, false)
  if (!statefulLayout) return
  // compiledLayoutField is not strictly required for sync (StatefulLayout
  // already holds its compiledLayout), but we assert it's there for symmetry
  // and to help detect misconfigurations early.
  const compiledLayout = state.field(compiledLayoutField, false)
  if (!compiledLayout) return

  const text = state.doc.toString()
  if (!syncStatefulLayoutData(statefulLayout, jsonFormatAdapter, text)) return

  const diagnostics = collectDiagnostics(statefulLayout, text, jsonFormatAdapter)
  dispatch(setDiagnostics(state, diagnostics))
}
```

- [ ] **Step 4: Run tests**

Run: `node --test code/test/editor/sync.spec.js`
Expected: All 6 tests PASS.

Run: `npm test -w code`
Expected: 123 + 6 = 129 tests pass.

- [ ] **Step 5: Commit**

```bash
git add code/src/editor/sync.js code/test/editor/sync.spec.js
git commit -m "feat(code): add pure sync helpers for committed path"
```

---

### Task 3: `editor/sync-plugin.js` — CM6 ViewPlugin with debounce

**Files:**
- Create: `code/src/editor/sync-plugin.js`

Semantic contract:
- Export `statefulLayoutSyncPlugin: Extension` — a CM6 ViewPlugin.
- On creation: schedule an initial `runCommittedSync(view.state, view.dispatch)` after 250ms. (This resolves initial diagnostics without waiting for a keystroke.)
- On every `ViewUpdate` where `update.docChanged` is true: clear the pending timer and re-schedule in 250ms.
- On destroy: clear any pending timer.

This is the only file in this plan that is *not* unit-tested directly. The logic is a 15-line glue layer; every branch it depends on is tested in `sync.spec.js` (Task 2). The smoke test in Task 7 exercises the end-to-end path.

Rationale: no `setInterval`/global timer — the timer is per-view so destroying the view cancels the timer. No `forceLinting` call — the `@codemirror/lint` extension is already installed (we add it in Task 5), and our `setDiagnostics` transaction updates the linter state directly. No commit-point detection in v1 — the 250ms debounce alone is fine for now per spec.

- [ ] **Step 1: Implement `sync-plugin.js`**

Create `code/src/editor/sync-plugin.js`:

```javascript
/**
 * @file CM6 ViewPlugin that debounces doc changes and runs the committed
 * sync (parse → update StatefulLayout → dispatch diagnostics). 250ms idle
 * delay, per spec. Commit-point heuristics (closing brace/quote/end-of-line)
 * are deferred to a later plan.
 */

import { ViewPlugin } from '@codemirror/view'
import { runCommittedSync } from './sync.js'

const DEBOUNCE_MS = 250

export const statefulLayoutSyncPlugin = ViewPlugin.fromClass(class {
  /**
   * @param {import('@codemirror/view').EditorView} view
   */
  constructor (view) {
    this.view = view
    /** @type {ReturnType<typeof setTimeout> | null} */
    this.timer = null
    this.schedule()
  }

  schedule () {
    if (this.timer !== null) clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      this.timer = null
      runCommittedSync(this.view.state, (tr) => this.view.dispatch(tr))
    }, DEBOUNCE_MS)
  }

  /**
   * @param {import('@codemirror/view').ViewUpdate} update
   */
  update (update) {
    if (update.docChanged) this.schedule()
  }

  destroy () {
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }
})
```

- [ ] **Step 2: Quick sanity import-check**

Run: `node --input-type=module --eval "import('./code/src/editor/sync-plugin.js').then(m => console.log('ok', !!m.statefulLayoutSyncPlugin))"`
Expected output: `ok true`

- [ ] **Step 3: Commit**

```bash
git add code/src/editor/sync-plugin.js
git commit -m "feat(code): add debounced sync ViewPlugin for committed path"
```

---

### Task 4: Dynamic completion as a second async source

**Files:**
- Modify: `code/src/editor/completion.js`
- Create: `code/test/editor/dynamic-completion.spec.js`

Semantic contract:
- Add pure async function `computeDynamicCompletions(state, pos) → Promise<CompletionResult | null>`.
  - Returns `null` if no `StatefulLayout` on state, if `offsetToPath` yields `null`, or if the position is not `at: 'value'` (dynamic candidates are value-only for v1).
  - Otherwise awaits `getDynamicCandidates(statefulLayout, path)` and returns a `CompletionResult` with `type: 'enum'` entries. Returns `null` if the candidate list is empty (so CM doesn't flash an empty menu).
- Add CM6 wrapper `jsonLayoutDynamicCompletion(context) → Promise<CompletionResult | null>`.
- The existing static `computeCompletions` / `jsonLayoutCompletion` is unchanged. Both sources are registered; CM merges them.

Rationale: two sources — one sync, one async — is the canonical CM pattern for "show static things immediately, async things when ready". Splitting the async branch out of the static source means static completion remains O(1) responsive.

- [ ] **Step 1: Write failing tests**

Create `code/test/editor/dynamic-completion.spec.js`. Note: this test composes the editor state manually (not via `jsonLayoutExtensions`) so it has no dependency on Task 5.

```javascript
import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { EditorState } from '@codemirror/state'
import { compile, StatefulLayout } from '@json-layout/core'
import { computeDynamicCompletions } from '../../src/editor/completion.js'
import { compiledLayoutField } from '../../src/editor/compiled-layout-field.js'
import { statefulLayoutField } from '../../src/editor/stateful-layout-field.js'

const defaultOptions = { debounceInputMs: 0, initialValidation: 'always' }

/**
 * @param {string} doc
 * @param {unknown} schema
 * @param {unknown} data
 */
async function stateFor (doc, schema, data) {
  const compiled = await compile(/** @type {any} */(schema))
  const sl = new StatefulLayout(
    compiled,
    compiled.skeletonTrees[compiled.mainTree],
    defaultOptions,
    data
  )
  return EditorState.create({
    doc,
    extensions: [
      compiledLayoutField.init(() => compiled),
      statefulLayoutField.init(() => sl)
    ]
  })
}

describe('computeDynamicCompletions', () => {
  it('returns null when no StatefulLayout is on the state', async () => {
    const compiled = await compile({ type: 'object', properties: { a: { type: 'string' } } })
    const state = EditorState.create({
      doc: '{"a": ""}',
      extensions: [compiledLayoutField.init(() => compiled), statefulLayoutField]
    })
    const result = await computeDynamicCompletions(state, 8)
    assert.equal(result, null)
  })

  it('returns candidates at a value position with a getItems enum', async () => {
    const schema = {
      type: 'object',
      properties: {
        color: {
          type: 'string',
          layout: { getItems: ['red', 'green', 'blue'] }
        }
      }
    }
    const state = await stateFor('{"color": ""}', schema, { color: '' })
    // pos 11 is inside the empty string value.
    const result = await computeDynamicCompletions(state, 11)
    assert.ok(result, 'expected a completion result for the getItems field')
    const labels = result.options.map((o) => o.label).sort()
    assert.deepEqual(labels, ['blue', 'green', 'red'])
  })

  it('returns null at a key position', async () => {
    const schema = {
      type: 'object',
      properties: {
        color: { type: 'string', layout: { getItems: ['red'] } }
      }
    }
    const state = await stateFor('{"": ""}', schema, {})
    // pos 2 is inside the empty key.
    const result = await computeDynamicCompletions(state, 2)
    assert.equal(result, null)
  })

  it('returns null when the path has no getItems', async () => {
    const schema = {
      type: 'object',
      properties: { plain: { type: 'string' } }
    }
    const state = await stateFor('{"plain": ""}', schema, { plain: '' })
    const result = await computeDynamicCompletions(state, 11)
    assert.equal(result, null)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test code/test/editor/dynamic-completion.spec.js`
Expected: FAIL — `computeDynamicCompletions` is not exported from `completion.js`. All four tests error on the missing import.

- [ ] **Step 3: Implement `computeDynamicCompletions` + wrapper**

Modify `code/src/editor/completion.js`. Append the following (keep all existing exports intact):

```javascript
import { getDynamicCandidates } from '../shared/completion/index.js'
import { statefulLayoutField } from './stateful-layout-field.js'

/**
 * Project a dynamic `CompletionCandidate` to a CM6 `Completion`.
 * @param {CompletionCandidate} v
 * @returns {Completion}
 */
function dynamicCompletion (v) {
  return { label: v.title, apply: JSON.stringify(v.value), type: 'enum' }
}

/**
 * Async dynamic completion computation. Returns candidates only at value
 * positions and only when a StatefulLayout is installed on the state.
 * @param {EditorState} state
 * @param {number} pos
 * @returns {Promise<CompletionResult | null>}
 */
export async function computeDynamicCompletions (state, pos) {
  const statefulLayout = state.field(statefulLayoutField, false)
  if (!statefulLayout) return null

  const text = state.doc.toString()
  const loc = jsonFormatAdapter.offsetToPath(text, pos)
  if (!loc || loc.at !== 'value') return null

  const candidates = await getDynamicCandidates(statefulLayout, loc.path)
  if (!candidates.length) return null

  const { from, to } = wordRangeAt(state, pos, VALUE_WORD_RE)
  return { from, to, options: candidates.map(dynamicCompletion) }
}

/**
 * CM6 async CompletionSource wrapper for dynamic (getItems) candidates.
 * @param {CompletionContext} context
 * @returns {Promise<CompletionResult | null>}
 */
export async function jsonLayoutDynamicCompletion (context) {
  return computeDynamicCompletions(context.state, context.pos)
}
```

Important: the `getDynamicCandidates` import lives in `'../shared/completion/index.js'`. If the barrel doesn't yet export it, verify with `grep -n 'getDynamicCandidates' code/src/shared/completion/index.js` — per Plan 3 it's already there. If not, add `export { getDynamicCandidates } from './dynamic-candidates.js'` to the shared completion barrel.

Also: `wordRangeAt` and `VALUE_WORD_RE` are private helpers at the top of the existing `completion.js`. They're already in scope within the file — no re-declaration needed.

- [ ] **Step 4: Run tests**

Run: `node --test code/test/editor/dynamic-completion.spec.js`
Expected: All 4 tests PASS.

Run: `npm test -w code`
Expected: 129 + 4 = 133 tests pass.

- [ ] **Step 5: Commit**

```bash
git add code/src/editor/completion.js code/test/editor/dynamic-completion.spec.js
git commit -m "feat(code): add async dynamic completion source for CM6 editor"
```

---

### Task 5: `editor/extensions.js` — accept optional `{ statefulLayout }` options

**Files:**
- Modify: `code/src/editor/extensions.js`
- Modify: `code/src/editor/index.js`
- Modify: `code/test/editor/extensions.spec.js`

Semantic contract:
- New signature: `jsonLayoutExtensions(compiledLayout, options?)`. `options` is `{ statefulLayout?: StatefulLayout }`.
- Plan 4 callers — `jsonLayoutExtensions(compiledLayout)` — keep working: omitted `options` ⇒ no StatefulLayout wiring.
- When `options.statefulLayout` is provided, the returned array *also* includes:
  - `statefulLayoutField.init(() => options.statefulLayout)`
  - `statefulLayoutSyncPlugin`
  - `linter(null)` — enables the `@codemirror/lint` extension so `setDiagnostics` effects have somewhere to land. Source is `null` because we drive diagnostics imperatively from the sync plugin.
  - `jsonLayoutDynamicCompletion` added to the `autocompletion.override` array (alongside `jsonLayoutCompletion`).

Rationale: the split keeps the Plan 4 API surface stable. Two positional args is simpler than migrating to an options bag now — the spec's full options bag (`locale`, `slots`, `onData`, etc.) will land with the `JsonEditor` class in a later plan.

- [ ] **Step 1: Write failing / updated tests**

Modify `code/test/editor/extensions.spec.js`. Keep existing tests unchanged; append:

```javascript
import { StatefulLayout } from '@json-layout/core'
import { statefulLayoutField } from '../../src/editor/stateful-layout-field.js'

const defaultSLOptions = { debounceInputMs: 0, initialValidation: 'always' }

describe('jsonLayoutExtensions with { statefulLayout }', () => {
  it('installs the statefulLayoutField when statefulLayout is provided', async () => {
    const compiled = await compile({ type: 'object', properties: { a: { type: 'string' } } })
    const sl = new StatefulLayout(
      compiled,
      compiled.skeletonTrees[compiled.mainTree],
      defaultSLOptions,
      { a: 'x' }
    )
    const state = EditorState.create({
      doc: '{"a": "x"}',
      extensions: jsonLayoutExtensions(compiled, { statefulLayout: sl })
    })
    assert.equal(state.field(statefulLayoutField), sl)
  })

  it('leaves statefulLayoutField null when options are omitted (Plan 4 back-compat)', async () => {
    const compiled = await compile({ type: 'object', properties: { a: { type: 'string' } } })
    const state = EditorState.create({
      doc: '{"a": "x"}',
      extensions: [
        ...jsonLayoutExtensions(compiled),
        statefulLayoutField
      ]
    })
    assert.equal(state.field(statefulLayoutField), null)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test code/test/editor/extensions.spec.js`
Expected: the two new cases FAIL — `jsonLayoutExtensions` ignores the second argument.

- [ ] **Step 3: Implement the new extension wiring**

Modify `code/src/editor/extensions.js`. Replace the whole file with:

```javascript
/**
 * @file CM6 extension factory for @json-layout/code. Composes the fast-path
 * wiring (JSON language, CompiledLayout StateField, schema-driven completion
 * and hover) and, when a StatefulLayout is passed, the committed-path wiring
 * (StatefulLayout StateField, debounced sync plugin, lint host, dynamic
 * completion source).
 */

import { autocompletion } from '@codemirror/autocomplete'
import { hoverTooltip } from '@codemirror/view'
import { linter } from '@codemirror/lint'
import { jsonFormatAdapter } from '../json/adapter.js'
import { compiledLayoutField } from './compiled-layout-field.js'
import { statefulLayoutField } from './stateful-layout-field.js'
import { statefulLayoutSyncPlugin } from './sync-plugin.js'
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
 * @param {{ statefulLayout?: StatefulLayout }} [options]
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
      statefulLayoutSyncPlugin,
      linter(null)
    )
  }

  return extensions
}
```

- [ ] **Step 4: Expose new symbols via the editor barrel**

Modify `code/src/editor/index.js`. Current content:

```javascript
export { jsonLayoutExtensions } from './extensions.js'
export { compiledLayoutField, setCompiledLayoutEffect } from './compiled-layout-field.js'
export { computeCompletions, jsonLayoutCompletion } from './completion.js'
export { computeHover, jsonLayoutHover } from './hover.js'
```

Replace with:

```javascript
export { jsonLayoutExtensions } from './extensions.js'
export { compiledLayoutField, setCompiledLayoutEffect } from './compiled-layout-field.js'
export { statefulLayoutField, setStatefulLayoutEffect } from './stateful-layout-field.js'
export { statefulLayoutSyncPlugin } from './sync-plugin.js'
export {
  syncStatefulLayoutData,
  runCommittedSync
} from './sync.js'
export {
  computeCompletions,
  jsonLayoutCompletion,
  computeDynamicCompletions,
  jsonLayoutDynamicCompletion
} from './completion.js'
export { computeHover, jsonLayoutHover } from './hover.js'
```

- [ ] **Step 5: Run tests**

Run: `node --test code/test/editor/extensions.spec.js`
Expected: all previously-failing tests in the file PASS (the two new `{ statefulLayout }` cases pass).

Run: `npm test -w code`
Expected: 133 + 2 = 135 tests pass. If the root-barrel smoke test in `barrel.spec.js` fails because the expected-exports list is out of date, that's fixed in Task 6.

- [ ] **Step 6: Commit**

```bash
git add code/src/editor/extensions.js code/src/editor/index.js code/test/editor/extensions.spec.js
git commit -m "feat(code): wire committed-path extensions through jsonLayoutExtensions"
```

---

### Task 6: Update the root barrel smoke test

**Files:**
- Modify: `code/test/editor/barrel.spec.js`

Rationale: `src/index.js` already re-exports `./editor/index.js` (Plan 4, Task 6), so the new symbols flow through automatically. But the smoke test's expected-exports list is static — we need to add the new names so it keeps us honest.

- [ ] **Step 1: Update the expected-exports list**

Modify `code/test/editor/barrel.spec.js`. The current `expectedEditorSymbols` list:

```javascript
const expectedEditorSymbols = [
  'jsonLayoutExtensions',
  'compiledLayoutField',
  'setCompiledLayoutEffect',
  'computeCompletions',
  'jsonLayoutCompletion',
  'computeHover',
  'jsonLayoutHover'
]
```

Replace with:

```javascript
const expectedEditorSymbols = [
  'jsonLayoutExtensions',
  'compiledLayoutField',
  'setCompiledLayoutEffect',
  'statefulLayoutField',
  'setStatefulLayoutEffect',
  'statefulLayoutSyncPlugin',
  'syncStatefulLayoutData',
  'runCommittedSync',
  'computeCompletions',
  'jsonLayoutCompletion',
  'computeDynamicCompletions',
  'jsonLayoutDynamicCompletion',
  'computeHover',
  'jsonLayoutHover'
]
```

- [ ] **Step 2: Run tests**

Run: `node --test code/test/editor/barrel.spec.js`
Expected: 14 editor + 14 root + 1 cross-plan = 29 tests pass.

Run: `npm test -w code`
Expected: 135 + (29 - 15 already counted) = 149 tests pass.

- [ ] **Step 3: Commit**

```bash
git add code/test/editor/barrel.spec.js
git commit -m "test(code): include committed-path symbols in barrel smoke test"
```

---

### Task 7: Final quality pass + end-to-end smoke

**Files:** None (verification only).

- [ ] **Step 1: Run the full quality pipeline**

Run from repo root: `npm run quality`
Expected: lint + build + test pass for every workspace (vocabulary, core, examples, code). No eslint drift — all new files are plain JS with JSDoc, following Plan 4's conventions.

- [ ] **Step 2: End-to-end public-surface smoke script**

Run:

```bash
node --input-type=module --eval "
import { compile, StatefulLayout } from '@json-layout/core'
import {
  jsonLayoutExtensions,
  runCommittedSync,
  syncStatefulLayoutData,
  jsonFormatAdapter
} from './code/src/index.js'
import { EditorState } from '@codemirror/state'
import { diagnosticCount } from '@codemirror/lint'

const schema = {
  type: 'object',
  properties: {
    age: { type: 'integer', minimum: 0 },
    name: { type: 'string' }
  }
}
const compiled = await compile(schema)
const sl = new StatefulLayout(
  compiled,
  compiled.skeletonTrees[compiled.mainTree],
  { debounceInputMs: 0, initialValidation: 'always' },
  { age: 0, name: 'ok' }
)

const doc = '{\"age\": -5, \"name\": \"ok\"}'
let state = EditorState.create({
  doc,
  extensions: jsonLayoutExtensions(compiled, { statefulLayout: sl })
})

// Invoke the committed sync directly (bypass the view-plugin debounce, no DOM in this env).
runCommittedSync(state, (tr) => { state = state.update(tr).state })

console.log('slData after sync:', sl.data)
console.log('diagnosticCount:', diagnosticCount(state))

// Freeze-at-last-good: feed garbage, expect sl.data unchanged.
const ok = syncStatefulLayoutData(sl, jsonFormatAdapter, '{\"age\": -5, garbage')
console.log('parse ok on garbage:', ok)
console.log('slData after garbage:', sl.data)
"
```

Expected output (approximately):

```
slData after sync: { age: -5, name: 'ok' }
diagnosticCount: 1
parse ok on garbage: false
slData after garbage: { age: -5, name: 'ok' }
```

(The diagnostic is the `minimum: 0` violation on `/age`. `sl.data` is unchanged across the parse-error case, confirming freeze-at-last-good.)

- [ ] **Step 3: Confirm no drift outside `code/`**

Run: `git diff --stat main..HEAD -- ':!code' ':!docs/superpowers'`
Expected: Same set of files as the end of Plan 4 — core exposures + `eslint.config.mjs` + root `package.json`/`package-lock.json`. No new rows.

- [ ] **Step 4: Final summary**

Confirm deliverable vs goal:

- `statefulLayoutField` + `setStatefulLayoutEffect` carry the host's `StatefulLayout` on the editor state.
- `syncStatefulLayoutData` + `runCommittedSync` assemble the committed sync behavior, fully unit-tested without a DOM.
- `statefulLayoutSyncPlugin` is the thin CM6 glue that runs the above on a 250ms debounce.
- `@codemirror/lint` is wired via `linter(null)` + `setDiagnostics`, so every committed sync updates the editor's diagnostics in place.
- Dynamic completion (`getItems`) is a second async completion source, merged with the static one by CM's autocompletion.
- `jsonLayoutExtensions(compiledLayout)` still works unchanged; passing `{ statefulLayout }` activates the committed path.
- `npm run quality` green; ~149 tests across the code workspace; no DOM required for tests (the one thin glue layer that would need one — `sync-plugin.js` — has all its logic extracted into `sync.js` and tested there).

No additional commit — verification only.
