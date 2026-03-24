# Modified Data Tracking for StatefulLayout

## Overview

Add a system to highlight modified parts of a form by comparing current data against a "saved" snapshot. The feature follows the same pattern as error management: leaf-level flags with boolean propagation up to section/parent levels.

## Requirements

- StatefulLayout receives an optional `savedData` parameter representing the last-saved state
- Each StateNode exposes `modified` and `childModified` flags
- Section-level indicators (via `childModified`) and leaf-level highlights (via `modified`)
- Arrays are compared as a whole unit — if different, the array node is modified but children don't get individual modified flags
- Feature is inactive (all flags `undefined`) when `savedData` is not provided

## StateNode Interface Changes

Two new optional properties on `StateNode`:

```typescript
modified: boolean | undefined     // This node's data differs from savedData
childModified: boolean | undefined // A descendant has modified data
```

Both are `undefined` when `savedData` is not provided.

### Computation Rules

- **Leaf node**: `modified = !deepEqual(currentValue, savedValue)` where saved value is resolved via the node's `dataPath`
- **Object/composite node**: `modified` is not set, `childModified = children.some(c => c.modified || c.childModified)`
- **Array node (equal)**: `modified = false`, drill into children normally
- **Array node (different)**: `modified = true`, `childModified = true`, children receive no saved data and get no modified flags
- **oneOf node (different)**: treated like arrays — compare data at the oneOf node level, if different the node is `modified = true`, don't drill into children for modified tracking
- **Indexed lists (pattern properties)**: treated as regular objects — drill into children, compare each property individually

## StatefulLayout API Changes

### Constructor

```typescript
constructor(compiledLayout, skeletonTree, options, data, savedData?)
```

`savedData` is optional. When omitted, modified tracking is inactive. Passing `null` makes the feature active (comparing against `null` root data).

### New Property

```typescript
get modified(): boolean  // true if root node has modified or childModified
```

### New Setter

```typescript
set savedData(value)  // Replaces the saved snapshot, triggers state tree rebuild
```

Allows the consumer to update the baseline after a successful save without rebuilding the whole StatefulLayout. This is safe because `savedData` does not affect data hydration logic — it only influences modified flag computation, so it cannot cause infinite loops in the `updateState()` iteration.

## Tree Creation Context

`CreateStateTreeContext` gets a new property:

```typescript
savedData: unknown | undefined  // The saved snapshot, or undefined if inactive
```

### Propagation During Node Creation

1. Each node resolves its saved value by following `dataPath` into `context.savedData`
2. For leaf nodes: compare current `data` against saved value, set `modified`
3. For object/composite nodes: don't compare directly, compute `childModified` from children (same as `childError` pattern)
4. For array nodes: deep-equal current data against saved value
   - If equal: pass saved value down, children compare normally
   - If different: set `modified = true`, `childModified = true`, pass `undefined` as saved data to children (they get no modified flags)
5. For oneOf nodes: deep-equal current data against saved value
   - If equal: pass saved value down, children compare normally
   - If different: set `modified = true`, don't drill into children for modified tracking

### Optimization

- `savedData === undefined` at context level: skip all comparisons (feature inactive)
- `savedValue === currentValue`: reference equality short-circuit, not modified
- Fall back to `deepEqual(savedValue, currentValue)` for structural comparison

### Caching

Include the node's resolved saved value in the cache key computation. No need to skip caching — modified flags are deterministic from `(data, savedData)`. Path resolution walks into the original `savedData` object (no copying), so sub-object references remain stable. Since `savedData` changes infrequently, most cache key checks pass the `===` comparison cheaply.

## Deep-Equal Strategy

Use `fast-deep-equal` as an explicit direct dependency of `@json-layout/core`. While it is already available transitively via AJV, relying on transitive dependencies is fragile.

## Known Limitations

- **Missing/added properties**: If a property exists in `savedData` but not in current data (or vice versa), no node exists for the missing property, so the modification may go undetected at the parent level. The parent's `childModified` flag only reflects children that are actually rendered. This is a known limitation that may be addressed in a future iteration.

## Testing Strategy

Tests follow the existing pattern in `core/test/`, running in both runtime and build-time (serialization roundtrip) modes:

- **Basic modified detection**: leaf nodes with changed/unchanged values
- **childModified bubbling**: modified leaf inside nested objects propagates `childModified` up the chain
- **Array behavior**: modified array marks the array node, children get no individual modified flags; equal array drills into children normally
- **oneOf behavior**: variant switch marks the oneOf node as modified, children don't get individual flags
- **savedData not provided**: all modified/childModified are `undefined`
- **savedData as null**: feature is active, compares against null
- **savedData update**: calling the setter triggers recalculation
- **Top-level `modified` property**: reflects root state correctly
