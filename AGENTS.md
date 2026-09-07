# AGENTS.md - Coding Agent Guidelines for json-layout

## Project Overview

Monorepo for JSON Layout: a system that compiles JSON Schemas into layout
descriptions for form rendering. Four npm workspaces:

- `vocabulary/` (`@json-layout/vocabulary`) - JSON schemas, TS types, normalize/validate
- `core/` (`@json-layout/core`) - Compilation and stateful layout management
- `examples/` (`@json-layout/examples`) - Standard examples for docs/testing

Source in vocabulary/core/examples is **plain JavaScript with JSDoc type annotations**.

## Build / Lint / Test Commands

```bash
# Install
npm install

# Full quality check (lint -> build -> test, same as pre-commit hook)
npm run quality

# Lint (neostandard + eslint-plugin-jsdoc, flat config)
npm run lint

# Build all (must be in order: vocabulary -> core -> examples)
npm run build

# Build a single workspace
npm run build -w vocabulary
npm run build -w core

# Test all
npm test

# Test a single workspace
npm test -w vocabulary
npm test -w core

# Run a single test file
node --test core/test/compile.spec.js

# Run a specific test: mark it with { only: true }, then:
node --test --test-only core/test/compile.spec.js

# Watch tests
npm run watch:test -w core
npm run watch:test -w vocabulary
```

### Running a Single Test

The Node.js test runner uses `{ only: true }` on `it()` or `describe()`:

```js
it('should do something', { only: true }, async () => { ... })
```

Then run with `--test-only`:

```bash
node --test --test-only core/test/compile.spec.js
```

**Remove `{ only: true }` before committing** -- eslint rule `no-only-tests` will catch it.

## Code Style

### Language & Module System

- **ESM everywhere** (`"type": "module"` in all package.json files)
- Source files are `.js` with JSDoc type annotations; type definitions in `types.ts`
- Node.js v24 (see `.nvmrc`)

### Linting

- **neostandard** (successor to `standard`) with `ts: true` -- no semicolons, 2-space indent
- **eslint-plugin-jsdoc** with `recommended-typescript-flavor` rules
- Config: `eslint.config.mjs` (ESLint v9 flat config)

### Imports

- **Named imports** preferred; default imports only for CJS/ESM interop workarounds
- Always use **`.js` extension** in relative imports (`import { foo } from './bar.js'`)
- External packages first, then local modules
- No import sorting enforced, but follow the existing convention

```js
// External
import { produce } from 'immer'
import debug from 'debug'

// Local
import { makeSkeletonNode } from './skeleton-node.js'
import { shallowEqualArray } from './utils/immutable.js'
```

### Type Annotations (JSDoc)

Import types at file top using `@typedef`:

```js
/** @typedef {import('./types.js').SchemaFragment} SchemaFragment */
/** @typedef {import('./types.js').ComponentInfo} ComponentInfo */
```

Annotate function parameters and return types:

```js
/**
 * @param {SchemaFragment} schemaFragment
 * @param {string} type
 * @returns {Children}
 */
function getDefaultChildren (schemaFragment, type) { ... }
```

Inline type casts:

```js
const obj = /** @type {Record<string, unknown>} */(someValue)
```

Generics with `@template`:

```js
/**
 * @template T
 * @param {T[]} arr
 * @returns {T[]}
 */
```

### Naming Conventions

| Element          | Convention       | Example                      |
|------------------|------------------|------------------------------|
| Variables/funcs  | camelCase        | `getDefaultComp`, `hasType`  |
| Classes          | PascalCase       | `StatefulLayout`, `Display`  |
| Files            | kebab-case       | `skeleton-node.js`           |
| Test files       | kebab-case.spec  | `compile.spec.js`            |
| Private fields   | `_` prefix       | `_compiledLayout`, `_data`   |
| Debug loggers    | `jl:` namespace  | `debug('jl:state-node')`     |

### Exports

- **Barrel files** with `export * from './module.js'` in `index.js`
- Named `export function` / `export const` for public APIs
- No default exports from source files (except rare utils like `clone`)

### Error Handling

- `throw new Error(message)` for programmer errors
- Use `error.cause` for structured validation error data:

```js
const error = new Error('validation errors')
error.cause = lighterValidationErrors(validate.errors)
throw error
```

- Graceful fallback chains with nested try/catch where appropriate
- Type catch clauses: `catch (/** @type {any} */err)`
- `console.warn` / `console.error` for non-fatal runtime issues
- No custom error classes

### Key Patterns

- **Immer `produce`** for all immutable state updates
- **Shallow equality** checks to preserve referential identity (`shallowProduceArray`)
- **Pure functions** for compilation/normalization; only `StatefulLayout` is stateful
- **`debug` package** for logging (`jl:` namespace prefix)
- **Options pattern**: partial options filled with defaults via spread

## Test Conventions

- **Framework**: Node.js built-in test runner (`node:test`) + `node:assert`
- **Assertions**: `assert.ok()`, `assert.equal()`, `assert.deepEqual()`
- **Structure**: `describe` / `it` blocks, tests are `async`
- **Naming**: `'should <verb> ...'` pattern
- **Test data**: inline schemas/data, no external fixture files
- **Dual compile modes**: many tests run in a loop over `['runtime', 'build-time']`

```js
import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'

describe('feature X', () => {
  it('should handle case Y', async () => {
    assert.deepEqual(actual, expected)
  })
})
```

## WebMCP Tools and the Eval Harness

`core/src/webmcp/` exposes the form to an LLM agent as MCP tools. Its correctness is not
only "does the function return the right shape" but "can an agent find its way through
the protocol" — and the second does not show up in unit tests.

**If you touch any of these, the eval applies to your change:**

- `core/src/webmcp/**` — any tool, its description, its response text, or the projection
- `core/src/webmcp/tools/fill-form-skill.js` — the text that teaches agents the protocol
- `core/src/state/index.js` select-item handling (`prepareSelectItem`, `getItems`) — what
  a suggestion is worth, and whether the value offered is the value accepted
- error projection in `core/src/webmcp/project.js` — an agent that cannot locate its
  mistake retries blind
- `getComplexity` in `core/src/webmcp/index.js` — it drives the skill's advice and the
  declared sub-agent step budget

Two layers, and you need both:

```bash
# 1. Deterministic guards. No model, runs in the normal gate.
npm test -w core          # includes webmcp-eval*.spec.js
```

These pin that each eval case is the case it claims to be (complexity band, whether
`getSchema` refuses), that the runner agents are generated with no filesystem tools, and
that a malformed judge verdict cannot read as a clean pass. They cannot tell you whether
a form is usable.

```bash
# 2. The judged eval. Needs a model and a FRESH session.
/webmcp-eval
```

An isolated subagent — no `Read`, `Grep` or `Bash`, so it cannot read this repo — fills a
real form from a plain-language goal, and a judge reads the transcript. See
`core/webmcp-eval/README.md`.

If `/webmcp-eval` does not resolve, the procedure is a document, not a command: follow
`.claude/skills/webmcp-eval/SKILL.md` directly. That file is the single source for how to
run the eval; this section only says when you must.

**The MCP servers connect at session start.** If `.mcp.json` changed, or you have just
generated it, the tools do not exist in the current session: run
`npm run webmcp-eval:config -w core` and start a new session. A case that never ran is
reported as `not run` and fails the report — never read the cases that did run as the
result of the suite.

Changing a tool's *description* counts. The descriptions and the skill text are the
protocol as far as a model is concerned, and they are exactly what unit tests cannot
judge.

## Commit Conventions

- **Conventional Commits** enforced by commitlint (`feat:`, `fix:`, `chore:`, etc.)
- Pre-commit hook runs full `npm run quality` (lint + build + test)
- Commit message checked by `@commitlint/config-conventional`

## Workspace Dependencies

- `core` depends on `vocabulary` (peer dependency)
- `examples` depends on `vocabulary` (regular dependency)
- Always build `vocabulary` before `core` (handled by `npm run build`)
