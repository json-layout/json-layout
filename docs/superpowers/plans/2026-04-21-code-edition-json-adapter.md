# Code Edition — JSON Format Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the new `@json-layout/code` workspace and land the `json/` format adapter — the pure-JS seam between a JSON text buffer and a JS value + text-range mappings. Delivers `parse`, `pathToRange`, `offsetToPath`, `scaffold`, `insertProperty` as unit-testable functions with no CodeMirror or DOM dependency.

**Architecture:** New npm workspace `code/` parallel to `vocabulary/`, `core/`, `examples/`. Inside, one subfolder per format — `code/src/json/` — with small focused modules: `scaffold.js` (value → JSON string), `parser.js` (Lezer-based text ↔ AST helpers), `insert-property.js` (editing op), `adapter.js` (assembles and exports the `FormatAdapter`). The format adapter interface matches the spec (`docs/superpowers/specs/2026-04-21-code-edition-design.md`) **minus the CM6 `language` field**, which arrives in a later plan together with the editor extensions. Tests use the existing Node.js built-in test runner — no browser, no DOM.

**Tech Stack:** Plain JS + JSDoc, `@lezer/json` for parse-tree walking, Node.js built-in `node:test` runner.

**Spec:** `docs/superpowers/specs/2026-04-21-code-edition-design.md` — sections *"Workspace layout"*, *"Module split: shared/ vs json/"*, *"json/ responsibilities"*.

**Depends on:** Plan 1 (core exposures) — already landed on `feat-code-edition`. The resulting `@json-layout/core` exports `resolveSkeletonNode`, `lookupNormalizedLayout`, `scaffoldDefault`, which are not consumed by this plan (they land in Plan 3 — shared/ primitives) but exist so `code/` can `import` from a published-looking interface.

**Out of scope for this plan** (future plans):
- `code/src/shared/` primitives (completion extraction, diagnostic mapping, help resolution) — Plan 3.
- CM6 `language` field on FormatAdapter, `jsonLayoutExtensions()`, hover, completion source, diagnostic collection — Plan 4.
- `JsonEditor` class, `doc/` app, modified gutter, widgets, slots — Plans 5+.

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `package.json` (repo root) | Modify | Add `"code"` to the `workspaces` array |
| `code/package.json` | Create | Workspace manifest; `@json-layout/code`; `@lezer/json` dep; peer on `vocabulary`; regular dep on `core` |
| `code/tsconfig.json` | Create | Same settings as `core/tsconfig.json`; `include: ['src', 'test']` |
| `code/tsconfig.build.json` | Create | Extends `tsconfig.json`; `include: ['src']` |
| `code/src/index.js` | Create | Barrel — re-exports `./json/index.js` |
| `code/src/json/index.js` | Create | Re-exports from `./adapter.js` (plus individual functions for testability) |
| `code/src/json/types.ts` | Create | `FormatAdapter` type (no `language` field yet); helper types |
| `code/src/json/scaffold.js` | Create | `scaffold(value, indent) → string` |
| `code/src/json/parser.js` | Create | `parse(text) → unknown`, `pathToRange(text, path)`, `offsetToPath(text, offset)` |
| `code/src/json/insert-property.js` | Create | `insertProperty(text, objectPath, name, value) → { from, to, insert }` |
| `code/src/json/adapter.js` | Create | Assembles and exports the `FormatAdapter` object |
| `code/test/scaffold.spec.js` | Create | Unit tests for `scaffold` |
| `code/test/parser.spec.js` | Create | Unit tests for `parse`, `pathToRange`, `offsetToPath` |
| `code/test/insert-property.spec.js` | Create | Unit tests for `insertProperty` |
| `code/test/adapter.spec.js` | Create | Adapter round-trip + barrel-export smoke test |

All source files are plain JS with JSDoc types; `types.ts` is the one TS file holding shared interfaces, matching the existing `vocabulary/src/types.ts` and `core/src/{compile,state}/types.ts` pattern.

---

### Task 1: Scaffold the `code/` workspace

**Files:**
- Create: `code/package.json`
- Create: `code/tsconfig.json`
- Create: `code/tsconfig.build.json`
- Modify: `package.json` (repo root)

- [ ] **Step 1: Add `code` to root workspaces**

In `/home/alban/github/json-layout/package.json`, locate the `"workspaces"` array (currently `["vocabulary", "core", "examples"]`) and replace it with:

```json
  "workspaces": [
    "vocabulary",
    "core",
    "examples",
    "code"
  ],
```

- [ ] **Step 2: Create `code/package.json`**

Create `code/package.json`:

```json
{
  "name": "@json-layout/code",
  "version": "0.1.0",
  "description": "Schema-assisted code editor primitives for JSON Layout.",
  "type": "module",
  "exports": {
    ".": {
      "import": {
        "types": "./types/index.d.ts",
        "default": "./src/index.js"
      }
    },
    "./json": {
      "import": {
        "types": "./types/json/index.d.ts",
        "default": "./src/json/index.js"
      }
    }
  },
  "files": [
    "src",
    "types",
    "LICENSE"
  ],
  "scripts": {
    "test:only": "node --test --test-only test/*.spec.js",
    "test": "node --test test/*.spec.js",
    "build": "rm -rf ./types && tsc -p tsconfig.build.json",
    "watch:build": "tsc -p tsconfig.build.json --watch --preserveWatchOutput",
    "watch:test": "node --test --watch test/*.spec.js"
  },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/json-layout/json-layout.git"
  },
  "keywords": [
    "json",
    "schema",
    "editor",
    "codemirror"
  ],
  "author": "Alban Mouton <alban.mouton@gmail.com>",
  "license": "MIT",
  "bugs": {
    "url": "https://github.com/json-layout/json-layout/issues"
  },
  "homepage": "https://github.com/json-layout/json-layout#readme",
  "peerDependencies": {
    "@json-layout/vocabulary": "^2.13.0"
  },
  "dependencies": {
    "@json-layout/core": "^2.7.1",
    "@lezer/json": "^1.0.3"
  }
}
```

- [ ] **Step 3: Create `code/tsconfig.json`**

Create `code/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "esnext",
    "module": "nodenext",
    "declaration": true,
    "emitDeclarationOnly": true,
    "declarationMap": true,
    "strict": true,
    "allowJs": true,
    "checkJs": true,
    "outDir": "types"
  },
  "include": ["src", "test"],
  "exclude": ["node_modules", "types"]
}
```

- [ ] **Step 4: Create `code/tsconfig.build.json`**

Create `code/tsconfig.build.json`:

```json
{
  "extends": "./tsconfig.json",
  "include": ["src"]
}
```

- [ ] **Step 5: Install and verify workspace registration**

Run: `npm install` from the repo root.
Expected: install succeeds; `node_modules/@json-layout/code` is symlinked to the new `code/` directory.

Verify: `ls -l node_modules/@json-layout/` — should list `code`, `core`, and `vocabulary` as symlinks.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json code/package.json code/tsconfig.json code/tsconfig.build.json
git commit -m "feat(code): scaffold @json-layout/code workspace"
```

---

### Task 2: Stub the source and test directories

**Files:**
- Create: `code/src/index.js`
- Create: `code/src/json/index.js`
- Create: `code/src/json/types.ts`
- Create: `code/test/placeholder.spec.js`

Intent: give the workspace a minimum viable structure so `npm run build -w code` and `npm test -w code` both succeed before we add real logic. Keeps subsequent TDD cycles trustworthy — a failing test always means our new code is wrong, not that the workspace itself is broken.

- [ ] **Step 1: Create `code/src/json/types.ts`**

Create `code/src/json/types.ts`:

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

- [ ] **Step 2: Create stub barrel files**

Create `code/src/json/index.js`:

```javascript
// Populated in later tasks.
export {}
```

Create `code/src/index.js`:

```javascript
export * from './json/index.js'
```

- [ ] **Step 3: Create a placeholder test**

Create `code/test/placeholder.spec.js`:

```javascript
import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'

describe('@json-layout/code workspace', () => {
  it('loads the json barrel without errors', async () => {
    const mod = await import('../src/json/index.js')
    assert.equal(typeof mod, 'object')
  })
})
```

- [ ] **Step 4: Verify workspace builds and tests run**

Run: `npm run build -w code`
Expected: succeeds; creates `code/types/` directory with `.d.ts` files.

Run: `npm test -w code`
Expected: 1 test passes.

- [ ] **Step 5: Verify root quality still green**

Run: `npm run quality` from the repo root.
Expected: lint + build + test pass across all four workspaces (vocabulary, core, examples, code).

If lint complains about `types.ts` files in `code/`, check that the repo-root `eslint.config.mjs`'s `ignores` entries include `code/**/types.ts` the same way it does for `vocabulary/**/types.ts` and `core/**/types.ts`. If not, add it:

```javascript
  { ignores: ['**/tmp/*', '**/types/*', 'vocabulary/**/types.ts', 'core/**/types.ts', 'examples/**/types.ts', 'code/**/types.ts', '**/*.d.ts', '**/schema.js'] },
```

If this edit is needed, include `eslint.config.mjs` in the commit below.

- [ ] **Step 6: Update root-level test/build scripts to include `code`**

In `/home/alban/github/json-layout/package.json`, update the `test`, `test:only`, and `build` scripts so the new workspace runs in CI parity with the others:

```json
    "test": "run-s 'test -w vocabulary' 'test -w core' 'test -w code'",
    "test:only": "run-s 'test:only -w vocabulary' 'test:only -w core' 'test:only -w code'",
    "build": "run-s 'build -w vocabulary' 'build -w core' 'build -w code' 'build -w examples'",
```

Rationale: `code` depends on `core` (build order), so `build -w code` must follow `build -w core`. `examples` is built last (no cross-dep on `code`).

Verify: `npm run quality` from repo root. Expected: all workspaces pass.

- [ ] **Step 7: Commit**

```bash
git add code/src code/test package.json eslint.config.mjs
git commit -m "feat(code): add workspace source skeleton and placeholder test"
```

(Omit `eslint.config.mjs` from the `git add` if you did not need to modify it.)

---

### Task 3: `scaffold` — JSON value to indented string

**Files:**
- Create: `code/src/json/scaffold.js`
- Create: `code/test/scaffold.spec.js`

Semantic contract: `scaffold(value, { column, unit })` returns a JSON string where:
- The first line is not prefixed with any leading whitespace (the caller positions it).
- Each subsequent line (if any) is prefixed with `column` spaces in addition to the natural JSON indent driven by `unit`.
- `unit` is the indentation unit — typically `'  '` (two spaces) or `'\t'`.

Example: `scaffold({ a: 1 }, { column: 4, unit: '  ' })` returns:

```
{
      "a": 1
    }
```

- [ ] **Step 1: Write failing tests**

Create `code/test/scaffold.spec.js`:

```javascript
import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { scaffold } from '../src/json/scaffold.js'

describe('scaffold', () => {
  it('returns a single-line value unchanged', () => {
    assert.equal(scaffold('hello', { column: 0, unit: '  ' }), '"hello"')
    assert.equal(scaffold(42, { column: 0, unit: '  ' }), '42')
    assert.equal(scaffold(true, { column: 0, unit: '  ' }), 'true')
    assert.equal(scaffold(null, { column: 0, unit: '  ' }), 'null')
    assert.equal(scaffold([], { column: 0, unit: '  ' }), '[]')
    assert.equal(scaffold({}, { column: 0, unit: '  ' }), '{}')
  })

  it('pretty-prints an object at column 0 using the indent unit', () => {
    assert.equal(
      scaffold({ a: 1 }, { column: 0, unit: '  ' }),
      '{\n  "a": 1\n}'
    )
  })

  it('prefixes every line after the first with column spaces', () => {
    assert.equal(
      scaffold({ a: 1 }, { column: 4, unit: '  ' }),
      '{\n      "a": 1\n    }'
    )
  })

  it('handles nested objects with deeper indent', () => {
    assert.equal(
      scaffold({ outer: { inner: 'x' } }, { column: 2, unit: '  ' }),
      '{\n    "outer": {\n      "inner": "x"\n    }\n  }'
    )
  })

  it('handles arrays of values', () => {
    assert.equal(
      scaffold(['a', 'b'], { column: 2, unit: '  ' }),
      '[\n    "a",\n    "b"\n  ]'
    )
  })

  it('uses a tab unit', () => {
    assert.equal(
      scaffold({ a: 1 }, { column: 0, unit: '\t' }),
      '{\n\t"a": 1\n}'
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test code/test/scaffold.spec.js`
Expected: FAIL — `Cannot find module '../src/json/scaffold.js'`.

- [ ] **Step 3: Implement `scaffold`**

Create `code/src/json/scaffold.js`:

```javascript
/**
 * @file Scaffold a JS value as a JSON string with caller-controlled indent.
 */

/**
 * @typedef {import('./types.js').IndentOptions} IndentOptions
 */

/**
 * Serialize `value` as JSON with `indent.unit` as the base indentation, then
 * prefix every line after the first with `indent.column` spaces so the text
 * can be dropped into a buffer at a specific column without re-flowing.
 *
 * @param {unknown} value
 * @param {IndentOptions} indent
 * @returns {string}
 */
export function scaffold (value, indent) {
  const json = JSON.stringify(value, null, indent.unit)
  if (json === undefined) return ''
  if (!json.includes('\n')) return json
  const prefix = ' '.repeat(indent.column)
  const lines = json.split('\n')
  return lines[0] + '\n' + lines.slice(1).map(l => prefix + l).join('\n')
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test code/test/scaffold.spec.js`
Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add code/src/json/scaffold.js code/test/scaffold.spec.js
git commit -m "feat(code): add json/scaffold for indent-aware value serialization"
```

---

### Task 4: `parse` — text to JS value

**Files:**
- Create: `code/src/json/parser.js`
- Create: `code/test/parser.spec.js`

Rationale: keep `parse` separate from `pathToRange` / `offsetToPath` visually even though all three live in `parser.js`. `parse` is a thin wrapper over `JSON.parse` — the Lezer tree is not needed for committed-path sync. The other two *do* need the Lezer tree.

- [ ] **Step 1: Write failing test**

Create `code/test/parser.spec.js`:

```javascript
import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { parse } from '../src/json/parser.js'

describe('parse', () => {
  it('parses a primitive value', () => {
    assert.equal(parse('42'), 42)
    assert.equal(parse('"hello"'), 'hello')
    assert.equal(parse('true'), true)
    assert.equal(parse('null'), null)
  })

  it('parses an object', () => {
    assert.deepEqual(parse('{"a":1,"b":"two"}'), { a: 1, b: 'two' })
  })

  it('parses an array', () => {
    assert.deepEqual(parse('[1,2,3]'), [1, 2, 3])
  })

  it('throws SyntaxError on invalid JSON', () => {
    assert.throws(() => parse('{not valid}'), SyntaxError)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test code/test/parser.spec.js`
Expected: FAIL — `Cannot find module '../src/json/parser.js'`.

- [ ] **Step 3: Implement `parse`**

Create `code/src/json/parser.js`:

```javascript
/**
 * @file JSON parse + Lezer-backed text/range helpers.
 */

/**
 * Parse `text` as JSON, returning the JS value.
 * Throws SyntaxError on invalid input — callers in the committed-path sync loop
 * catch this and freeze the last good state.
 *
 * @param {string} text
 * @returns {unknown}
 */
export function parse (text) {
  return JSON.parse(text)
}
```

The Lezer import and type imports arrive in Task 5, where they are first used.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test code/test/parser.spec.js`
Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add code/src/json/parser.js code/test/parser.spec.js
git commit -m "feat(code): add json/parse wrapping JSON.parse"
```

---

### Task 5: `pathToRange` — JSON pointer → text range

**Files:**
- Modify: `code/src/json/parser.js`
- Modify: `code/test/parser.spec.js`

Walk the Lezer tree. The `@lezer/json` grammar's node names, for reference:
- Top node: `JsonText` (holds exactly one value child).
- `Object`: `{` `Property`* `}`.
- `Property`: `PropertyName` `:` `<Value>`.
- `PropertyName` — String-shaped (includes surrounding quotes).
- `Array`: `[` `<Value>`* `]` (with `,` separators).
- Leaf value types: `Number`, `String`, `True`, `False`, `Null`; composite `Object`, `Array`.

- [ ] **Step 1: Write failing tests**

Append to `code/test/parser.spec.js`:

```javascript
import { pathToRange } from '../src/json/parser.js'

describe('pathToRange', () => {
  it('returns the whole-document range for root path', () => {
    const text = '{"a":1}'
    assert.deepEqual(pathToRange(text, ''), { from: 0, to: 7 })
    assert.deepEqual(pathToRange(text, '/'), { from: 0, to: 7 })
  })

  it('resolves an object property value', () => {
    const text = '{"a":1,"b":"two"}'
    assert.deepEqual(pathToRange(text, '/a'), { from: 5, to: 6 })
    assert.deepEqual(pathToRange(text, '/b'), { from: 11, to: 16 })
  })

  it('resolves a nested property', () => {
    const text = '{"outer":{"inner":42}}'
    assert.deepEqual(pathToRange(text, '/outer/inner'), { from: 18, to: 20 })
  })

  it('resolves an array index', () => {
    const text = '["a","b","c"]'
    assert.deepEqual(pathToRange(text, '/0'), { from: 1, to: 4 })
    assert.deepEqual(pathToRange(text, '/2'), { from: 9, to: 12 })
  })

  it('resolves an object inside an array', () => {
    const text = '[{"a":1},{"b":2}]'
    assert.deepEqual(pathToRange(text, '/1/b'), { from: 13, to: 14 })
  })

  it('returns null for unknown path', () => {
    const text = '{"a":1}'
    assert.equal(pathToRange(text, '/missing'), null)
    assert.equal(pathToRange(text, '/a/deep'), null)
  })

  it('returns null for non-JSON text', () => {
    assert.equal(pathToRange('not json', ''), null)
  })

  it('handles whitespace between tokens', () => {
    const text = '{\n  "a": 1,\n  "b": 2\n}'
    const range = pathToRange(text, '/b')
    assert.ok(range)
    assert.equal(text.slice(range.from, range.to), '2')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test code/test/parser.spec.js`
Expected: FAIL — `pathToRange` not exported.

- [ ] **Step 3: Implement `pathToRange`**

First, add the Lezer and type imports at the top of `code/src/json/parser.js` (immediately after the `@file` block comment):

```javascript
import { parser as lezerJsonParser } from '@lezer/json'

/** @typedef {import('./types.js').Range} Range */
/** @typedef {import('./types.js').OffsetLocation} OffsetLocation */
```

Then append to `code/src/json/parser.js`:

```javascript
const VALUE_TYPES = new Set(['Number', 'String', 'True', 'False', 'Null', 'Object', 'Array'])

/**
 * Unescape a JSON PropertyName (a quoted string) to its JS string key.
 * @param {string} raw
 * @returns {string}
 */
function unquote (raw) {
  try {
    return JSON.parse(raw)
  } catch {
    // Lezer returned a malformed PropertyName — fall back to stripping quotes
    return raw.replace(/^"|"$/g, '')
  }
}

/**
 * @param {import('@lezer/common').SyntaxNode} node
 * @returns {import('@lezer/common').SyntaxNode | null}
 */
function nextValueSibling (node) {
  let n = node.nextSibling
  while (n && !VALUE_TYPES.has(n.name)) n = n.nextSibling
  return n
}

/**
 * @param {import('@lezer/common').SyntaxNode} valueNode
 * @param {string} text
 * @param {string[]} segments
 * @returns {Range | null}
 */
function walkValue (valueNode, text, segments) {
  if (segments.length === 0) return { from: valueNode.from, to: valueNode.to }
  const [segment, ...rest] = segments
  if (valueNode.name === 'Object') {
    let child = valueNode.firstChild
    while (child) {
      if (child.name === 'Property') {
        const propNameNode = child.firstChild
        if (propNameNode?.name === 'PropertyName') {
          const key = unquote(text.slice(propNameNode.from, propNameNode.to))
          if (key === segment) {
            const valueChild = nextValueSibling(propNameNode)
            if (!valueChild) return null
            return walkValue(valueChild, text, rest)
          }
        }
      }
      child = child.nextSibling
    }
    return null
  }
  if (valueNode.name === 'Array') {
    const index = /^\d+$/.test(segment) ? parseInt(segment, 10) : -1
    if (index < 0) return null
    let i = 0
    let child = valueNode.firstChild
    while (child) {
      if (VALUE_TYPES.has(child.name)) {
        if (i === index) return walkValue(child, text, rest)
        i++
      }
      child = child.nextSibling
    }
    return null
  }
  return null
}

/**
 * Map a JSON pointer path to the text range of its value token.
 * Returns null if the path cannot be resolved (path missing, text not parseable
 * as a JSON value, etc.).
 *
 * @param {string} text
 * @param {string} path
 * @returns {Range | null}
 */
export function pathToRange (text, path) {
  if (typeof text !== 'string' || typeof path !== 'string') return null
  const tree = lezerJsonParser.parse(text)
  const topNode = tree.topNode
  // Find the single value child of JsonText
  let valueNode = topNode.firstChild
  while (valueNode && !VALUE_TYPES.has(valueNode.name)) valueNode = valueNode.nextSibling
  if (!valueNode) return null
  const segments = path === '' || path === '/' ? [] : path.replace(/^\//, '').split('/')
  return walkValue(valueNode, text, segments)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test code/test/parser.spec.js`
Expected: All tests PASS (4 from Task 4 + 8 new).

If any test fails: DO NOT weaken the assertion. Investigate the Lezer tree shape by logging `tree.toString()` for the failing case and adjust the implementation to match. Report BLOCKED if you cannot reconcile the tree shape with the expected behavior within reasonable effort.

- [ ] **Step 5: Commit**

```bash
git add code/src/json/parser.js code/test/parser.spec.js
git commit -m "feat(code): add pathToRange for JSON pointer resolution over Lezer tree"
```

---

### Task 6: `offsetToPath` — text offset → path + position kind

**Files:**
- Modify: `code/src/json/parser.js`
- Modify: `code/test/parser.spec.js`

Semantic contract: given a cursor `offset` in `text`, return the JSON pointer path of the enclosing value and a tag indicating where inside that container the cursor sits:
- `at: 'key'` — cursor is inside a `PropertyName` token (the user is typing/editing the property name itself). The returned `path` is the path to the **parent object** (not including the property name).
- `at: 'value'` — cursor is inside a value token (primitive, or the interior of an Object/Array).
- `at: 'structural'` — cursor is on punctuation or whitespace with no value context at that spot (e.g., between `,` and the next property, or inside an empty object).

Return `null` if `offset` is outside the text range or the text cannot be parsed into a root value.

- [ ] **Step 1: Write failing tests**

Append to `code/test/parser.spec.js`:

```javascript
import { offsetToPath } from '../src/json/parser.js'

describe('offsetToPath', () => {
  it('returns value context inside a leaf', () => {
    // {"a":1,"b":"two"}
    //  0   4 6   10
    const text = '{"a":1,"b":"two"}'
    assert.deepEqual(offsetToPath(text, 5), { path: '/a', at: 'value' })
    assert.deepEqual(offsetToPath(text, 13), { path: '/b', at: 'value' })
  })

  it('returns key context when cursor is inside a PropertyName', () => {
    // {"a":1}
    //  1 2 3
    const text = '{"ab":1}'
    const loc = offsetToPath(text, 2) // inside "ab"
    assert.equal(loc?.path, '')
    assert.equal(loc?.at, 'key')
  })

  it('returns nested path for nested objects', () => {
    // {"outer":{"inner":42}}
    //          9       18
    const text = '{"outer":{"inner":42}}'
    const loc = offsetToPath(text, 18)
    assert.deepEqual(loc, { path: '/outer/inner', at: 'value' })
  })

  it('returns path with array index for values inside an array', () => {
    const text = '["a","b","c"]'
    assert.deepEqual(offsetToPath(text, 2), { path: '/0', at: 'value' })
    assert.deepEqual(offsetToPath(text, 10), { path: '/2', at: 'value' })
  })

  it('returns structural context inside an empty object', () => {
    const text = '{ }'
    assert.deepEqual(offsetToPath(text, 1), { path: '', at: 'structural' })
  })

  it('returns structural context between properties', () => {
    // {"a":1, "b":2}
    //       6 7 8
    const text = '{"a":1, "b":2}'
    const loc = offsetToPath(text, 7) // the space between "," and "\"b\""
    assert.equal(loc?.at, 'structural')
    assert.equal(loc?.path, '')
  })

  it('returns null for an offset outside text bounds', () => {
    assert.equal(offsetToPath('{}', -1), null)
    assert.equal(offsetToPath('{}', 1000), null)
  })

  it('returns null for unparseable text', () => {
    assert.equal(offsetToPath('total garbage', 5), null)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test code/test/parser.spec.js`
Expected: FAIL — `offsetToPath` not exported.

- [ ] **Step 3: Implement `offsetToPath`**

Append to `code/src/json/parser.js`:

```javascript
/**
 * @param {import('@lezer/common').SyntaxNode} node
 * @param {number} offset
 * @returns {import('@lezer/common').SyntaxNode | null}
 */
function smallestEnclosing (node, offset) {
  /** @type {import('@lezer/common').SyntaxNode | null} */
  let best = null
  let child = node.firstChild
  while (child) {
    if (offset >= child.from && offset <= child.to) {
      const deeper = smallestEnclosing(child, offset)
      best = deeper ?? child
      break
    }
    child = child.nextSibling
  }
  return best
}

/**
 * Compute the JSON pointer path from `topNode` down to the Property/Array-item
 * containing `node`.
 * @param {import('@lezer/common').SyntaxNode} node
 * @param {string} text
 * @returns {string}
 */
function buildPathTo (node, text) {
  /** @type {string[]} */
  const segments = []
  /** @type {import('@lezer/common').SyntaxNode | null} */
  let cursor = node
  while (cursor && cursor.parent) {
    const parent = cursor.parent
    if (parent.name === 'Property' && cursor.name !== 'PropertyName') {
      // cursor is the value half of a Property — the property's key contributes a segment
      const nameNode = parent.firstChild
      if (nameNode?.name === 'PropertyName') {
        segments.unshift(unquote(text.slice(nameNode.from, nameNode.to)))
      }
      cursor = parent.parent // skip Property itself; continue from its Object parent
      continue
    }
    if (parent.name === 'Array' && VALUE_TYPES.has(cursor.name)) {
      // cursor is an array element — count the element index
      let idx = 0
      let sib = parent.firstChild
      while (sib) {
        if (VALUE_TYPES.has(sib.name)) {
          if (sib.from === cursor.from && sib.to === cursor.to) break
          idx++
        }
        sib = sib.nextSibling
      }
      segments.unshift(String(idx))
      cursor = parent
      continue
    }
    cursor = parent
  }
  return segments.length === 0 ? '' : '/' + segments.join('/')
}

/**
 * Classify a cursor offset as key/value/structural and return the enclosing path.
 *
 * @param {string} text
 * @param {number} offset
 * @returns {OffsetLocation | null}
 */
export function offsetToPath (text, offset) {
  if (typeof text !== 'string' || typeof offset !== 'number') return null
  if (offset < 0 || offset > text.length) return null
  const tree = lezerJsonParser.parse(text)
  const topNode = tree.topNode
  let rootValue = topNode.firstChild
  while (rootValue && !VALUE_TYPES.has(rootValue.name)) rootValue = rootValue.nextSibling
  if (!rootValue) return null

  const deepest = smallestEnclosing(topNode, offset) ?? rootValue

  // Key position: cursor inside a PropertyName.
  if (deepest.name === 'PropertyName') {
    const property = deepest.parent
    const obj = property?.parent
    if (obj) {
      const pathToObj = buildPathTo(obj, text)
      return { path: pathToObj, at: 'key' }
    }
  }

  // Value position: cursor is inside a VALUE_TYPES node.
  /** @type {import('@lezer/common').SyntaxNode | null} */
  let valueAncestor = deepest
  while (valueAncestor && !VALUE_TYPES.has(valueAncestor.name)) {
    valueAncestor = valueAncestor.parent
  }

  // Structural position: cursor is on punctuation or whitespace inside a container
  // but not inside a leaf value.
  if (!valueAncestor) {
    return { path: '', at: 'structural' }
  }

  const path = buildPathTo(valueAncestor, text)

  // If the ancestor is a container and the offset is not strictly inside a child leaf,
  // treat it as structural.
  if ((valueAncestor.name === 'Object' || valueAncestor.name === 'Array') && deepest === valueAncestor) {
    return { path, at: 'structural' }
  }

  return { path, at: 'value' }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test code/test/parser.spec.js`
Expected: All tests PASS (8 prior + 8 new).

If tests fail because of Lezer tree shape subtleties:
- Log `tree.toString()` for the failing input to see the exact node names and structure.
- Adjust `buildPathTo` / `smallestEnclosing` / `offsetToPath` to match reality.
- Do NOT weaken assertions unless the assertion itself is wrong (in which case, report DONE_WITH_CONCERNS and the controller will update the plan).

- [ ] **Step 5: Commit**

```bash
git add code/src/json/parser.js code/test/parser.spec.js
git commit -m "feat(code): add offsetToPath for cursor-to-path classification"
```

---

### Task 7: `insertProperty` — add a property to an existing object

**Files:**
- Create: `code/src/json/insert-property.js`
- Create: `code/test/insert-property.spec.js`

Semantic contract: `insertProperty(text, objectPath, name, value)` returns an `{ from, to, insert }` edit op that, when applied to `text`, adds a property named `name` with serialized value `value` to the object at `objectPath`.

- If the object is empty (`{}`): the new property is inserted between the braces, on a single line.
- If the object has existing properties: the new property is appended after the last one, with a `,` before it and indentation that matches the first property's column. A trailing newline before the closing brace is preserved if present.
- If `objectPath` does not resolve to an object: return `{ from: 0, to: 0, insert: '' }` (a no-op). Callers can check for empty `insert` to detect failure.

Indentation inference: look at the first property line of the object. The leading-whitespace column of that line is the indent column for new properties. If the object is single-line, the result is also single-line.

- [ ] **Step 1: Write failing tests**

Create `code/test/insert-property.spec.js`:

```javascript
import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { insertProperty } from '../src/json/insert-property.js'

/**
 * Helper: apply an edit op to source text and return the resulting string.
 * @param {string} text
 * @param {{from: number, to: number, insert: string}} op
 * @returns {string}
 */
function apply (text, op) {
  return text.slice(0, op.from) + op.insert + text.slice(op.to)
}

describe('insertProperty', () => {
  it('inserts into an empty object on a single line', () => {
    const text = '{}'
    const op = insertProperty(text, '', 'greeting', 'hello')
    assert.equal(apply(text, op), '{"greeting": "hello"}')
  })

  it('appends to a single-line object with existing properties', () => {
    const text = '{"a": 1}'
    const op = insertProperty(text, '', 'b', 2)
    assert.equal(apply(text, op), '{"a": 1, "b": 2}')
  })

  it('appends to a multi-line object matching the indent of the first property', () => {
    const text = '{\n  "a": 1\n}'
    const op = insertProperty(text, '', 'b', 2)
    assert.equal(apply(text, op), '{\n  "a": 1,\n  "b": 2\n}')
  })

  it('appends inside a nested object', () => {
    const text = '{\n  "outer": {\n    "a": 1\n  }\n}'
    const op = insertProperty(text, '/outer', 'b', 2)
    assert.equal(apply(text, op), '{\n  "outer": {\n    "a": 1,\n    "b": 2\n  }\n}')
  })

  it('scaffolds a nested object value with matching indent', () => {
    const text = '{\n  "a": 1\n}'
    const op = insertProperty(text, '', 'nested', { x: 1, y: 2 })
    const result = apply(text, op)
    assert.equal(
      result,
      '{\n  "a": 1,\n  "nested": {\n    "x": 1,\n    "y": 2\n  }\n}'
    )
  })

  it('returns an empty insert for an unknown objectPath', () => {
    const text = '{"a": 1}'
    const op = insertProperty(text, '/missing', 'x', 1)
    assert.deepEqual(op, { from: 0, to: 0, insert: '' })
  })

  it('returns an empty insert when objectPath points to a non-object', () => {
    const text = '{"a": [1, 2]}'
    const op = insertProperty(text, '/a', 'x', 1)
    assert.deepEqual(op, { from: 0, to: 0, insert: '' })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test code/test/insert-property.spec.js`
Expected: FAIL — `Cannot find module '../src/json/insert-property.js'`.

- [ ] **Step 3: Implement `insertProperty`**

Create `code/src/json/insert-property.js`:

```javascript
/**
 * @file Insert a property into an existing JSON object literal in-place.
 */

import { parser as lezerJsonParser } from '@lezer/json'
import { scaffold } from './scaffold.js'

/** @typedef {import('./types.js').InsertOp} InsertOp */

const VALUE_TYPES = new Set(['Number', 'String', 'True', 'False', 'Null', 'Object', 'Array'])

/**
 * @param {string} raw
 * @returns {string}
 */
function unquote (raw) {
  try { return JSON.parse(raw) } catch { return raw.replace(/^"|"$/g, '') }
}

/**
 * @param {import('@lezer/common').SyntaxNode} valueNode
 * @param {string} text
 * @param {string[]} segments
 * @returns {import('@lezer/common').SyntaxNode | null}
 */
function walkValue (valueNode, text, segments) {
  if (segments.length === 0) return valueNode
  const [segment, ...rest] = segments
  if (valueNode.name === 'Object') {
    let child = valueNode.firstChild
    while (child) {
      if (child.name === 'Property') {
        const propNameNode = child.firstChild
        if (propNameNode?.name === 'PropertyName') {
          const key = unquote(text.slice(propNameNode.from, propNameNode.to))
          if (key === segment) {
            let valueChild = propNameNode.nextSibling
            while (valueChild && !VALUE_TYPES.has(valueChild.name)) valueChild = valueChild.nextSibling
            if (!valueChild) return null
            return walkValue(valueChild, text, rest)
          }
        }
      }
      child = child.nextSibling
    }
    return null
  }
  if (valueNode.name === 'Array') {
    const index = /^\d+$/.test(segment) ? parseInt(segment, 10) : -1
    if (index < 0) return null
    let i = 0
    let child = valueNode.firstChild
    while (child) {
      if (VALUE_TYPES.has(child.name)) {
        if (i === index) return walkValue(child, text, rest)
        i++
      }
      child = child.nextSibling
    }
    return null
  }
  return null
}

/**
 * Compute the column of the first non-whitespace character on the line that
 * contains `offset`.
 * @param {string} text
 * @param {number} offset
 * @returns {number}
 */
function columnOf (text, offset) {
  const lineStart = text.lastIndexOf('\n', offset - 1) + 1
  let col = 0
  for (let i = lineStart; i < offset; i++) {
    if (text[i] === ' ' || text[i] === '\t') col++
    else break
  }
  return col
}

/**
 * Insert `name: value` into the object at `objectPath`.
 *
 * @param {string} text
 * @param {string} objectPath
 * @param {string} name
 * @param {unknown} value
 * @returns {InsertOp}
 */
export function insertProperty (text, objectPath, name, value) {
  const empty = { from: 0, to: 0, insert: '' }
  if (typeof text !== 'string') return empty
  const tree = lezerJsonParser.parse(text)
  const topNode = tree.topNode
  let rootValue = topNode.firstChild
  while (rootValue && !VALUE_TYPES.has(rootValue.name)) rootValue = rootValue.nextSibling
  if (!rootValue) return empty
  const segments = objectPath === '' || objectPath === '/' ? [] : objectPath.replace(/^\//, '').split('/')
  const target = walkValue(rootValue, text, segments)
  if (!target || target.name !== 'Object') return empty

  // Collect existing Property children
  /** @type {import('@lezer/common').SyntaxNode[]} */
  const properties = []
  let child = target.firstChild
  while (child) {
    if (child.name === 'Property') properties.push(child)
    child = child.nextSibling
  }

  const closingBraceIndex = target.to - 1 // position of `}`
  const keyJson = JSON.stringify(name)

  if (properties.length === 0) {
    // Empty object. Keep it single-line.
    const insert = `${keyJson}: ${JSON.stringify(value)}`
    return { from: target.from + 1, to: closingBraceIndex, insert }
  }

  const lastProperty = properties[properties.length - 1]
  const firstProperty = properties[0]
  const openBraceIndex = target.from

  // Determine multi-line vs single-line by checking whether the first property
  // sits on its own line.
  const isMultiline = text.lastIndexOf('\n', firstProperty.from) > openBraceIndex

  if (!isMultiline) {
    const insert = `, ${keyJson}: ${JSON.stringify(value)}`
    return { from: lastProperty.to, to: lastProperty.to, insert }
  }

  // Multi-line case: match the first property's column for indent.
  const column = columnOf(text, firstProperty.from)
  const valueText = scaffold(value, { column, unit: '  ' })
  const insert = `,\n${' '.repeat(column)}${keyJson}: ${valueText}`
  return { from: lastProperty.to, to: lastProperty.to, insert }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test code/test/insert-property.spec.js`
Expected: All 7 tests PASS.

If a test fails because of whitespace differences: log the actual `op.insert` and the applied result for the failing case. Adjust the implementation to match the expected output exactly — do NOT change the test assertions unless the expected output is genuinely wrong (in which case, report DONE_WITH_CONCERNS).

- [ ] **Step 5: Commit**

```bash
git add code/src/json/insert-property.js code/test/insert-property.spec.js
git commit -m "feat(code): add insertProperty edit op for in-place object edits"
```

---

### Task 8: Assemble the `FormatAdapter`

**Files:**
- Create: `code/src/json/adapter.js`
- Modify: `code/src/json/index.js`
- Modify: `code/src/index.js`
- Create: `code/test/adapter.spec.js`

- [ ] **Step 1: Create `code/src/json/adapter.js`**

Create `code/src/json/adapter.js`:

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

- [ ] **Step 2: Update `code/src/json/index.js` to re-export everything**

Replace `code/src/json/index.js` with:

```javascript
export { parse, pathToRange, offsetToPath } from './parser.js'
export { scaffold } from './scaffold.js'
export { insertProperty } from './insert-property.js'
export { jsonFormatAdapter } from './adapter.js'
```

- [ ] **Step 3: Keep `code/src/index.js` barrel forwarding json/**

The file already contains `export * from './json/index.js'` (from Task 2). Verify it's unchanged.

- [ ] **Step 4: Delete the placeholder test**

Remove `code/test/placeholder.spec.js`:

```bash
rm code/test/placeholder.spec.js
```

- [ ] **Step 5: Create `code/test/adapter.spec.js`**

Create `code/test/adapter.spec.js`:

```javascript
import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { jsonFormatAdapter } from '../src/json/adapter.js'
import * as publicBarrel from '../src/json/index.js'
import * as rootBarrel from '../src/index.js'

describe('jsonFormatAdapter', () => {
  it('exposes all five FormatAdapter methods', () => {
    assert.equal(typeof jsonFormatAdapter.parse, 'function')
    assert.equal(typeof jsonFormatAdapter.pathToRange, 'function')
    assert.equal(typeof jsonFormatAdapter.offsetToPath, 'function')
    assert.equal(typeof jsonFormatAdapter.scaffold, 'function')
    assert.equal(typeof jsonFormatAdapter.insertProperty, 'function')
  })

  it('round-trips a value via parse and pathToRange', () => {
    const text = '{"greeting": "hi"}'
    assert.deepEqual(jsonFormatAdapter.parse(text), { greeting: 'hi' })
    const range = jsonFormatAdapter.pathToRange(text, '/greeting')
    assert.ok(range)
    assert.equal(text.slice(range.from, range.to), '"hi"')
  })

  it('maps a cursor offset back to the path it came from', () => {
    const text = '{"greeting": "hi"}'
    const loc = jsonFormatAdapter.offsetToPath(text, 14) // inside "hi"
    assert.deepEqual(loc, { path: '/greeting', at: 'value' })
  })

  it('inserts a property that parses back as the requested object shape', () => {
    const text = '{"a": 1}'
    const op = jsonFormatAdapter.insertProperty(text, '', 'b', 2)
    const result = text.slice(0, op.from) + op.insert + text.slice(op.to)
    assert.deepEqual(jsonFormatAdapter.parse(result), { a: 1, b: 2 })
  })
})

describe('barrel exports', () => {
  it('exports jsonFormatAdapter and all five functions from @json-layout/code/json', () => {
    assert.equal(typeof publicBarrel.jsonFormatAdapter, 'object')
    assert.equal(typeof publicBarrel.parse, 'function')
    assert.equal(typeof publicBarrel.pathToRange, 'function')
    assert.equal(typeof publicBarrel.offsetToPath, 'function')
    assert.equal(typeof publicBarrel.scaffold, 'function')
    assert.equal(typeof publicBarrel.insertProperty, 'function')
  })

  it('forwards json/ exports through the root barrel', () => {
    assert.equal(typeof rootBarrel.jsonFormatAdapter, 'object')
    assert.equal(typeof rootBarrel.parse, 'function')
  })
})
```

- [ ] **Step 6: Run adapter tests**

Run: `node --test code/test/adapter.spec.js`
Expected: All 6 tests PASS.

- [ ] **Step 7: Run the full code test suite**

Run: `npm test -w code`
Expected: All tests across `scaffold.spec.js`, `parser.spec.js`, `insert-property.spec.js`, `adapter.spec.js` pass. Total count ≈ 6 + 4 + 8 + 8 + 7 + 6 = 39 tests.

- [ ] **Step 8: Commit**

```bash
git add code/src/json/adapter.js code/src/json/index.js code/test/adapter.spec.js code/test/placeholder.spec.js
git commit -m "feat(code): assemble FormatAdapter and expose json/ barrel"
```

(The placeholder test was deleted, so its removal is included.)

---

### Task 9: Final quality check

**Files:** None (verification only).

- [ ] **Step 1: Run the project quality pipeline**

Run: `npm run quality` from the repo root.
Expected: lint + build + test pass for every workspace (vocabulary, core, examples, code).

Specifically confirm in the output:
- vocabulary: builds + tests pass (unchanged).
- core: builds + tests pass (unchanged — 277 tests).
- examples: builds (unchanged).
- code: builds + tests pass (~39 tests).

- [ ] **Step 2: Verify the public surface**

Run this self-contained smoke script:

```bash
node --input-type=module --eval "
import { jsonFormatAdapter, parse, pathToRange, offsetToPath, scaffold, insertProperty } from './code/src/json/index.js'
const text = '{\"a\": 1}'
console.log('parse:', parse(text))
console.log('pathToRange /a:', pathToRange(text, '/a'))
console.log('offsetToPath 6:', offsetToPath(text, 6))
console.log('scaffold:', scaffold({ x: 1 }, { column: 2, unit: '  ' }))
console.log('insertProperty:', insertProperty(text, '', 'b', 2))
console.log('adapter keys:', Object.keys(jsonFormatAdapter).join(','))
"
```

Expected output (roughly):

```
parse: { a: 1 }
pathToRange /a: { from: 6, to: 7 }
offsetToPath 6: { path: '/a', at: 'value' }
scaffold: {
      "x": 1
    }
insertProperty: { from: 7, to: 7, insert: ', "b": 2' }
adapter keys: parse,pathToRange,offsetToPath,scaffold,insertProperty
```

If any line is dramatically different (e.g. `undefined`, a thrown error, wrong `from`/`to`), something regressed — investigate.

- [ ] **Step 3: Verify no unrelated files drifted**

Run: `git diff --stat main..HEAD -- ':!core' ':!code'`

Expected: Apart from possibly `package.json` / `package-lock.json` / `eslint.config.mjs` at the repo root, no non-core/non-code files changed. The design spec in `docs/superpowers/specs/` is allowed (it was committed earlier on this branch).

- [ ] **Step 4: Final summary**

Confirm the deliverable matches this plan's goal:

- `code/` workspace exists with `package.json`, `tsconfig*.json`, `src/`, `test/`.
- `@json-layout/code/json` exports `parse`, `pathToRange`, `offsetToPath`, `scaffold`, `insertProperty`, `jsonFormatAdapter`.
- ~39 unit tests covering all five functions, no CM6 or DOM dependency.
- `npm run quality` green across all workspaces.

No additional commit — this is verification-only.
