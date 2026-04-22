# Code Edition — Shared Primitives Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land `code/src/shared/` — the format-agnostic, schema-driven primitives that every future editor wiring depends on: completion candidate extraction (static values, property names, oneOf/anyOf variants, dynamic `getItems` results), help/title/description resolution, and diagnostic mapping from `StatefulLayout` errors to text ranges. All delivered as pure functions, unit-tested under `node:test` with no CodeMirror and no DOM.

**Architecture:** Single new folder `code/src/shared/` alongside the existing `code/src/json/`. Split by responsibility: one file per concern (`help.js`, `diagnostics.js`) and a small `completion/` sub-folder with four focused modules (`value-candidates.js`, `property-candidates.js`, `variant-candidates.js`, `dynamic-candidates.js`). `shared/` never walks a raw JSON Schema — every schema-derived value comes from `@json-layout/core` public APIs: `CompiledLayout`, `resolveSkeletonNode`, `lookupNormalizedLayout`, `scaffoldDefault`, `getFieldSuggestions`, and `StatefulLayout`. `shared/` also never imports from `code/src/json/` — format-specific ranges flow in through a `FormatAdapter` parameter, matching the seam already built in Plan 2.

**Tech Stack:** Plain JS + JSDoc, `@json-layout/core` for all schema interpretation, Node.js built-in `node:test` runner.

**Spec:** `docs/superpowers/specs/2026-04-21-code-edition-design.md` — sections *"Module split: shared/ vs json/"* (shared/ responsibilities bullet list) and *"Completion"* / *"Diagnostics"* / *"Help / description"*.

**Depends on:**
- Plan 1 (core exposures) — landed: `resolveSkeletonNode`, `lookupNormalizedLayout`, `scaffoldDefault`, `getFieldSuggestions` are already exported from `@json-layout/core`.
- Plan 2 (JSON adapter) — landed: `FormatAdapter` type + `jsonFormatAdapter` live in `code/src/json/`. Tests in this plan reuse `jsonFormatAdapter` as a concrete adapter for range mapping.

**Out of scope for this plan** (future plans):
- CM6 wiring: `jsonLayoutExtensions()`, completion source, linter, tooltip extension, hover support, `language` field on `FormatAdapter` — Plan 4.
- StatefulLayout *sync loop* (debounced parse → `statefulLayout.data = ...` ingestion, freeze-at-last-good). This is orchestration, not a primitive, and it needs CM transactions to trigger it. The plan here exposes the *inputs* the sync loop will use, not the loop itself — Plan 4.
- Widget / slot registry, inline widget descriptors — Plan 5.
- `JsonEditor` class, `doc/` app — later plans.

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `code/src/shared/types.ts` | Create | Shared TS interfaces: `CompletionCandidate`, `PropertyCandidate`, `VariantCandidate`, `HelpInfo`, `Diagnostic` |
| `code/src/shared/completion/value-candidates.js` | Create | `getValueCandidates(normalizedLayout) → CompletionCandidate[]` — static items from `normalizedLayout.items` |
| `code/src/shared/completion/property-candidates.js` | Create | `getPropertyCandidates(compiledLayout, objectPath, existingKeys?) → PropertyCandidate[]` — object property names, required-first, with title/description/default-value |
| `code/src/shared/completion/variant-candidates.js` | Create | `getVariantCandidates(compiledLayout, path) → VariantCandidate[]` — one candidate per oneOf/anyOf variant tree, with pre-scaffolded value |
| `code/src/shared/completion/dynamic-candidates.js` | Create | `getDynamicCandidates(statefulLayout, path, query?) → Promise<CompletionCandidate[]>` — thin wrapper over `core`'s `getFieldSuggestions` |
| `code/src/shared/completion/index.js` | Create | Barrel re-exporting the four completion functions |
| `code/src/shared/help.js` | Create | `getHelp(compiledLayout, path) → HelpInfo \| null` (fast path) + `getHelpFromState(statefulLayout, path) → HelpInfo \| null` (committed path) |
| `code/src/shared/diagnostics.js` | Create | `collectDiagnostics(statefulLayout, text, formatAdapter) → Diagnostic[]` — walk state tree, map each node's `error` to a text range |
| `code/src/shared/index.js` | Create | Barrel re-exporting everything in `shared/` |
| `code/src/index.js` | Modify | Add `export * from './shared/index.js'` below the existing `json/` export |
| `code/test/shared/value-candidates.spec.js` | Create | Unit tests for `getValueCandidates` |
| `code/test/shared/property-candidates.spec.js` | Create | Unit tests for `getPropertyCandidates` |
| `code/test/shared/variant-candidates.spec.js` | Create | Unit tests for `getVariantCandidates` |
| `code/test/shared/dynamic-candidates.spec.js` | Create | Unit tests for `getDynamicCandidates` (uses real `StatefulLayout`) |
| `code/test/shared/help.spec.js` | Create | Unit tests for `getHelp` / `getHelpFromState` |
| `code/test/shared/diagnostics.spec.js` | Create | Unit tests for `collectDiagnostics` using `jsonFormatAdapter` |
| `code/test/shared/barrel.spec.js` | Create | Smoke test for the shared barrel + root barrel re-export |

All source files are plain JS with JSDoc types; `types.ts` is the single TS interface file, matching the `json/types.ts` convention from Plan 2.

---

### Task 1: `shared/types.ts`

**Files:**
- Create: `code/src/shared/types.ts`

Intent: nail down the interface surface first so every subsequent task just has to import a typedef.

Barrel files (`shared/index.js`, `shared/completion/index.js`) are NOT created in this task — lint (`import-x/export`) rejects `export * from './empty-barrel.js'` when the target has no named exports. Instead, Task 2 creates both barrels at the same time it lands the first real export (`value-candidates.js`), and also wires `code/src/index.js` to forward `shared/`.

**Prerequisite:** The core `fix(core): re-export Display from local binding so emitted .d.ts compiles` commit must have landed on this branch. Without it, any `import ... from '@json-layout/core'` in a workspace-built TS file fails with `error TS2304: Cannot find name 'Display'`. Verify with `git log --oneline -n5 core/src/state/index.js` — the most recent commit on that file should be the Display fix.

- [ ] **Step 1: Create `code/src/shared/types.ts`**

Create `code/src/shared/types.ts`:

```typescript
import type { StatefulLayout, CompiledLayout } from '@json-layout/core'

/**
 * A generic completion candidate — used for leaf value completion (static enum
 * items, dynamic getItems results, etc.) and wherever the surface just needs a
 * (value, title, optional key) triple.
 */
export interface CompletionCandidate {
  value: unknown
  title: string
  key?: string
}

/**
 * A completion candidate for a property name inside an object.
 * `defaultValue` is the scaffolded value to insert as the property's value —
 * undefined if no static default applies (leaf without schema default, optional
 * empty object, etc.).
 */
export interface PropertyCandidate {
  key: string
  title?: string
  description?: string
  required: boolean
  defaultValue: unknown
}

/**
 * A completion candidate for picking a oneOf/anyOf variant at a value position.
 * `value` is the pre-scaffolded object for the variant, with discriminator
 * property filled in when applicable.
 */
export interface VariantCandidate {
  title: string
  value: unknown
}

/**
 * Help info extracted for a given path — all fields optional.
 */
export interface HelpInfo {
  title?: string
  description?: string
  help?: string
}

/**
 * Editor-agnostic diagnostic entry produced from a StatefulLayout error.
 * `from`/`to` are text offsets supplied by the format adapter's `pathToRange`.
 * `severity` is always `'error'` in v1 — reserved for future warn/info tiers.
 */
export interface Diagnostic {
  from: number
  to: number
  path: string
  message: string
  severity: 'error'
}

// Re-export the two core types shared/ consumers most often need, so callers
// can `import type { CompiledLayout } from '@json-layout/code'` when convenient.
export type { StatefulLayout, CompiledLayout }
```

- [ ] **Step 2: Verify the workspace still builds**

Run: `npm run build -w code`
Expected: succeeds. `types.ts` is not re-exported anywhere yet, so it only needs to type-check — it doesn't generate a runtime module. New declarations land under `code/types/shared/types.d.ts`.

Run: `npm test -w code`
Expected: all 39 Plan 2 tests still pass.

- [ ] **Step 3: Commit**

```bash
git add code/src/shared/types.ts
git commit -m "feat(code): add shared/types.ts with completion/help/diagnostic interfaces"
```

---

### Task 2: `shared/completion/value-candidates.js` — static leaf value candidates (+ barrels)

**Files:**
- Create: `code/src/shared/completion/value-candidates.js`
- Create: `code/src/shared/completion/index.js` — completion barrel, populated with value-candidates
- Create: `code/src/shared/index.js` — shared barrel, re-exports from completion
- Modify: `code/src/index.js` — append `export * from './shared/index.js'`
- Create: `code/test/shared/value-candidates.spec.js`

Semantic contract: given a `NormalizedLayout`, return the static `items` list normalized to `CompletionCandidate[]`, skipping `header` entries. Returns `[]` if the layout has no `items`, or if the layout is a `SwitchStruct` (variant lookup is handled by `variant-candidates.js` in a later task).

Barrel setup is bundled into this task because the first real export unblocks lint — earlier attempts to land empty barrels (in Task 1 as originally written) tripped `import-x/export` warnings on `export * from './empty-barrel.js'`.

- [ ] **Step 1: Write failing tests**

Create `code/test/shared/value-candidates.spec.js`:

```javascript
import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { compile, lookupNormalizedLayout } from '@json-layout/core'
import { getValueCandidates } from '../../src/shared/completion/value-candidates.js'

describe('getValueCandidates', () => {
  it('returns candidates from an enum', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        color: { type: 'string', enum: ['red', 'green', 'blue'] }
      }
    })
    const layout = lookupNormalizedLayout(compiledLayout, '/color')
    const items = getValueCandidates(layout)
    assert.equal(items.length, 3)
    assert.deepEqual(items.map(i => i.value), ['red', 'green', 'blue'])
    assert.ok(items.every(i => typeof i.title === 'string'))
  })

  it('returns candidates from oneOf const values', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        level: {
          oneOf: [
            { const: 'low', title: 'Low' },
            { const: 'high', title: 'High' }
          ]
        }
      }
    })
    const layout = lookupNormalizedLayout(compiledLayout, '/level')
    const items = getValueCandidates(layout)
    assert.deepEqual(items.map(i => i.value), ['low', 'high'])
    assert.deepEqual(items.map(i => i.title), ['Low', 'High'])
  })

  it('returns an empty array for a layout without items', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        name: { type: 'string' }
      }
    })
    const layout = lookupNormalizedLayout(compiledLayout, '/name')
    assert.deepEqual(getValueCandidates(layout), [])
  })

  it('returns an empty array when passed undefined', () => {
    assert.deepEqual(getValueCandidates(undefined), [])
  })

  it('skips header entries', () => {
    const fakeLayout = /** @type {any} */({
      items: [
        { header: true, title: 'Group 1' },
        { value: 'a', title: 'A', key: 'a' },
        { header: true, title: 'Group 2' },
        { value: 'b', title: 'B', key: 'b' }
      ]
    })
    const items = getValueCandidates(fakeLayout)
    assert.equal(items.length, 2)
    assert.deepEqual(items.map(i => i.value), ['a', 'b'])
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test code/test/shared/value-candidates.spec.js`
Expected: FAIL — `Cannot find module '.../value-candidates.js'`.

- [ ] **Step 3: Implement `getValueCandidates`**

Create `code/src/shared/completion/value-candidates.js`:

```javascript
/**
 * @file Extract static value completion candidates from a NormalizedLayout.
 */

import { isSwitchStruct } from '@json-layout/vocabulary'

/** @typedef {import('../types.js').CompletionCandidate} CompletionCandidate */

/**
 * Pull the normalized `items` list from `normalizedLayout` and project it to
 * the generic CompletionCandidate shape. Returns `[]` for layouts with no
 * items, for SwitchStruct layouts (variants belong in variant-candidates),
 * and for `undefined` input.
 *
 * @param {import('@json-layout/vocabulary').NormalizedLayout | undefined} normalizedLayout
 * @returns {CompletionCandidate[]}
 */
export function getValueCandidates (normalizedLayout) {
  if (!normalizedLayout) return []
  if (isSwitchStruct(normalizedLayout)) return []
  const layout = /** @type {any} */(normalizedLayout)
  /** @type {unknown[]} */
  const rawItems = Array.isArray(layout.items) ? layout.items : []
  /** @type {CompletionCandidate[]} */
  const out = []
  for (const raw of rawItems) {
    const item = /** @type {any} */(raw)
    if (item && item.header === true) continue
    /** @type {CompletionCandidate} */
    const candidate = {
      value: item?.value,
      title: typeof item?.title === 'string' ? item.title : String(item?.value ?? '')
    }
    if (typeof item?.key === 'string' && item.key !== candidate.title) {
      candidate.key = item.key
    }
    out.push(candidate)
  }
  return out
}
```

- [ ] **Step 4: Create `shared/completion/index.js` re-exporting the new function**

Create `code/src/shared/completion/index.js`:

```javascript
export { getValueCandidates } from './value-candidates.js'
```

- [ ] **Step 5: Create `shared/index.js` forwarding from completion**

Create `code/src/shared/index.js`:

```javascript
export * from './completion/index.js'
```

- [ ] **Step 6: Wire the root barrel**

Modify `code/src/index.js`. The file currently contains:

```javascript
export * from './json/index.js'
```

Append a line so it becomes:

```javascript
export * from './json/index.js'
export * from './shared/index.js'
```

- [ ] **Step 7: Run tests**

Run: `node --test code/test/shared/value-candidates.spec.js`
Expected: All 5 tests PASS.

Run: `npm run build -w code`
Expected: succeeds.

Run: `npm test -w code`
Expected: all 39 Plan 2 tests + 5 Task 2 tests = 44 tests pass.

- [ ] **Step 8: Commit**

```bash
git add code/src/shared/completion/value-candidates.js code/src/shared/completion/index.js code/src/shared/index.js code/src/index.js code/test/shared/value-candidates.spec.js
git commit -m "feat(code): add shared/completion/value-candidates for static leaf items"
```

---

### Task 3: `shared/completion/property-candidates.js` — object property names

**Files:**
- Create: `code/src/shared/completion/property-candidates.js`
- Modify: `code/src/shared/completion/index.js` (add re-export)
- Create: `code/test/shared/property-candidates.spec.js`

Semantic contract: given a compiled layout and the path of an *object* node, return one `PropertyCandidate` per child property — **required first, then alphabetical** — annotated with each property's title/description (from its normalized layout) and a default value via `scaffoldDefault`. If `existingKeys` is provided, already-present keys are skipped. If the path does not resolve to a section (object) skeleton node, return `[]`.

- [ ] **Step 1: Write failing tests**

Create `code/test/shared/property-candidates.spec.js`:

```javascript
import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { compile } from '@json-layout/core'
import { getPropertyCandidates } from '../../src/shared/completion/property-candidates.js'

describe('getPropertyCandidates', () => {
  it('returns one candidate per property with required flag', async () => {
    const compiledLayout = await compile({
      type: 'object',
      required: ['a'],
      properties: {
        a: { type: 'string', title: 'A title' },
        b: { type: 'integer', description: 'B desc' }
      }
    })
    const candidates = getPropertyCandidates(compiledLayout, '')
    assert.equal(candidates.length, 2)

    const a = candidates.find(c => c.key === 'a')
    assert.ok(a)
    assert.equal(a?.required, true)
    assert.equal(a?.title, 'A title')

    const b = candidates.find(c => c.key === 'b')
    assert.ok(b)
    assert.equal(b?.required, false)
    assert.equal(b?.description, 'B desc')
  })

  it('orders required properties before optional ones, then alphabetically', async () => {
    const compiledLayout = await compile({
      type: 'object',
      required: ['zeta', 'alpha'],
      properties: {
        beta: { type: 'string' },
        alpha: { type: 'string' },
        zeta: { type: 'string' },
        delta: { type: 'string' }
      }
    })
    const candidates = getPropertyCandidates(compiledLayout, '')
    assert.deepEqual(candidates.map(c => c.key), ['alpha', 'zeta', 'beta', 'delta'])
  })

  it('filters out existingKeys', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: { a: { type: 'string' }, b: { type: 'integer' } }
    })
    const candidates = getPropertyCandidates(compiledLayout, '', ['a'])
    assert.deepEqual(candidates.map(c => c.key), ['b'])
  })

  it('resolves a nested object path', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        outer: {
          type: 'object',
          required: ['inner'],
          properties: { inner: { type: 'string', default: 'x' } }
        }
      }
    })
    const candidates = getPropertyCandidates(compiledLayout, '/outer')
    assert.equal(candidates.length, 1)
    assert.equal(candidates[0].key, 'inner')
    assert.equal(candidates[0].required, true)
    assert.equal(candidates[0].defaultValue, 'x')
  })

  it('uses scaffoldDefault for each property defaultValue', async () => {
    const compiledLayout = await compile({
      type: 'object',
      required: ['nested'],
      properties: {
        nested: {
          type: 'object',
          required: ['inner'],
          properties: { inner: { type: 'string', default: 'v' } }
        }
      }
    })
    const candidates = getPropertyCandidates(compiledLayout, '')
    const nested = candidates.find(c => c.key === 'nested')
    assert.ok(nested)
    assert.deepEqual(nested?.defaultValue, { inner: 'v' })
  })

  it('returns [] when path does not resolve to an object node', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: { a: { type: 'string' } }
    })
    assert.deepEqual(getPropertyCandidates(compiledLayout, '/missing'), [])
    assert.deepEqual(getPropertyCandidates(compiledLayout, '/a'), [])
  })

  it('ignores skeleton children whose key is internal (starts with $)', async () => {
    // oneOf under a property creates $ref-shaped internal skeleton children;
    // the caller of getPropertyCandidates should never see them surfaced as
    // real property names.
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        value: {
          oneOf: [
            { type: 'object', properties: { a: { type: 'string' } } },
            { type: 'object', properties: { b: { type: 'integer' } } }
          ]
        }
      }
    })
    const candidates = getPropertyCandidates(compiledLayout, '')
    const keys = candidates.map(c => c.key)
    assert.ok(!keys.some(k => k.startsWith('$')), `unexpected internal keys: ${JSON.stringify(keys)}`)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test code/test/shared/property-candidates.spec.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `getPropertyCandidates`**

Create `code/src/shared/completion/property-candidates.js`:

```javascript
/**
 * @file Property-name completion candidates for an object path.
 */

import { resolveSkeletonNode, scaffoldDefault } from '@json-layout/core'
import { isSwitchStruct } from '@json-layout/vocabulary'

/** @typedef {import('../types.js').PropertyCandidate} PropertyCandidate */

/**
 * @param {import('@json-layout/vocabulary').NormalizedLayout | undefined} normalizedLayout
 * @returns {any}
 */
function firstCompObject (normalizedLayout) {
  if (!normalizedLayout) return {}
  return isSwitchStruct(normalizedLayout) ? normalizedLayout.switch[0] : normalizedLayout
}

/**
 * List property-name completion candidates for the object at `objectPath`.
 * Candidates are returned with required properties first (alphabetical within
 * each group). Already-present keys are filtered out when `existingKeys` is
 * supplied. Returns `[]` if `objectPath` does not resolve to a section
 * (object) skeleton node.
 *
 * @param {import('@json-layout/core').CompiledLayout} compiledLayout
 * @param {string} objectPath
 * @param {string[]} [existingKeys]
 * @returns {PropertyCandidate[]}
 */
export function getPropertyCandidates (compiledLayout, objectPath, existingKeys) {
  const skeleton = resolveSkeletonNode(compiledLayout, objectPath)
  if (!skeleton?.children?.length) return []
  const normalized = compiledLayout.normalizedLayouts[skeleton.pointer]
  const compObject = firstCompObject(normalized)
  if (compObject?.comp !== 'section') return []

  const skip = new Set(existingKeys ?? [])
  /** @type {PropertyCandidate[]} */
  const out = []
  for (const childPointer of skeleton.children) {
    const child = compiledLayout.skeletonNodes[childPointer]
    if (!child) continue
    if (typeof child.key !== 'string') continue
    if (child.key.startsWith('$')) continue
    if (skip.has(child.key)) continue
    const childLayout = compiledLayout.normalizedLayouts[child.pointer]
    const childComp = /** @type {any} */(firstCompObject(childLayout))
    /** @type {PropertyCandidate} */
    const candidate = {
      key: child.key,
      required: child.required === true,
      defaultValue: scaffoldDefault(childPointer, compiledLayout)
    }
    if (typeof childComp?.title === 'string') candidate.title = childComp.title
    if (typeof childComp?.description === 'string') candidate.description = childComp.description
    out.push(candidate)
  }

  out.sort((a, b) => {
    if (a.required !== b.required) return a.required ? -1 : 1
    return a.key < b.key ? -1 : a.key > b.key ? 1 : 0
  })

  return out
}
```

- [ ] **Step 4: Add to `shared/completion/index.js`**

Replace `code/src/shared/completion/index.js` with:

```javascript
export { getValueCandidates } from './value-candidates.js'
export { getPropertyCandidates } from './property-candidates.js'
```

- [ ] **Step 5: Run tests**

Run: `node --test code/test/shared/property-candidates.spec.js`
Expected: All 7 tests PASS.

If the "ignores internal keys" test surfaces a `$`-prefixed key, log the candidate list and check whether the skeleton's `child.key` values really start with `$` — if not, the test may be a no-op (which is fine). If they do and the filter isn't working, fix the implementation. Do NOT weaken the assertion.

- [ ] **Step 6: Commit**

```bash
git add code/src/shared/completion/property-candidates.js code/src/shared/completion/index.js code/test/shared/property-candidates.spec.js
git commit -m "feat(code): add shared/completion/property-candidates for object keys"
```

---

### Task 4: `shared/completion/variant-candidates.js` — oneOf/anyOf variants

**Files:**
- Create: `code/src/shared/completion/variant-candidates.js`
- Modify: `code/src/shared/completion/index.js`
- Create: `code/test/shared/variant-candidates.spec.js`

Semantic contract: given a compiled layout and a path, return one `VariantCandidate` per variant tree if the skeleton node at that path has `childrenTrees`. Each candidate carries the variant's title (from its `SkeletonTree.title`) and a pre-scaffolded value (from `scaffoldDefault(variantTree.root, compiledLayout)`, including discriminator fill when applicable). Returns `[]` when the path does not resolve, or resolves to a node without variant trees.

- [ ] **Step 1: Write failing tests**

Create `code/test/shared/variant-candidates.spec.js`:

```javascript
import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { compile } from '@json-layout/core'
import { getVariantCandidates } from '../../src/shared/completion/variant-candidates.js'

describe('getVariantCandidates', () => {
  it('returns one candidate per oneOf variant', async () => {
    const compiledLayout = await compile({
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
    const candidates = getVariantCandidates(compiledLayout, '/value')
    assert.equal(candidates.length, 2)
    assert.deepEqual(candidates.map(c => c.title), ['Alpha', 'Beta'])
    assert.deepEqual(candidates[0].value, { a: 'A' })
    assert.deepEqual(candidates[1].value, { b: 1 })
  })

  it('fills the discriminator property on each variant', async () => {
    const compiledLayout = await compile({
      type: 'object',
      required: ['value'],
      properties: {
        value: {
          discriminator: { propertyName: 'kind' },
          required: ['kind'],
          oneOf: [
            {
              title: 'Alpha',
              properties: { kind: { const: 'alpha' }, a: { type: 'string', default: 'A' } },
              required: ['a']
            },
            {
              title: 'Beta',
              properties: { kind: { const: 'beta' }, b: { type: 'integer', default: 2 } },
              required: ['b']
            }
          ]
        }
      }
    })
    const candidates = getVariantCandidates(compiledLayout, '/value')
    assert.equal(candidates.length, 2)
    const alpha = /** @type {any} */(candidates[0].value)
    const beta = /** @type {any} */(candidates[1].value)
    assert.equal(alpha.kind, 'alpha')
    assert.equal(alpha.a, 'A')
    assert.equal(beta.kind, 'beta')
    assert.equal(beta.b, 2)
  })

  it('returns [] for a node with no variant trees', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: { a: { type: 'string' } }
    })
    assert.deepEqual(getVariantCandidates(compiledLayout, '/a'), [])
    assert.deepEqual(getVariantCandidates(compiledLayout, ''), [])
  })

  it('returns [] for an unknown path', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: { a: { type: 'string' } }
    })
    assert.deepEqual(getVariantCandidates(compiledLayout, '/missing'), [])
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test code/test/shared/variant-candidates.spec.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `getVariantCandidates`**

Create `code/src/shared/completion/variant-candidates.js`:

```javascript
/**
 * @file oneOf/anyOf variant completion candidates for a given path.
 */

import { resolveSkeletonNode, scaffoldDefault } from '@json-layout/core'

/** @typedef {import('../types.js').VariantCandidate} VariantCandidate */

/**
 * List variant candidates for the skeleton node at `path`. Each candidate
 * carries the variant's title and a pre-scaffolded default value, with any
 * discriminator property filled in.
 *
 * @param {import('@json-layout/core').CompiledLayout} compiledLayout
 * @param {string} path
 * @returns {VariantCandidate[]}
 */
export function getVariantCandidates (compiledLayout, path) {
  const skeleton = resolveSkeletonNode(compiledLayout, path)
  if (!skeleton?.childrenTrees?.length) return []
  /** @type {VariantCandidate[]} */
  const out = []
  for (const treeName of skeleton.childrenTrees) {
    const tree = compiledLayout.skeletonTrees[treeName]
    if (!tree) continue
    let value = scaffoldDefault(tree.root, compiledLayout)
    if (skeleton.discriminator && tree.discriminatorValue !== undefined) {
      const obj = (value && typeof value === 'object' && !Array.isArray(value))
        ? /** @type {Record<string, unknown>} */(value)
        : {}
      obj[skeleton.discriminator] = tree.discriminatorValue
      value = obj
    }
    out.push({ title: tree.title, value })
  }
  return out
}
```

- [ ] **Step 4: Update `shared/completion/index.js`**

Replace `code/src/shared/completion/index.js` with:

```javascript
export { getValueCandidates } from './value-candidates.js'
export { getPropertyCandidates } from './property-candidates.js'
export { getVariantCandidates } from './variant-candidates.js'
```

- [ ] **Step 5: Run tests**

Run: `node --test code/test/shared/variant-candidates.spec.js`
Expected: All 4 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add code/src/shared/completion/variant-candidates.js code/src/shared/completion/index.js code/test/shared/variant-candidates.spec.js
git commit -m "feat(code): add shared/completion/variant-candidates for oneOf variants"
```

---

### Task 5: `shared/completion/dynamic-candidates.js` — async `getItems` results

**Files:**
- Create: `code/src/shared/completion/dynamic-candidates.js`
- Modify: `code/src/shared/completion/index.js`
- Create: `code/test/shared/dynamic-candidates.spec.js`

Semantic contract: thin async wrapper over `@json-layout/core`'s `getFieldSuggestions`. Takes a live `StatefulLayout` and a path; returns `CompletionCandidate[]` normalized from the core tool's `{items}` result. Catches path-not-found errors from `getFieldSuggestions` and returns `[]` instead of throwing — callers in the editor fire this against possibly-stale paths and must not see rejections for that case.

Rationale for a thin wrapper rather than re-exporting `getFieldSuggestions` directly: the editor surface wants the flat `CompletionCandidate[]` shape, not `{items: [...]}`, and we want a single place to define the "missing path → empty list" behavior.

- [ ] **Step 1: Write failing tests**

Create `code/test/shared/dynamic-candidates.spec.js`:

```javascript
import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { compile, StatefulLayout } from '@json-layout/core'
import { getDynamicCandidates } from '../../src/shared/completion/dynamic-candidates.js'

const defaultOptions = { debounceInputMs: 0 }

describe('getDynamicCandidates', () => {
  it('returns candidates from an enum field', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        color: { type: 'string', enum: ['red', 'green', 'blue'] }
      }
    })
    const statefulLayout = new StatefulLayout(
      compiledLayout,
      compiledLayout.skeletonTrees[compiledLayout.mainTree],
      defaultOptions,
      { color: 'red' }
    )
    const items = await getDynamicCandidates(statefulLayout, '/color')
    assert.equal(items.length, 3)
    assert.deepEqual(items.map(i => i.value), ['red', 'green', 'blue'])
  })

  it('returns [] for an unknown path instead of throwing', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: { a: { type: 'string' } }
    })
    const statefulLayout = new StatefulLayout(
      compiledLayout,
      compiledLayout.skeletonTrees[compiledLayout.mainTree],
      defaultOptions,
      { a: 'x' }
    )
    const items = await getDynamicCandidates(statefulLayout, '/missing')
    assert.deepEqual(items, [])
  })

  it('forwards the optional query argument', async () => {
    // Validate only that the call shape accepts a query; the upstream tool
    // does the actual filtering for enum-backed nodes (no-op here).
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        color: { type: 'string', enum: ['red', 'green', 'blue'] }
      }
    })
    const statefulLayout = new StatefulLayout(
      compiledLayout,
      compiledLayout.skeletonTrees[compiledLayout.mainTree],
      defaultOptions,
      { color: 'red' }
    )
    const items = await getDynamicCandidates(statefulLayout, '/color', 'r')
    assert.ok(Array.isArray(items))
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test code/test/shared/dynamic-candidates.spec.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `getDynamicCandidates`**

Create `code/src/shared/completion/dynamic-candidates.js`:

```javascript
/**
 * @file Async wrapper over core's getFieldSuggestions for the editor surface.
 */

import { getFieldSuggestions } from '@json-layout/core'

/** @typedef {import('../types.js').CompletionCandidate} CompletionCandidate */

/**
 * Fetch dynamic completion candidates for `path`, optionally filtered by
 * `query`. Swallows "node not found" errors and returns `[]` so callers can
 * fire this against potentially-stale paths without guarding.
 *
 * @param {import('@json-layout/core').StatefulLayout} statefulLayout
 * @param {string} path
 * @param {string} [query]
 * @returns {Promise<CompletionCandidate[]>}
 */
export async function getDynamicCandidates (statefulLayout, path, query) {
  /** @type {{ items: Array<{ value: unknown, title: string, key?: string }> }} */
  let result
  try {
    result = await getFieldSuggestions(statefulLayout, { path, query })
  } catch (/** @type {any} */ err) {
    if (typeof err?.message === 'string' && err.message.includes('node not found')) return []
    throw err
  }
  return result.items.map((i) => {
    /** @type {CompletionCandidate} */
    const c = { value: i.value, title: i.title }
    if (typeof i.key === 'string') c.key = i.key
    return c
  })
}
```

- [ ] **Step 4: Update `shared/completion/index.js`**

Replace `code/src/shared/completion/index.js` with:

```javascript
export { getValueCandidates } from './value-candidates.js'
export { getPropertyCandidates } from './property-candidates.js'
export { getVariantCandidates } from './variant-candidates.js'
export { getDynamicCandidates } from './dynamic-candidates.js'
```

- [ ] **Step 5: Run tests**

Run: `node --test code/test/shared/dynamic-candidates.spec.js`
Expected: All 3 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add code/src/shared/completion/dynamic-candidates.js code/src/shared/completion/index.js code/test/shared/dynamic-candidates.spec.js
git commit -m "feat(code): add shared/completion/dynamic-candidates wrapping getFieldSuggestions"
```

---

### Task 6: `shared/help.js` — title / description / help resolution

**Files:**
- Create: `code/src/shared/help.js`
- Create: `code/test/shared/help.spec.js`

Semantic contract: two functions, both returning `HelpInfo | null`.
- `getHelp(compiledLayout, path)` — fast path: reads the matched `NormalizedLayout`'s first comp object. Does NOT evaluate expressions. Returns `null` if the path does not resolve.
- `getHelpFromState(statefulLayout, path)` — committed path: reads the resolved `StateNode.layout`, which already reflects expression evaluation and conditional visibility. Returns `null` if the path does not resolve.

Both strip out undefined fields so callers can `if (info?.help)` trivially.

- [ ] **Step 1: Write failing tests**

Create `code/test/shared/help.spec.js`:

```javascript
import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { compile, StatefulLayout } from '@json-layout/core'
import { getHelp, getHelpFromState } from '../../src/shared/help.js'

const defaultOptions = { debounceInputMs: 0 }

describe('getHelp (fast path)', () => {
  it('returns title/description/help from a leaf', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        name: {
          type: 'string',
          title: 'Full name',
          description: 'Given name and family name',
          layout: { help: 'Up to 120 chars' }
        }
      }
    })
    const info = getHelp(compiledLayout, '/name')
    assert.ok(info)
    assert.equal(info?.title, 'Full name')
    assert.equal(info?.description, 'Given name and family name')
    assert.equal(info?.help, 'Up to 120 chars')
  })

  it('returns the object-level title at the root', async () => {
    const compiledLayout = await compile({
      type: 'object',
      title: 'Person',
      properties: { a: { type: 'string' } }
    })
    const info = getHelp(compiledLayout, '')
    assert.ok(info)
    assert.equal(info?.title, 'Person')
  })

  it('returns an empty info object (not null) for a path without text', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: { a: { type: 'string' } }
    })
    const info = getHelp(compiledLayout, '/a')
    assert.ok(info)
    assert.equal(info?.title, undefined)
    assert.equal(info?.description, undefined)
    assert.equal(info?.help, undefined)
  })

  it('returns null for an unknown path', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: { a: { type: 'string' } }
    })
    assert.equal(getHelp(compiledLayout, '/missing'), null)
  })
})

describe('getHelpFromState (committed path)', () => {
  it('returns the resolved layout title/description/help from a StateNode', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        name: {
          type: 'string',
          title: 'Full name',
          description: 'Given + family',
          layout: { help: 'Up to 120 chars' }
        }
      }
    })
    const statefulLayout = new StatefulLayout(
      compiledLayout,
      compiledLayout.skeletonTrees[compiledLayout.mainTree],
      defaultOptions,
      { name: 'Ada' }
    )
    const info = getHelpFromState(statefulLayout, '/name')
    assert.ok(info)
    assert.equal(info?.title, 'Full name')
    assert.equal(info?.description, 'Given + family')
    assert.equal(info?.help, 'Up to 120 chars')
  })

  it('returns null for an unknown path', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: { a: { type: 'string' } }
    })
    const statefulLayout = new StatefulLayout(
      compiledLayout,
      compiledLayout.skeletonTrees[compiledLayout.mainTree],
      defaultOptions,
      { a: 'x' }
    )
    assert.equal(getHelpFromState(statefulLayout, '/missing'), null)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test code/test/shared/help.spec.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `getHelp` and `getHelpFromState`**

Create `code/src/shared/help.js`:

```javascript
/**
 * @file Title/description/help resolution — fast path (NormalizedLayout) and
 * committed path (resolved StateNode layout).
 */

import { lookupNormalizedLayout, resolveNode } from '@json-layout/core'
import { isSwitchStruct } from '@json-layout/vocabulary'

/** @typedef {import('./types.js').HelpInfo} HelpInfo */

/**
 * @param {any} compObject
 * @returns {HelpInfo}
 */
function pickHelp (compObject) {
  /** @type {HelpInfo} */
  const info = {}
  if (compObject && typeof compObject === 'object') {
    if (typeof compObject.title === 'string') info.title = compObject.title
    if (typeof compObject.description === 'string') info.description = compObject.description
    if (typeof compObject.help === 'string') info.help = compObject.help
  }
  return info
}

/**
 * Fast-path help lookup — reads the first comp object of the matched
 * NormalizedLayout. Does not evaluate expressions; usable on every keystroke.
 *
 * @param {import('@json-layout/core').CompiledLayout} compiledLayout
 * @param {string} path
 * @returns {HelpInfo | null}
 */
export function getHelp (compiledLayout, path) {
  const layout = lookupNormalizedLayout(compiledLayout, path)
  if (!layout) return null
  const compObject = isSwitchStruct(layout) ? layout.switch[0] : layout
  return pickHelp(compObject)
}

/**
 * Committed-path help lookup — reads the resolved StateNode's layout, which
 * already reflects expression evaluation and conditional visibility.
 *
 * @param {import('@json-layout/core').StatefulLayout} statefulLayout
 * @param {string} path
 * @returns {HelpInfo | null}
 */
export function getHelpFromState (statefulLayout, path) {
  const node = resolveNode(statefulLayout.stateTree.root, path)
  if (!node) return null
  return pickHelp(node.layout)
}
```

- [ ] **Step 4: Add `help.js` to the shared barrel**

Replace `code/src/shared/index.js` with:

```javascript
export * from './completion/index.js'
export { getHelp, getHelpFromState } from './help.js'
```

- [ ] **Step 5: Run tests**

Run: `node --test code/test/shared/help.spec.js`
Expected: All 6 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add code/src/shared/help.js code/src/shared/index.js code/test/shared/help.spec.js
git commit -m "feat(code): add shared/help for title/description/help lookup"
```

---

### Task 7: `shared/diagnostics.js` — StatefulLayout errors → text ranges

**Files:**
- Create: `code/src/shared/diagnostics.js`
- Modify: `code/src/shared/index.js`
- Create: `code/test/shared/diagnostics.spec.js`

Semantic contract: `collectDiagnostics(statefulLayout, text, formatAdapter)` returns a `Diagnostic[]`. It walks every `StateNode` reachable from `statefulLayout.stateTree.root` via `.children`, collects `{dataPath, error}` pairs where `error` is a string, maps each `dataPath` to a `{from, to}` range via `formatAdapter.pathToRange`, drops entries whose range is null (path no longer resolvable in the current text — a commit-skew case), and returns one diagnostic per surviving entry.

`StateNode` already carries an i18n-resolved error message (message templating and locale happened in core), so this function performs no message work — just walking + range mapping.

- [ ] **Step 1: Write failing tests**

Create `code/test/shared/diagnostics.spec.js`:

```javascript
import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { compile, StatefulLayout } from '@json-layout/core'
import { jsonFormatAdapter } from '../../src/json/adapter.js'
import { collectDiagnostics } from '../../src/shared/diagnostics.js'

const defaultOptions = { debounceInputMs: 0, initialValidation: 'always' }

describe('collectDiagnostics', () => {
  it('returns one diagnostic per invalid leaf, with a resolvable text range', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        age: { type: 'integer', minimum: 0 },
        email: { type: 'string', format: 'email' }
      }
    })
    const statefulLayout = new StatefulLayout(
      compiledLayout,
      compiledLayout.skeletonTrees[compiledLayout.mainTree],
      defaultOptions,
      { age: -1, email: 'not-an-email' }
    )
    const text = JSON.stringify({ age: -1, email: 'not-an-email' }, null, 2)
    const diags = collectDiagnostics(statefulLayout, text, jsonFormatAdapter)
    assert.ok(diags.length >= 2, `expected >= 2 diagnostics, got ${diags.length}`)
    const paths = diags.map(d => d.path)
    assert.ok(paths.includes('/age'), `missing /age in ${JSON.stringify(paths)}`)
    assert.ok(paths.includes('/email'), `missing /email in ${JSON.stringify(paths)}`)
    for (const d of diags) {
      assert.equal(d.severity, 'error')
      assert.equal(typeof d.message, 'string')
      assert.ok(d.from <= d.to)
      assert.ok(d.from >= 0 && d.to <= text.length)
    }
  })

  it('returns [] when the data is valid', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: { name: { type: 'string' } }
    })
    const statefulLayout = new StatefulLayout(
      compiledLayout,
      compiledLayout.skeletonTrees[compiledLayout.mainTree],
      defaultOptions,
      { name: 'ok' }
    )
    const diags = collectDiagnostics(statefulLayout, '{"name": "ok"}', jsonFormatAdapter)
    assert.deepEqual(diags, [])
  })

  it('drops diagnostics whose path does not resolve in the text', async () => {
    // StatefulLayout has an error at /age; we pass text that does not contain `age`.
    // pathToRange returns null → diagnostic must be filtered out.
    const compiledLayout = await compile({
      type: 'object',
      required: ['age'],
      properties: { age: { type: 'integer' } }
    })
    const statefulLayout = new StatefulLayout(
      compiledLayout,
      compiledLayout.skeletonTrees[compiledLayout.mainTree],
      defaultOptions,
      { age: 'not a number' }
    )
    const skewedText = '{}'
    const diags = collectDiagnostics(statefulLayout, skewedText, jsonFormatAdapter)
    // Expect no diagnostics targeted at /age (the /age key is not in `{}`).
    assert.ok(!diags.some(d => d.path === '/age'), `did not expect /age diagnostic on skewed text: ${JSON.stringify(diags)}`)
  })
})
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test code/test/shared/diagnostics.spec.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `collectDiagnostics`**

Create `code/src/shared/diagnostics.js`:

```javascript
/**
 * @file Map StatefulLayout errors to editor diagnostics with text ranges.
 */

/** @typedef {import('./types.js').Diagnostic} Diagnostic */

/**
 * Walk the state tree from the root and yield every node (incl. the root).
 * Iterative to avoid blowing the stack on deep trees.
 *
 * @param {import('@json-layout/core').StatefulLayout['stateTree']['root']} root
 * @returns {Generator<import('@json-layout/core').StatefulLayout['stateTree']['root']>}
 */
function * walkNodes (root) {
  /** @type {Array<any>} */
  const stack = [root]
  while (stack.length) {
    const node = stack.pop()
    if (!node) continue
    yield node
    if (Array.isArray(node.children)) {
      for (let i = node.children.length - 1; i >= 0; i--) stack.push(node.children[i])
    }
  }
}

/**
 * Produce one `Diagnostic` per state node that carries an error message,
 * mapped to a text range via `formatAdapter.pathToRange`. Entries whose range
 * cannot be resolved in the current text are silently dropped.
 *
 * @param {import('@json-layout/core').StatefulLayout} statefulLayout
 * @param {string} text
 * @param {{ pathToRange: (text: string, path: string) => { from: number, to: number } | null }} formatAdapter
 * @returns {Diagnostic[]}
 */
export function collectDiagnostics (statefulLayout, text, formatAdapter) {
  /** @type {Diagnostic[]} */
  const out = []
  for (const node of walkNodes(statefulLayout.stateTree.root)) {
    if (typeof node.error !== 'string') continue
    const range = formatAdapter.pathToRange(text, node.dataPath)
    if (!range) continue
    out.push({
      from: range.from,
      to: range.to,
      path: node.dataPath,
      message: node.error,
      severity: 'error'
    })
  }
  return out
}
```

- [ ] **Step 4: Add `diagnostics.js` to the shared barrel**

Replace `code/src/shared/index.js` with:

```javascript
export * from './completion/index.js'
export { getHelp, getHelpFromState } from './help.js'
export { collectDiagnostics } from './diagnostics.js'
```

- [ ] **Step 5: Run tests**

Run: `node --test code/test/shared/diagnostics.spec.js`
Expected: All 3 tests PASS.

If the "returns >= 2 diagnostics" assertion fails because `StatefulLayout` has not validated yet, confirm that `initialValidation: 'always'` is being honored (it is the reason for including it in `defaultOptions`). If the test still underreports, log the node tree:

```javascript
for (const n of [...walkNodes(statefulLayout.stateTree.root)]) {
  console.log(n.dataPath, n.error)
}
```

and adjust based on the actual error placement. Do NOT weaken the assertion unless the expected behavior is genuinely different, in which case report DONE_WITH_CONCERNS and the controller will update the plan.

- [ ] **Step 6: Commit**

```bash
git add code/src/shared/diagnostics.js code/src/shared/index.js code/test/shared/diagnostics.spec.js
git commit -m "feat(code): add shared/diagnostics to map StatefulLayout errors to ranges"
```

---

### Task 8: Barrel smoke test + final quality check

**Files:**
- Create: `code/test/shared/barrel.spec.js`

This is the "nothing drifted" gate. Confirms every public symbol lands in both the `shared/` barrel and the root `@json-layout/code` barrel.

- [ ] **Step 1: Write the smoke test**

Create `code/test/shared/barrel.spec.js`:

```javascript
import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import * as sharedBarrel from '../../src/shared/index.js'
import * as rootBarrel from '../../src/index.js'

const expectedSymbols = [
  'getValueCandidates',
  'getPropertyCandidates',
  'getVariantCandidates',
  'getDynamicCandidates',
  'getHelp',
  'getHelpFromState',
  'collectDiagnostics'
]

describe('shared barrel', () => {
  for (const name of expectedSymbols) {
    it(`exports ${name}`, () => {
      assert.equal(typeof (/** @type {any} */(sharedBarrel))[name], 'function')
    })
  }
})

describe('root barrel forwards shared symbols', () => {
  for (const name of expectedSymbols) {
    it(`re-exports ${name}`, () => {
      assert.equal(typeof (/** @type {any} */(rootBarrel))[name], 'function')
    })
  }

  it('still exposes the json adapter alongside shared symbols', () => {
    assert.equal(typeof (/** @type {any} */(rootBarrel)).jsonFormatAdapter, 'object')
  })
})
```

- [ ] **Step 2: Run the full code test suite**

Run: `npm test -w code`
Expected: all tests across `json/*` (39 from Plan 2) + `shared/*` (5 + 7 + 4 + 3 + 6 + 3 + 15 = 43) pass. Total ≈ 82 tests. Exact count may drift ±a few with test style; the key requirement is: zero failures.

- [ ] **Step 3: Run the project quality pipeline**

Run: `npm run quality` from the repo root.
Expected: `lint` + `build` + `test` pass for every workspace (vocabulary, core, examples, code).

If lint complains about `code/src/shared/types.ts`, confirm the repo-root `eslint.config.mjs` `ignores` entry already covers `code/**/types.ts` (it was added in Plan 2 Task 2 Step 5 if needed). If it does not match this nested path, extend the glob — but test first; the existing pattern should already cover `code/src/shared/types.ts`.

- [ ] **Step 4: Verify no unrelated files drifted**

Run: `git diff --stat main..HEAD -- ':!core' ':!code' ':!docs/superpowers'`

Expected: Apart from possibly `package.json` / `package-lock.json` at the repo root (from Plan 2), no non-core / non-code / non-plan files changed on this branch.

- [ ] **Step 5: Commit**

```bash
git add code/test/shared/barrel.spec.js
git commit -m "test(code): add shared barrel smoke test"
```

- [ ] **Step 6: Final summary**

Confirm deliverable vs goal:

- `code/src/shared/` exists with `types.ts`, `completion/`, `help.js`, `diagnostics.js`, `index.js`.
- `@json-layout/code` root barrel exposes: `getValueCandidates`, `getPropertyCandidates`, `getVariantCandidates`, `getDynamicCandidates`, `getHelp`, `getHelpFromState`, `collectDiagnostics` — plus everything from Plan 2.
- No module in `shared/` imports from `code/src/json/` — format adapter enters via parameter only.
- `npm run quality` green across all workspaces.

No additional commit — verification only.
