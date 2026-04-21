# Code Edition — Core Exposures Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose the four `core/` capabilities the upcoming `code/` workspace needs (`resolveNode` / `resolveSkeletonNode`, `scaffoldDefault`, `getFieldSuggestions`, `lookupNormalizedLayout`) so the editor never has to re-walk a raw JSON Schema. This plan lands entirely inside `core/`; the `code/` workspace is a separate, follow-on plan.

**Architecture:** Three new tiny modules under `core/src/utils/`: `resolve.js` (path → StateNode + path → SkeletonNode + normalized-layout lookup), `scaffold.js` (static default-data synthesis from skeleton + normalized layout), `suggestions.js` (the pure item-list builder currently inlined in the webmcp tool). Existing webmcp code becomes a thin wrapper over these utilities — no behavior change, just re-homing. Public API is re-exported from `core/src/index.js`.

**Tech Stack:** Plain JS + JSDoc, Node.js built-in test runner (existing convention).

**Spec:** `docs/superpowers/specs/2026-04-21-code-edition-design.md` — section *"Changes required in `core/`"*.

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `core/src/utils/resolve.js` | Create | `resolveNode(root, path)` + `resolveSkeletonNode(compiledLayout, path)` + `lookupNormalizedLayout(compiledLayout, path)` |
| `core/src/utils/scaffold.js` | Create | `scaffoldDefault(skeletonPointer, compiledLayout)` — static default-data synthesis |
| `core/src/utils/suggestions.js` | Create | `getFieldSuggestions(statefulLayout, args)` — extracted pure form |
| `core/src/webmcp/resolve.js` | Modify | Re-export `resolveNode` from `../utils/resolve.js` (keeps import paths alive for webmcp/tools/*) |
| `core/src/webmcp/tools/get-field-suggestions.js` | Modify | Thin wrapper delegating `execute` to `../../utils/suggestions.js` |
| `core/src/index.js` | Modify | Re-export the four new public utilities |
| `core/test/resolve.spec.js` | Create | Unit tests for `resolveNode`, `resolveSkeletonNode`, `lookupNormalizedLayout` |
| `core/test/scaffold.spec.js` | Create | Unit tests for `scaffoldDefault` covering all scaffolding rules |
| `core/test/suggestions.spec.js` | Create | Unit tests for the re-homed `getFieldSuggestions` (parity with prior behavior) |

Each new utility file is single-purpose and self-contained. The existing `webmcp/resolve.js` and `webmcp/tools/get-field-suggestions.js` become thin re-exports so no caller-site churn is required.

---

### Task 1: Create `core/src/utils/resolve.js` with `resolveNode`

**Files:**
- Create: `core/src/utils/resolve.js`
- Create: `core/test/resolve.spec.js`

- [ ] **Step 1: Write failing test for `resolveNode`**

Create `core/test/resolve.spec.js`:

```javascript
import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { compile, StatefulLayout } from '../src/index.js'
import { resolveNode } from '../src/utils/resolve.js'

const defaultOptions = { debounceInputMs: 0 }

describe('resolveNode', () => {
  it('should return root for empty or "/" path', async () => {
    const compiledLayout = await compile({ type: 'object', properties: { a: { type: 'string' } } })
    const statefulLayout = new StatefulLayout(
      compiledLayout,
      compiledLayout.skeletonTrees[compiledLayout.mainTree],
      defaultOptions,
      { a: 'x' }
    )
    const root = statefulLayout.stateTree.root
    assert.equal(resolveNode(root, ''), root)
    assert.equal(resolveNode(root, '/'), root)
  })

  it('should resolve an object property by name', async () => {
    const compiledLayout = await compile({ type: 'object', properties: { a: { type: 'string' } } })
    const statefulLayout = new StatefulLayout(
      compiledLayout,
      compiledLayout.skeletonTrees[compiledLayout.mainTree],
      defaultOptions,
      { a: 'hello' }
    )
    const node = resolveNode(statefulLayout.stateTree.root, '/a')
    assert.equal(node?.data, 'hello')
  })

  it('should resolve an array index as number', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        arr: { type: 'array', layout: 'list', items: { type: 'string' } }
      }
    })
    const statefulLayout = new StatefulLayout(
      compiledLayout,
      compiledLayout.skeletonTrees[compiledLayout.mainTree],
      defaultOptions,
      { arr: ['one', 'two'] }
    )
    const node = resolveNode(statefulLayout.stateTree.root, '/arr/1')
    assert.equal(node?.data, 'two')
  })

  it('should return undefined for unknown path', async () => {
    const compiledLayout = await compile({ type: 'object', properties: { a: { type: 'string' } } })
    const statefulLayout = new StatefulLayout(
      compiledLayout,
      compiledLayout.skeletonTrees[compiledLayout.mainTree],
      defaultOptions,
      { a: 'x' }
    )
    assert.equal(resolveNode(statefulLayout.stateTree.root, '/b'), undefined)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test core/test/resolve.spec.js`
Expected: FAIL — `Cannot find module '../src/utils/resolve.js'`.

- [ ] **Step 3: Create `core/src/utils/resolve.js` with `resolveNode`**

Create `core/src/utils/resolve.js`:

```javascript
/**
 * @file Path → node resolution utilities shared by webmcp and code workspaces.
 */

/**
 * Navigate from a root StateNode to a descendant node by JSON pointer path.
 * @param {import('../state/types.js').StateNode} root
 * @param {string} path - JSON pointer (e.g. '', '/', '/a/b', '/arr/0')
 * @returns {import('../state/types.js').StateNode | undefined}
 */
export function resolveNode (root, path) {
  if (!path || path === '/') return root
  const segments = path.replace(/^\//, '').split('/')
  /** @type {import('../state/types.js').StateNode | undefined} */
  let current = root
  for (const segment of segments) {
    if (!current?.children) return undefined
    const key = /^\d+$/.test(segment) ? parseInt(segment, 10) : segment
    current = current.children.find((c) => c.key === key)
  }
  return current
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test core/test/resolve.spec.js`
Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add core/src/utils/resolve.js core/test/resolve.spec.js
git commit -m "feat(core): add utils/resolve.js with resolveNode"
```

---

### Task 2: Re-home `webmcp/resolve.js` as a thin re-export

**Files:**
- Modify: `core/src/webmcp/resolve.js`

- [ ] **Step 1: Replace file with re-export**

Overwrite `core/src/webmcp/resolve.js` with:

```javascript
/**
 * @file Kept for backward compatibility; re-exports resolveNode from utils.
 */
export { resolveNode } from '../utils/resolve.js'
```

- [ ] **Step 2: Run full core test suite to confirm no regression**

Run: `node --test core/test/*.spec.js`
Expected: All existing tests PASS (`webmcp.spec.js` in particular relies on the old path through `webmcp/tools/get-field-suggestions.js` → `webmcp/resolve.js`).

- [ ] **Step 3: Commit**

```bash
git add core/src/webmcp/resolve.js
git commit -m "refactor(core): re-export resolveNode from utils location"
```

---

### Task 3: Add `resolveSkeletonNode` and `lookupNormalizedLayout`

**Files:**
- Modify: `core/src/utils/resolve.js`
- Modify: `core/test/resolve.spec.js`

Rationale: `resolveNode` needs a `StatefulLayout` to exist. The code workspace needs a fast-path equivalent that works from the skeleton alone (no data, no expression eval), and a convenience that returns the matched `NormalizedLayout`.

- [ ] **Step 1: Write failing tests**

Append to `core/test/resolve.spec.js`:

```javascript
import { resolveSkeletonNode, lookupNormalizedLayout } from '../src/utils/resolve.js'

describe('resolveSkeletonNode', () => {
  it('should return the main tree root for empty or "/" path', async () => {
    const compiledLayout = await compile({ type: 'object', properties: { a: { type: 'string' } } })
    const mainTree = compiledLayout.skeletonTrees[compiledLayout.mainTree]
    const rootNode = compiledLayout.skeletonNodes[mainTree.root]
    assert.equal(resolveSkeletonNode(compiledLayout, ''), rootNode)
    assert.equal(resolveSkeletonNode(compiledLayout, '/'), rootNode)
  })

  it('should resolve a nested property', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        outer: {
          type: 'object',
          properties: { inner: { type: 'string' } }
        }
      }
    })
    const node = resolveSkeletonNode(compiledLayout, '/outer/inner')
    assert.ok(node)
    assert.equal(node?.key, 'inner')
  })

  it('should resolve an array item pointer', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        arr: { type: 'array', layout: 'list', items: { type: 'string' } }
      }
    })
    // Array items share the same skeleton regardless of index.
    const arrayNode = resolveSkeletonNode(compiledLayout, '/arr')
    assert.ok(arrayNode)
    assert.equal(arrayNode?.key, 'arr')
    const itemNode = resolveSkeletonNode(compiledLayout, '/arr/0')
    assert.ok(itemNode)
  })

  it('should return undefined for unknown path', async () => {
    const compiledLayout = await compile({ type: 'object', properties: { a: { type: 'string' } } })
    assert.equal(resolveSkeletonNode(compiledLayout, '/b'), undefined)
  })
})

describe('lookupNormalizedLayout', () => {
  it('should return the normalized layout for root', async () => {
    const compiledLayout = await compile({ type: 'object', properties: { a: { type: 'string' } } })
    const layout = lookupNormalizedLayout(compiledLayout, '')
    assert.ok(layout)
    // The root is an object section; its pointer is the tree root's pointer.
    const mainTree = compiledLayout.skeletonTrees[compiledLayout.mainTree]
    const rootNode = compiledLayout.skeletonNodes[mainTree.root]
    assert.equal(layout, compiledLayout.normalizedLayouts[rootNode.pointer])
  })

  it('should return the normalized layout for a nested leaf', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: { a: { type: 'string', title: 'A title' } }
    })
    const layout = lookupNormalizedLayout(compiledLayout, '/a')
    assert.ok(layout)
    const leaf = /** @type {any} */(layout)
    assert.equal(leaf.title, 'A title')
  })

  it('should return undefined for unknown path', async () => {
    const compiledLayout = await compile({ type: 'object', properties: { a: { type: 'string' } } })
    assert.equal(lookupNormalizedLayout(compiledLayout, '/missing'), undefined)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test core/test/resolve.spec.js`
Expected: FAIL — `resolveSkeletonNode` / `lookupNormalizedLayout` not exported.

- [ ] **Step 3: Implement `resolveSkeletonNode` and `lookupNormalizedLayout`**

Append to `core/src/utils/resolve.js`:

```javascript
/**
 * Navigate the skeleton tree (no StatefulLayout required) from a JSON pointer path.
 * Array indices resolve to the array's item skeleton (indexed children are homogeneous at this level).
 * oneOf / anyOf unions walk into their first child tree when the next segment is not a numeric index
 * and does not match any direct child key — callers needing variant-aware routing should use
 * `StatefulLayout` + `resolveNode` instead.
 *
 * @param {import('../compile/types.js').CompiledLayout} compiledLayout
 * @param {string} path
 * @returns {import('../compile/types.js').SkeletonNode | undefined}
 */
export function resolveSkeletonNode (compiledLayout, path) {
  const mainTree = compiledLayout.skeletonTrees[compiledLayout.mainTree]
  /** @type {import('../compile/types.js').SkeletonNode | undefined} */
  let current = compiledLayout.skeletonNodes[mainTree.root]
  if (!path || path === '/') return current
  const segments = path.replace(/^\//, '').split('/')
  for (const segment of segments) {
    if (!current) return undefined
    const childPointers = current.children
    if (!childPointers?.length) {
      // Could be an array item — walk into the single array-item child if present.
      const normalized = /** @type {any} */(compiledLayout.normalizedLayouts[current.pointer])
      if (normalized?.comp === 'list' && /^\d+$/.test(segment)) {
        // Array items share skeleton: the array's item skeleton is the tree it references.
        if (current.childrenTrees?.length) {
          const itemTreeName = current.childrenTrees[0]
          current = compiledLayout.skeletonNodes[compiledLayout.skeletonTrees[itemTreeName].root]
          continue
        }
      }
      return undefined
    }
    const asNumber = /^\d+$/.test(segment) ? parseInt(segment, 10) : null
    const match = childPointers
      .map((p) => compiledLayout.skeletonNodes[p])
      .find((c) => c.key === segment || (asNumber !== null && c.key === asNumber))
    if (!match) {
      // Array item path with numeric segment when array's items live in a child tree.
      if (asNumber !== null && current.childrenTrees?.length) {
        const itemTreeName = current.childrenTrees[0]
        current = compiledLayout.skeletonNodes[compiledLayout.skeletonTrees[itemTreeName].root]
        continue
      }
      return undefined
    }
    current = match
  }
  return current
}

/**
 * Convenience: path → matched NormalizedLayout via the skeleton.
 * @param {import('../compile/types.js').CompiledLayout} compiledLayout
 * @param {string} path
 * @returns {import('@json-layout/vocabulary').NormalizedLayout | undefined}
 */
export function lookupNormalizedLayout (compiledLayout, path) {
  const node = resolveSkeletonNode(compiledLayout, path)
  if (!node) return undefined
  return compiledLayout.normalizedLayouts[node.pointer]
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test core/test/resolve.spec.js`
Expected: All tests PASS (old 4 + new 7 = 11).

- [ ] **Step 5: Commit**

```bash
git add core/src/utils/resolve.js core/test/resolve.spec.js
git commit -m "feat(core): add resolveSkeletonNode and lookupNormalizedLayout"
```

---

### Task 4: Add `scaffoldDefault` — scaffolding skeleton with static defaults

**Files:**
- Create: `core/src/utils/scaffold.js`
- Create: `core/test/scaffold.spec.js`

Approach: walk the skeleton, pull `defaultData` from each matched `NormalizedLayout` (which is already populated statically for required children, nullable children, and schema `default` values — see `core/src/compile/skeleton-node.js:138-147`). For object roots, include required children only. For oneOf unions (`skeleton.childrenTrees`), pick the first variant and fill in the discriminator property when present. For arrays, return `[]`.

This is the static subset of `StatefulLayout`'s default-hydration logic — intentional for v1: it avoids expression evaluation (which needs a parent data context that does not exist at scaffold time) while reusing the same `defaultData` the normalized layout already encodes. Tests below confirm parity with `StatefulLayout.stateTree.root.data` for the cases the editor uses (property scaffolds, oneOf variant scaffolds, required-object scaffolds).

- [ ] **Step 1: Write failing test for a string leaf with default**

Create `core/test/scaffold.spec.js`:

```javascript
import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { compile } from '../src/index.js'
import { scaffoldDefault } from '../src/utils/scaffold.js'

describe('scaffoldDefault', () => {
  it('should return the schema default for a leaf when the leaf is required', async () => {
    const compiledLayout = await compile({
      type: 'object',
      required: ['greeting'],
      properties: {
        greeting: { type: 'string', default: 'hello' }
      }
    })
    const mainTree = compiledLayout.skeletonTrees[compiledLayout.mainTree]
    const rootSkeleton = compiledLayout.skeletonNodes[mainTree.root]
    const greetingPointer = /** @type {string[]} */(rootSkeleton.children)
      .map(p => compiledLayout.skeletonNodes[p])
      .find(n => n.key === 'greeting').pointer
    assert.equal(scaffoldDefault(greetingPointer, compiledLayout), 'hello')
  })

  it('should return undefined for an optional leaf with no default', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: { greeting: { type: 'string' } }
    })
    const mainTree = compiledLayout.skeletonTrees[compiledLayout.mainTree]
    const rootSkeleton = compiledLayout.skeletonNodes[mainTree.root]
    const greetingPointer = /** @type {string[]} */(rootSkeleton.children)
      .map(p => compiledLayout.skeletonNodes[p])
      .find(n => n.key === 'greeting').pointer
    assert.equal(scaffoldDefault(greetingPointer, compiledLayout), undefined)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test core/test/scaffold.spec.js`
Expected: FAIL — `Cannot find module '../src/utils/scaffold.js'`.

- [ ] **Step 3: Implement the leaf case**

Create `core/src/utils/scaffold.js`:

```javascript
/**
 * @file Static default-data scaffolding from a compiled skeleton.
 * Uses the already-normalized layout's defaultData and skeleton structure —
 * does NOT evaluate getDefaultData / getConstData expressions.
 */

import { isSwitchStruct } from '@json-layout/vocabulary'

/**
 * @param {import('@json-layout/vocabulary').NormalizedLayout} normalizedLayout
 * @returns {import('@json-layout/vocabulary').BaseCompObject}
 */
function firstCompObject (normalizedLayout) {
  return isSwitchStruct(normalizedLayout) ? normalizedLayout.switch[0] : /** @type {any} */(normalizedLayout)
}

/**
 * Produce a default value for the subtree rooted at `skeletonPointer`, using only static rules:
 * schema `default`, required propagation in objects, oneOf variant defaulting + discriminator fill,
 * `[]` for arrays, `undefined` for optional leaves.
 *
 * @param {string} skeletonPointer
 * @param {import('../compile/types.js').CompiledLayout} compiledLayout
 * @returns {unknown}
 */
export function scaffoldDefault (skeletonPointer, compiledLayout) {
  const skeleton = compiledLayout.skeletonNodes[skeletonPointer]
  if (!skeleton) return undefined
  const normalized = compiledLayout.normalizedLayouts[skeleton.pointer]
  const compObject = firstCompObject(normalized)

  if (compObject.defaultData !== undefined) return compObject.defaultData

  return undefined
}
```

- [ ] **Step 4: Run test to verify the two leaf tests pass**

Run: `node --test core/test/scaffold.spec.js`
Expected: Both tests PASS.

- [ ] **Step 5: Write failing tests for object + array + oneOf cases**

Append to `core/test/scaffold.spec.js`:

```javascript
  it('should scaffold a required object with required children only', async () => {
    const compiledLayout = await compile({
      type: 'object',
      required: ['str', 'num'],
      properties: {
        str: { type: 'string', default: 'x' },
        num: { type: 'integer', default: 0 },
        opt: { type: 'string', default: 'ignored' }
      }
    })
    const mainTree = compiledLayout.skeletonTrees[compiledLayout.mainTree]
    assert.deepEqual(scaffoldDefault(mainTree.root, compiledLayout), { str: 'x', num: 0 })
  })

  it('should scaffold an array as []', async () => {
    const compiledLayout = await compile({
      type: 'object',
      required: ['arr'],
      properties: {
        arr: { type: 'array', layout: 'list', items: { type: 'string' } }
      }
    })
    const mainTree = compiledLayout.skeletonTrees[compiledLayout.mainTree]
    const rootSkeleton = compiledLayout.skeletonNodes[mainTree.root]
    const arrPointer = /** @type {string[]} */(rootSkeleton.children)
      .map(p => compiledLayout.skeletonNodes[p])
      .find(n => n.key === 'arr').pointer
    assert.deepEqual(scaffoldDefault(arrPointer, compiledLayout), [])
  })

  it('should scaffold a required nested object recursively', async () => {
    const compiledLayout = await compile({
      type: 'object',
      required: ['outer'],
      properties: {
        outer: {
          type: 'object',
          required: ['inner'],
          properties: {
            inner: { type: 'string', default: 'in' }
          }
        }
      }
    })
    const mainTree = compiledLayout.skeletonTrees[compiledLayout.mainTree]
    assert.deepEqual(
      scaffoldDefault(mainTree.root, compiledLayout),
      { outer: { inner: 'in' } }
    )
  })

  it('should scaffold a oneOf by picking the first variant', async () => {
    const compiledLayout = await compile({
      type: 'object',
      required: ['value'],
      properties: {
        value: {
          oneOf: [
            { type: 'object', required: ['a'], properties: { a: { type: 'string', default: 'A' } } },
            { type: 'object', required: ['b'], properties: { b: { type: 'integer', default: 1 } } }
          ]
        }
      }
    })
    const mainTree = compiledLayout.skeletonTrees[compiledLayout.mainTree]
    const result = /** @type {any} */(scaffoldDefault(mainTree.root, compiledLayout))
    assert.deepEqual(result.value, { a: 'A' })
  })

  it('should fill in the discriminator property for a discriminated oneOf', async () => {
    const compiledLayout = await compile({
      type: 'object',
      required: ['value'],
      properties: {
        value: {
          discriminator: { propertyName: 'kind' },
          required: ['kind'],
          oneOf: [
            {
              properties: { kind: { const: 'alpha' }, a: { type: 'string', default: 'A' } },
              required: ['a']
            },
            {
              properties: { kind: { const: 'beta' }, b: { type: 'integer', default: 2 } },
              required: ['b']
            }
          ]
        }
      }
    })
    const mainTree = compiledLayout.skeletonTrees[compiledLayout.mainTree]
    const result = /** @type {any} */(scaffoldDefault(mainTree.root, compiledLayout))
    assert.equal(result.value.kind, 'alpha')
    assert.equal(result.value.a, 'A')
  })
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `node --test core/test/scaffold.spec.js`
Expected: All 5 new tests FAIL — current implementation only handles leaves with static defaults.

- [ ] **Step 7: Extend `scaffoldDefault` with composite handling**

Replace the body of `scaffoldDefault` in `core/src/utils/scaffold.js` with:

```javascript
export function scaffoldDefault (skeletonPointer, compiledLayout) {
  const skeleton = compiledLayout.skeletonNodes[skeletonPointer]
  if (!skeleton) return undefined
  const normalized = compiledLayout.normalizedLayouts[skeleton.pointer]
  const compObject = firstCompObject(normalized)

  // oneOf / anyOf variants live in childrenTrees — pick the first variant and fill discriminator.
  if (skeleton.childrenTrees?.length) {
    const variantTreeName = skeleton.childrenTrees[0]
    const variantTree = compiledLayout.skeletonTrees[variantTreeName]
    const variantData = scaffoldDefault(variantTree.root, compiledLayout)
    if (skeleton.discriminator && variantTree.discriminatorValue !== undefined) {
      const obj = (variantData && typeof variantData === 'object' && !Array.isArray(variantData))
        ? /** @type {Record<string, unknown>} */(variantData)
        : {}
      obj[skeleton.discriminator] = variantTree.discriminatorValue
      return obj
    }
    return variantData
  }

  // Composite object: recurse into required children.
  if (skeleton.children?.length && compObject.comp === 'section') {
    /** @type {Record<string, unknown>} */
    const result = {}
    for (const childPointer of skeleton.children) {
      const child = compiledLayout.skeletonNodes[childPointer]
      if (!child.required) continue
      if (typeof child.key !== 'string' || child.key.startsWith('$')) continue
      const childValue = scaffoldDefault(childPointer, compiledLayout)
      if (childValue !== undefined) result[child.key] = childValue
    }
    return result
  }

  // Leaf or other layouts with a static default.
  if (compObject.defaultData !== undefined) return compObject.defaultData

  return undefined
}
```

- [ ] **Step 8: Run all scaffold tests**

Run: `node --test core/test/scaffold.spec.js`
Expected: All 7 tests PASS.

- [ ] **Step 9: Write parity test against StatefulLayout**

Append to `core/test/scaffold.spec.js`:

```javascript
import { StatefulLayout } from '../src/index.js'

describe('scaffoldDefault parity with StatefulLayout', () => {
  it('matches StatefulLayout root data for an object with required children', async () => {
    const schema = {
      type: 'object',
      required: ['a', 'b'],
      properties: {
        a: { type: 'string', default: 'A' },
        b: { type: 'integer', default: 7 }
      }
    }
    const compiledLayout = await compile(schema)
    const statefulLayout = new StatefulLayout(
      compiledLayout,
      compiledLayout.skeletonTrees[compiledLayout.mainTree],
      { debounceInputMs: 0 },
      undefined
    )
    const scaffolded = scaffoldDefault(compiledLayout.skeletonTrees[compiledLayout.mainTree].root, compiledLayout)
    assert.deepEqual(scaffolded, statefulLayout.stateTree.root.data)
  })
})
```

- [ ] **Step 10: Run parity test**

Run: `node --test core/test/scaffold.spec.js`
Expected: PASS. If it fails, the failure output will show where `scaffoldDefault` diverges from `StatefulLayout`'s hydration — investigate and fix; do NOT loosen the assertion.

- [ ] **Step 11: Commit**

```bash
git add core/src/utils/scaffold.js core/test/scaffold.spec.js
git commit -m "feat(core): add scaffoldDefault utility for code-edition scaffolding"
```

---

### Task 5: Extract `getFieldSuggestions` to `utils/suggestions.js`

**Files:**
- Create: `core/src/utils/suggestions.js`
- Modify: `core/src/webmcp/tools/get-field-suggestions.js`
- Create: `core/test/suggestions.spec.js`

The existing webmcp tool's `execute(statefulLayout, args)` already does exactly what `code/` needs. We lift that function into `utils/suggestions.js` and keep the webmcp tool as a thin passthrough so `core/test/webmcp.spec.js` keeps passing unchanged.

- [ ] **Step 1: Write failing test that imports from the new location**

Create `core/test/suggestions.spec.js`:

```javascript
import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { compile, StatefulLayout } from '../src/index.js'
import { getFieldSuggestions } from '../src/utils/suggestions.js'

const defaultOptions = { debounceInputMs: 0 }

describe('getFieldSuggestions', () => {
  it('returns enum items for a select-style leaf', async () => {
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
    const result = await getFieldSuggestions(statefulLayout, { path: '/color' })
    assert.ok(Array.isArray(result.items))
    assert.equal(result.items.length, 3)
    assert.deepEqual(result.items.map(i => i.value), ['red', 'green', 'blue'])
  })

  it('throws when path is unknown', async () => {
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
    await assert.rejects(
      getFieldSuggestions(statefulLayout, { path: '/missing' }),
      /node not found at path: \/missing/
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test core/test/suggestions.spec.js`
Expected: FAIL — `Cannot find module '../src/utils/suggestions.js'`.

- [ ] **Step 3: Create `core/src/utils/suggestions.js` by lifting logic from the webmcp tool**

Create `core/src/utils/suggestions.js`:

```javascript
/**
 * @file Pure field-suggestions computation used by both webmcp and code workspaces.
 */

import { resolveNode } from './resolve.js'

/**
 * Get available suggestions for a select / autocomplete / combobox / one-of-select field.
 * @param {import('../state/index.js').StatefulLayout} statefulLayout
 * @param {{ path: string, query?: string }} args
 * @returns {Promise<{items: Array<{value: unknown, title: string, key?: string}>}>}
 */
export async function getFieldSuggestions (statefulLayout, args) {
  const node = resolveNode(statefulLayout.stateTree.root, args.path)
  if (!node) {
    throw new Error(`node not found at path: ${args.path}`)
  }

  if (node.layout.comp === 'one-of-select') {
    const layout = /** @type {Record<string, unknown>} */(node.layout)
    const oneOfItems = /** @type {Array<{header?: boolean, key: number, title: string}> | undefined} */(layout.oneOfItems)
    const items = (oneOfItems || [])
      .filter((item) => !item.header)
      .map((item) => ({ value: item.key, title: item.title }))
    return { items }
  }

  const rawItems = await statefulLayout.getItems(node, args.query)

  const items = rawItems
    .filter((item) => !item.header)
    .map((item) => {
      /** @type {{value: unknown, title: string, key?: string}} */
      const result = {
        value: item.value,
        title: item.title
      }
      if (/** @type {unknown} */(item.key) !== item.title) {
        result.key = /** @type {string} */(item.key)
      }
      return result
    })

  return { items }
}
```

- [ ] **Step 4: Run suggestions tests**

Run: `node --test core/test/suggestions.spec.js`
Expected: Both tests PASS.

- [ ] **Step 5: Slim the webmcp tool to a thin wrapper**

Replace the body of `core/src/webmcp/tools/get-field-suggestions.js`. Keep `inputSchema`, `outputSchema`, and `getDescription` (they're part of the webmcp tool contract), and delegate `execute` to the new utility:

```javascript
/**
 * @file getFieldSuggestions tool — thin wrapper over core/utils/suggestions.
 */

import { getFieldSuggestions } from '../../utils/suggestions.js'

export const inputSchema = {
  type: 'object',
  properties: {
    path: {
      type: 'string',
      description: 'Path to the field'
    },
    query: {
      type: 'string',
      description: 'Search query to filter suggestions'
    }
  },
  required: ['path']
}

export const outputSchema = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          value: {},
          title: { type: 'string' },
          key: { type: 'string' }
        }
      }
    }
  }
}

/**
 * @param {string} dataTitle
 * @returns {string}
 */
export function getDescription (dataTitle) {
  return `Get available options for a select/autocomplete/combobox field of form "${dataTitle}". Supports query-based filtering.`
}

/**
 * @param {import('../../state/index.js').StatefulLayout} statefulLayout
 * @param {{ path: string, query?: string }} args
 * @returns {Promise<{items: Array<{value: unknown, title: string, key?: string}>}>}
 */
export function execute (statefulLayout, args) {
  return getFieldSuggestions(statefulLayout, args)
}
```

- [ ] **Step 6: Run the existing webmcp test suite to confirm parity**

Run: `node --test core/test/webmcp.spec.js`
Expected: All existing webmcp tests PASS (no behavioral change).

- [ ] **Step 7: Run the full core test suite**

Run: `node --test core/test/*.spec.js`
Expected: All tests PASS.

- [ ] **Step 8: Commit**

```bash
git add core/src/utils/suggestions.js core/src/webmcp/tools/get-field-suggestions.js core/test/suggestions.spec.js
git commit -m "refactor(core): extract getFieldSuggestions to utils, keep webmcp tool as wrapper"
```

---

### Task 6: Publicly re-export the four utilities

**Files:**
- Modify: `core/src/index.js`

- [ ] **Step 1: Read current index.js**

The current file is:

```javascript
export * from './compile/index.js'
export * from './state/index.js'
export { default as i18n } from './i18n/index.js'
export { clone } from '@json-layout/vocabulary'
```

- [ ] **Step 2: Add re-exports for the new utilities**

Replace `core/src/index.js` with:

```javascript
export * from './compile/index.js'
export * from './state/index.js'
export { default as i18n } from './i18n/index.js'
export { clone } from '@json-layout/vocabulary'
export { resolveNode, resolveSkeletonNode, lookupNormalizedLayout } from './utils/resolve.js'
export { scaffoldDefault } from './utils/scaffold.js'
export { getFieldSuggestions } from './utils/suggestions.js'
```

- [ ] **Step 3: Write a smoke test using only the public `@json-layout/core` surface**

Append to `core/test/resolve.spec.js`:

```javascript
import * as publicApi from '../src/index.js'

describe('public API surface', () => {
  it('exports resolveNode, resolveSkeletonNode, lookupNormalizedLayout, scaffoldDefault, getFieldSuggestions', () => {
    assert.equal(typeof publicApi.resolveNode, 'function')
    assert.equal(typeof publicApi.resolveSkeletonNode, 'function')
    assert.equal(typeof publicApi.lookupNormalizedLayout, 'function')
    assert.equal(typeof publicApi.scaffoldDefault, 'function')
    assert.equal(typeof publicApi.getFieldSuggestions, 'function')
  })
})
```

- [ ] **Step 4: Run the test**

Run: `node --test core/test/resolve.spec.js`
Expected: All tests PASS, including the new public-API smoke test.

- [ ] **Step 5: Commit**

```bash
git add core/src/index.js core/test/resolve.spec.js
git commit -m "feat(core): export resolve/scaffold/suggestions utilities for code workspace"
```

---

### Task 7: Full quality check

**Files:** None (verification only)

- [ ] **Step 1: Run the project quality pipeline**

Run: `npm run quality`
Expected: `lint` + `build` + `test` all pass for every workspace.

This runs the same checks as the pre-commit hook. Any failure here means something in the new utilities tripped the monorepo's shared lint/type/test gates — fix and re-run before considering the plan complete.

- [ ] **Step 2: Verify no residual schema-walking was added outside `core/`**

Run: `node --eval "console.log('OK')"` — trivial; the real check is manual.
Expected: Only files under `core/src/` were touched. No changes outside `core/` except possibly `package-lock.json` at the root.

Run: `git diff --stat main..HEAD -- '*' ':!core'`
Expected: empty output (no non-core changes).

If the diff is non-empty, audit those files — the plan's invariant is that this whole deliverable lives inside `core/`.

- [ ] **Step 3: Final summary**

Confirm the public surface matches the spec's *"Changes required in `core/`"* section:

- `resolveNode(root, path)` — exported from `@json-layout/core`.
- `resolveSkeletonNode(compiledLayout, path)` — exported.
- `scaffoldDefault(skeletonPointer, compiledLayout)` — exported.
- `getFieldSuggestions(statefulLayout, args)` — exported.
- `lookupNormalizedLayout(compiledLayout, path)` — exported.

All five symbols accessible via `import { ... } from '@json-layout/core'`.
