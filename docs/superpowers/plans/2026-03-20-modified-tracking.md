# Modified Data Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `modified`/`childModified` flags to StateNodes by comparing current data against a saved snapshot, following the existing error/childError pattern.

**Architecture:** `savedData` is passed as a 5th constructor argument to StatefulLayout. During state tree creation, each node resolves its saved value via `dataPath` and compares against current data. Leaf nodes get `modified: boolean`, composite nodes get `childModified: boolean` via child aggregation. Arrays and oneOf nodes are compared as whole units — if different, the node is modified and children are not individually compared.

**Tech Stack:** `fast-deep-equal` (new explicit dependency), Immer (existing), Node.js native test runner (existing)

**Spec:** `docs/superpowers/specs/2026-03-20-modified-tracking-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `core/package.json` | Modify | Add `fast-deep-equal` dependency |
| `core/src/state/types.ts` | Modify | Add `modified`/`childModified` to `StateNode`, `savedData` to `CreateStateTreeContext`, extend `StateNodeCacheKey` |
| `core/src/state/utils/modified.js` | Create | `resolveDataPath()` helper + `isNodeModified()` comparison logic |
| `core/src/state/state-node.js` | Modify | Pass saved data through node creation, compute `modified`/`childModified`, add saved value to cache key |
| `core/src/state/index.js` | Modify | Add `savedData` constructor param, `savedData` setter, `modified` getter |
| `core/test/modified.spec.js` | Create | All tests for modified tracking |

---

### Task 1: Add `fast-deep-equal` dependency

**Files:**
- Modify: `core/package.json`

- [ ] **Step 1: Add fast-deep-equal to dependencies**

In `core/package.json`, add `"fast-deep-equal": "^3.1.3"` to the `dependencies` object.

- [ ] **Step 2: Install dependencies**

Run: `npm install`
Expected: Successful install, `fast-deep-equal` appears in `node_modules`

- [ ] **Step 3: Commit**

```bash
git add core/package.json package-lock.json
git commit -m "feat: add fast-deep-equal dependency for modified tracking"
```

---

### Task 2: Add type definitions

**Files:**
- Modify: `core/src/state/types.ts`

- [ ] **Step 1: Add modified/childModified to StateNode interface**

In `core/src/state/types.ts`, add two new optional properties to the `StateNode` interface after the `childError` line (line 47):

```typescript
  modified: boolean | undefined
  childModified: boolean | undefined
```

- [ ] **Step 2: Add savedData to CreateStateTreeContext**

In `core/src/state/types.ts`, add a new property to the `CreateStateTreeContext` interface after the `rootData` line (line 80):

```typescript
  savedData: unknown
```

- [ ] **Step 3: Extend StateNodeCacheKey**

In `core/src/state/types.ts`, add a 15th element to the `StateNodeCacheKey` tuple after the last `number` (line 105):

```typescript
  unknown // savedData resolved for this node
```

The tuple becomes 15 elements.

- [ ] **Step 4: Verify types compile**

Run: `cd core && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add core/src/state/types.ts
git commit -m "feat: add modified/childModified types to StateNode"
```

---

### Task 3: Create modified utility module

**Files:**
- Create: `core/src/state/utils/modified.js`
- Test: `core/test/modified.spec.js`

- [ ] **Step 1: Write failing test for resolveDataPath**

Create `core/test/modified.spec.js`:

```javascript
import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { resolveDataPath, isNodeModified } from '../src/state/utils/modified.js'

describe('Modified tracking utilities', () => {
  describe('resolveDataPath', () => {
    it('should resolve root path', () => {
      const data = { a: 1, b: 2 }
      assert.deepEqual(resolveDataPath(data, ''), data)
    })

    it('should resolve nested path', () => {
      const data = { a: { b: { c: 42 } } }
      assert.equal(resolveDataPath(data, '/a/b/c'), 42)
    })

    it('should resolve array index path', () => {
      const data = { arr: [10, 20, 30] }
      assert.equal(resolveDataPath(data, '/arr/1'), 20)
    })

    it('should return undefined for missing path', () => {
      const data = { a: 1 }
      assert.equal(resolveDataPath(data, '/b/c'), undefined)
    })

    it('should return undefined when data is undefined', () => {
      assert.equal(resolveDataPath(undefined, '/a'), undefined)
    })

    it('should return undefined when data is null', () => {
      assert.equal(resolveDataPath(null, '/a'), undefined)
    })
  })

  describe('isNodeModified', () => {
    it('should return false for equal primitive values', () => {
      assert.equal(isNodeModified('hello', 'hello'), false)
    })

    it('should return true for different primitive values', () => {
      assert.equal(isNodeModified('hello', 'world'), true)
    })

    it('should return false for reference-equal objects', () => {
      const obj = { a: 1 }
      assert.equal(isNodeModified(obj, obj), false)
    })

    it('should return false for deep-equal objects', () => {
      assert.equal(isNodeModified({ a: 1 }, { a: 1 }), false)
    })

    it('should return true for different objects', () => {
      assert.equal(isNodeModified({ a: 1 }, { a: 2 }), true)
    })

    it('should return true for undefined vs value', () => {
      assert.equal(isNodeModified(undefined, 'hello'), true)
    })

    it('should return true for value vs undefined', () => {
      assert.equal(isNodeModified('hello', undefined), true)
    })

    it('should return false when both undefined', () => {
      assert.equal(isNodeModified(undefined, undefined), false)
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd core && node --test test/modified.spec.js`
Expected: FAIL — module `../src/state/utils/modified.js` not found

- [ ] **Step 3: Implement resolveDataPath and isNodeModified**

Create `core/src/state/utils/modified.js`:

```javascript
import equal from 'fast-deep-equal'

/**
 * Resolve a JSON pointer data path against a data object.
 * @param {unknown} data
 * @param {string} dataPath - JSON pointer (e.g. '', '/a/b', '/arr/0')
 * @returns {unknown}
 */
export function resolveDataPath (data, dataPath) {
  if (dataPath === '') return data
  if (data === undefined || data === null) return undefined
  const segments = dataPath.slice(1).split('/')
  let current = data
  for (const segment of segments) {
    if (current === undefined || current === null || typeof current !== 'object') return undefined
    current = /** @type {any} */(current)[segment]
  }
  return current
}

/**
 * Compare a saved value against a current value.
 * The caller is responsible for checking if the feature is active (context.savedData !== undefined)
 * before calling this function.
 * @param {unknown} savedValue
 * @param {unknown} currentValue
 * @returns {boolean}
 */
export function isNodeModified (savedValue, currentValue) {
  if (savedValue === currentValue) return false
  return !equal(savedValue, currentValue)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd core && node --test test/modified.spec.js`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add core/src/state/utils/modified.js core/test/modified.spec.js
git commit -m "feat: add resolveDataPath and isNodeModified utilities"
```

---

### Task 4: Integrate modified tracking into state tree creation

**Files:**
- Modify: `core/src/state/index.js`

- [ ] **Step 1: Write failing integration test**

Add to `core/test/modified.spec.js`:

```javascript
import { compile, StatefulLayout } from '../src/index.js'

describe('Modified tracking integration', () => {
  const defaultOptions = { debounceInputMs: 0 }

  it('should have undefined modified flags when savedData is not provided', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: { str1: { type: 'string' } }
    })
    const statefulLayout = new StatefulLayout(
      compiledLayout,
      compiledLayout.skeletonTrees[compiledLayout.mainTree],
      defaultOptions,
      { str1: 'hello' }
    )
    assert.equal(statefulLayout.stateTree.root.modified, undefined)
    assert.equal(statefulLayout.stateTree.root.childModified, undefined)
    assert.equal(statefulLayout.stateTree.root.children?.[0].modified, undefined)
    assert.equal(statefulLayout.modified, false)
  })

  it('should detect modified leaf', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        str1: { type: 'string' },
        str2: { type: 'string' }
      }
    })
    const savedData = { str1: 'hello', str2: 'world' }
    const currentData = { str1: 'changed', str2: 'world' }
    const statefulLayout = new StatefulLayout(
      compiledLayout,
      compiledLayout.skeletonTrees[compiledLayout.mainTree],
      defaultOptions,
      currentData,
      savedData
    )
    // str1 changed
    assert.equal(statefulLayout.stateTree.root.children?.[0].modified, true)
    // str2 unchanged
    assert.equal(statefulLayout.stateTree.root.children?.[1].modified, false)
    // root section has childModified
    assert.equal(statefulLayout.stateTree.root.childModified, true)
    // top-level convenience
    assert.equal(statefulLayout.modified, true)
  })

  it('should detect no modifications when data equals savedData', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        str1: { type: 'string' },
        str2: { type: 'string' }
      }
    })
    const data = { str1: 'hello', str2: 'world' }
    const statefulLayout = new StatefulLayout(
      compiledLayout,
      compiledLayout.skeletonTrees[compiledLayout.mainTree],
      defaultOptions,
      data,
      { str1: 'hello', str2: 'world' }
    )
    assert.equal(statefulLayout.stateTree.root.children?.[0].modified, false)
    assert.equal(statefulLayout.stateTree.root.children?.[1].modified, false)
    assert.equal(statefulLayout.stateTree.root.childModified, false)
    assert.equal(statefulLayout.modified, false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd core && node --test test/modified.spec.js`
Expected: FAIL — StatefulLayout constructor doesn't accept 5th argument yet, `modified` property doesn't exist

- [ ] **Step 3: Add savedData to StatefulLayout constructor and createStateTree context**

In `core/src/state/index.js`:

1. Add `_savedData` private field. After line 184 (`files = []`), add:
```javascript
  /**
   * @private
   * @type {unknown}
   */
  _savedData
```

2. Update the constructor signature (line 192) from:
```javascript
  constructor (compiledLayout, skeletonTree, options, data) {
```
to:
```javascript
  constructor (compiledLayout, skeletonTree, options, data, savedData) {
```

3. Update the constructor JSDoc (lines 187-191) to add the savedData param:
```javascript
   * @param {unknown} [savedData]
```

4. Inside the constructor, after `this._data = data` (line 199), add:
```javascript
    this._savedData = savedData
```

5. Add the `modified` getter after the `hasHiddenError` getter (after line 363):
```javascript
  /**
   * @returns {boolean}
   */
  get modified () {
    if (this._savedData === undefined) return false
    return !!(this._stateTree.root.modified || this._stateTree.root.childModified)
  }
```

6. Add the `savedData` setter after the `modified` getter:
```javascript
  set savedData (savedData) {
    this._savedData = savedData
    this.updateState()
  }
```

7. In the `createStateTree` method (line 276), add `savedData` to the context object. After `rootData: this._data,` (line 286), add:
```javascript
      savedData: this._savedData,
```

- [ ] **Step 4: Run test to verify it still fails (modified flags not yet computed)**

Run: `cd core && node --test test/modified.spec.js`
Expected: FAIL — `modified` is `undefined` instead of expected values (the flags are not yet computed in state-node.js)

- [ ] **Step 5: Commit**

```bash
git add core/src/state/index.js
git commit -m "feat: add savedData param to StatefulLayout constructor and context"
```

---

### Task 5: Compute modified flags in createStateNode

**Files:**
- Modify: `core/src/state/state-node.js`

This is the core task. We need to:
1. Resolve the saved value for each node
2. For arrays and oneOf: deep-equal and suppress savedData for children if different
3. Compute `modified` for leaf nodes and modified arrays/oneOf
4. Compute `childModified` for composite nodes
5. Add saved value to cache key
6. Pass `modified`/`childModified` to `produceStateNode`

- [ ] **Step 1: Add imports**

At the top of `core/src/state/state-node.js`, add:

```javascript
import { resolveDataPath, isNodeModified } from './utils/modified.js'
```

- [ ] **Step 2: Add modified/childModified to produceStateNode**

The `produceStateNode` function (line 38) has 21 parameters after `draft`. Add 2 more at the end.

Update the JSDoc type (line 37) — add `modified: boolean | undefined, childModified: boolean | undefined` after `children`:

```javascript
/** @type {(draft: import('./types.js').StateNode, key: string | number, fullKey: string, parentFullKey: string | null, dataPath: string, parentDataPath: string | null, skeleton: import('../index.js').SkeletonNode, layout: import('@json-layout/vocabulary').BaseCompObject, width: number, cols: number, data: unknown, error: string | undefined, validated: boolean, options: import('./types.js').StateNodeOptions, titleDepth: number, autofocus: boolean, shouldLoadData: boolean, props: import('@json-layout/vocabulary').StateNodePropsLib, slots: import('@json-layout/vocabulary').Slots | undefined, itemsCacheKey: any, children: import('../index.js').StateNode[] | undefined, modified: boolean | undefined, childModified: boolean | undefined) => import('../index.js').StateNode} */
const produceStateNode = produce((draft, key, fullKey, parentFullKey, dataPath, parentDataPath, skeleton, layout, width, cols, data, error, validated, options, titleDepth, autofocus, shouldLoadData, props, slots, itemsCacheKey, children, modified, childModified) => {
```

Inside the function body, after the `draft.childError` line (line 57), add:

```javascript
  draft.modified = modified
  draft.childModified = childModified
```

- [ ] **Step 3: Add nodeSavedData resolution and suppressChildModified flag**

At the beginning of `createStateNode`, after the `logStateNode('createStateNode', fullKey)` line (line 375), add:

```javascript
  // Resolve saved data for this node (needed for cache key and modified computation)
  const nodeSavedData = context.savedData !== undefined ? resolveDataPath(context.savedData, dataPath) : undefined
  let suppressChildModified = false
```

- [ ] **Step 4: Add saved value to cache key**

In the cache key construction (lines 384-399), add the resolved saved value as position 14 (the 15th element). After `titleDepth` (line 398), add:

```javascript
      context.savedData !== undefined ? nodeSavedData : undefined,
```

- [ ] **Step 5: Suppress savedData for children of modified arrays**

For **array lists** (the `else` branch at line 695), BEFORE the `for` loop at line 701, add:

```javascript
      // For arrays: check if saved data differs, suppress child modified tracking if so
      const savedDataBackup = context.savedData
      if (context.savedData !== undefined && isNodeModified(nodeSavedData, nodeData)) {
        suppressChildModified = true
        context.savedData = undefined
      }
```

After the children loop and the optional active child duplication (after line 749), add restore with `try/finally` safety. Wrap the children loop (lines 701-749) in a `try/finally`:

```javascript
      try {
        // ... existing children loop code (lines 701-749) ...
      } finally {
        context.savedData = savedDataBackup
      }
```

- [ ] **Step 6: Suppress savedData for children of modified oneOf**

For **oneOf** (the section starting at line 561), BEFORE creating the child (line 610), add:

```javascript
      const savedDataBackup = context.savedData
      if (context.savedData !== undefined && isNodeModified(nodeSavedData, nodeData)) {
        suppressChildModified = true
        context.savedData = undefined
      }
```

After `children = [child]` (line 633), add restore with `try/finally` safety. Wrap the child creation (lines 610-633) in a `try/finally`:

```javascript
      try {
        // ... existing child creation code (lines 610-633) ...
      } finally {
        context.savedData = savedDataBackup
      }
```

- [ ] **Step 7: Compute modified/childModified flags**

After the `autofocus` and `shouldLoadData` computation (around line 889), add the modified flag computation:

```javascript
  // Compute modified flags
  /** @type {boolean | undefined} */
  let modified
  /** @type {boolean | undefined} */
  let childModified
  if (context.savedData !== undefined) {
    if (suppressChildModified) {
      // Array or oneOf that differs from saved — mark as modified, children were not individually compared
      modified = true
      childModified = true
    } else if (children) {
      // Composite node (including equal arrays): aggregate from children
      modified = false
      childModified = children.some(c => c.modified || c.childModified) || false
    } else {
      // Leaf node: compare directly
      modified = isNodeModified(nodeSavedData, nodeData)
    }
  }
```

Note: composite nodes (including equal arrays/oneOf that were not suppressed) get `modified = false` explicitly. This ensures the flag is `false` (not `undefined`) when the feature is active.

- [ ] **Step 8: Pass modified/childModified to produceStateNode call**

At the `produceStateNode` call (lines 896-918), add `modified` and `childModified` as the last two arguments:

```javascript
  const node = produceStateNode(
    reusedNode ?? /** @type {import('./types.js').StateNode} */({}),
    key,
    fullKey,
    parentFullKey,
    dataPath,
    parentDataPath,
    skeleton,
    layout,
    display.width,
    cols,
    nodeData,
    error?.message,
    validated,
    options,
    titleDepth,
    autofocus,
    shouldLoadData,
    props,
    slots,
    itemsCacheKey,
    children && shallowProduceArray(reusedNode?.children, children),
    modified,
    childModified
  )
```

- [ ] **Step 9: Run integration tests**

Run: `cd core && node --test test/modified.spec.js`
Expected: All tests PASS

- [ ] **Step 10: Run all existing tests to check for regressions**

Run: `cd core && node --test test/*.spec.js`
Expected: All tests PASS

- [ ] **Step 11: Commit**

```bash
git add core/src/state/state-node.js
git commit -m "feat: compute modified/childModified flags in state node creation"
```

---

### Task 6: Additional integration tests

**Files:**
- Modify: `core/test/modified.spec.js`

- [ ] **Step 1: Write test for childModified bubbling through nested objects**

Add to `core/test/modified.spec.js`:

```javascript
  it('should bubble childModified through nested objects', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        nested: {
          type: 'object',
          properties: {
            deep: { type: 'string' }
          }
        }
      }
    })
    const statefulLayout = new StatefulLayout(
      compiledLayout,
      compiledLayout.skeletonTrees[compiledLayout.mainTree],
      defaultOptions,
      { nested: { deep: 'changed' } },
      { nested: { deep: 'original' } }
    )
    const nestedNode = statefulLayout.stateTree.root.children?.[0]
    const deepNode = nestedNode?.children?.[0]
    assert.equal(deepNode?.modified, true)
    assert.equal(nestedNode?.childModified, true)
    assert.equal(nestedNode?.modified, false)
    assert.equal(statefulLayout.stateTree.root.childModified, true)
    assert.equal(statefulLayout.modified, true)
  })
```

- [ ] **Step 2: Write test for array modification behavior**

```javascript
  it('should mark array as modified when contents differ, without flagging children', async () => {
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
      { arr: ['a', 'b', 'c'] },
      { arr: ['a', 'b'] }
    )
    const arrNode = statefulLayout.stateTree.root.children?.[0]
    assert.equal(arrNode?.modified, true)
    assert.equal(arrNode?.childModified, true)
    // children should NOT have individual modified flags (savedData suppressed)
    assert.equal(arrNode?.children?.[0].modified, undefined)
    assert.equal(arrNode?.children?.[1].modified, undefined)
    assert.equal(arrNode?.children?.[2].modified, undefined)
  })

  it('should drill into array children when array is unchanged', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        arr: {
          type: 'array',
          layout: 'list',
          items: {
            type: 'object',
            properties: { name: { type: 'string' } }
          }
        }
      }
    })
    const savedData = { arr: [{ name: 'Alice' }, { name: 'Bob' }] }
    const currentData = { arr: [{ name: 'Alice' }, { name: 'Bob' }] }
    const statefulLayout = new StatefulLayout(
      compiledLayout,
      compiledLayout.skeletonTrees[compiledLayout.mainTree],
      defaultOptions,
      currentData,
      savedData
    )
    const arrNode = statefulLayout.stateTree.root.children?.[0]
    // Array is equal — modified is false (not undefined), children are compared individually
    assert.equal(arrNode?.modified, false)
    assert.equal(arrNode?.childModified, false)
    assert.equal(arrNode?.children?.[0].children?.[0].modified, false)
  })
```

- [ ] **Step 3: Write test for oneOf modification behavior**

```javascript
  it('should mark oneOf as modified when variant differs, without flagging children', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        value: {
          oneOf: [
            { type: 'string' },
            { type: 'integer' }
          ]
        }
      }
    })
    const statefulLayout = new StatefulLayout(
      compiledLayout,
      compiledLayout.skeletonTrees[compiledLayout.mainTree],
      defaultOptions,
      { value: 'hello' },
      { value: 42 }
    )
    assert.equal(statefulLayout.modified, true)
  })
```

- [ ] **Step 4: Write test for savedData setter**

```javascript
  it('should recalculate modified flags when savedData is updated', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: { str1: { type: 'string' } }
    })
    const statefulLayout = new StatefulLayout(
      compiledLayout,
      compiledLayout.skeletonTrees[compiledLayout.mainTree],
      defaultOptions,
      { str1: 'current' },
      { str1: 'original' }
    )
    assert.equal(statefulLayout.stateTree.root.children?.[0].modified, true)
    assert.equal(statefulLayout.modified, true)

    // Update savedData to match current
    statefulLayout.savedData = { str1: 'current' }
    assert.equal(statefulLayout.stateTree.root.children?.[0].modified, false)
    assert.equal(statefulLayout.modified, false)
  })
```

- [ ] **Step 5: Write test for null savedData**

```javascript
  it('should treat null savedData as active (comparing against null)', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: { str1: { type: 'string' } }
    })
    const statefulLayout = new StatefulLayout(
      compiledLayout,
      compiledLayout.skeletonTrees[compiledLayout.mainTree],
      defaultOptions,
      { str1: 'hello' },
      null
    )
    // Feature is active because savedData !== undefined
    // Root data differs from null
    assert.equal(statefulLayout.stateTree.root.children?.[0].modified, true)
    assert.equal(statefulLayout.modified, true)
  })
```

- [ ] **Step 6: Write test for modified tracking after user input**

```javascript
  it('should update modified flags after user input', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        str1: { type: 'string' },
        str2: { type: 'string' }
      }
    })
    const savedData = { str1: 'hello', str2: 'world' }
    const statefulLayout = new StatefulLayout(
      compiledLayout,
      compiledLayout.skeletonTrees[compiledLayout.mainTree],
      defaultOptions,
      { str1: 'hello', str2: 'world' },
      savedData
    )
    assert.equal(statefulLayout.modified, false)

    // User changes str1
    statefulLayout.input(statefulLayout.stateTree.root.children[0], 'changed')
    assert.equal(statefulLayout.stateTree.root.children[0].modified, true)
    assert.equal(statefulLayout.stateTree.root.children[1].modified, false)
    assert.equal(statefulLayout.modified, true)

    // User reverts str1
    statefulLayout.input(statefulLayout.stateTree.root.children[0], 'hello')
    assert.equal(statefulLayout.stateTree.root.children[0].modified, false)
    assert.equal(statefulLayout.modified, false)
  })
```

- [ ] **Step 7: Run all tests**

Run: `cd core && node --test test/modified.spec.js`
Expected: All tests PASS

Run: `cd core && node --test test/*.spec.js`
Expected: All tests PASS (no regressions)

- [ ] **Step 8: Commit**

```bash
git add core/test/modified.spec.js
git commit -m "test: add comprehensive modified tracking integration tests"
```

---

### Task 7: Final verification

**Files:** None (verification only)

- [ ] **Step 1: Run full test suite**

Run: `cd core && node --test test/*.spec.js`
Expected: All tests PASS

- [ ] **Step 2: Run type checking**

Run: `cd core && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Verify build**

Run: `cd core && npm run build`
Expected: Clean build

- [ ] **Step 4: Commit any remaining changes**

If any fixes were needed, commit them.
