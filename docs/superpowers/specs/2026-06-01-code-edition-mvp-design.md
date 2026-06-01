# Code Edition MVP — Make Validation + Autocomplete Actually Work

## Context

This is a **scope-narrowing follow-up** to
[`2026-04-21-code-edition-design.md`](./2026-04-21-code-edition-design.md). That
spec is sound and remains the long-term architecture; this document does not
replace it. It re-scopes the *next deliverable* down to a usable MVP after the
realization that the original build order reached too far into speculative
territory (inline widgets, slots, deferred widgets, modified gutter,
multi-format) before the two features that make the editor actually useful were
proven to work end-to-end.

### What already exists (do not rebuild)

The plumbing from the original spec is built and unit-tested:

- `core/` exposures: `resolveSkeletonNode` / `lookupNormalizedLayout`
  (`utils/resolve.js`), `scaffoldDefault` (`utils/scaffold.js`),
  `getFieldSuggestions` (`utils/suggestions.js`).
- `code/shared/` primitives: completion candidate extraction (value, property,
  variant, dynamic), diagnostic mapping, help resolution.
- `code/json/` format adapter: `parse`, `pathToRange`, `offsetToPath`,
  `scaffold`, `insertProperty`, CM6 language.
- `code/editor/` wiring: `compiledLayoutField`, `statefulLayoutField`,
  fast-path completion + hover, committed-path sync plugin + diagnostics
  dispatch, `jsonLayoutExtensions()` factory.
- `doc/` Nuxt app scaffold with curated examples and an inline `JsonEditor.vue`
  that calls `jsonLayoutExtensions()` directly.
- **149 unit tests green.**

### The problem this MVP fixes

The unit tests pass but the **browser behavior is broken on exactly the two MVP
features**. The e2e suite is **6 passed / 4 failed**:

| Failing e2e | Feature | Root cause (diagnosed) |
|---|---|---|
| `invalid JSON surfaces a lint diagnostic` | **validation** | Committed-sync calls `formatAdapter.parse()`, which throws on syntactically invalid JSON and returns early — no diagnostic dispatched. The extensions install `linter(null)` (a no-op placeholder); CM's real `jsonParseLinter()` was never wired. Syntax errors are silently swallowed. |
| `completion lists red/amber/green` | **autocomplete** | Value-completion at an empty-string position (`{"color": ""}`, cursor between quotes) — passes in unit tests, fails in browser. A position-classification (`offsetToPath`) / completion-trigger edge case at the empty string, not a missing feature. |
| `dynamic completion lists country names` | **autocomplete** | Dynamic `getItems` completion via the committed path — same class of fast/committed-path wiring issue; to be root-caused during implementation. |
| `hover surfaces schema title/description` | help (secondary) | Hover tooltip wired but not surfacing; secondary priority. |

The passing e2e (`smoke`, `one-of-variant` completion, `required-scaffold`
completion) confirm the completion machinery itself is sound — the failures are
edge cases and missing wiring, not architectural gaps. This is days of work,
not weeks.

## Goal

`@json-layout/code` delivers a schema-assisted JSON editor where **validation
diagnostics** and **autocomplete** genuinely work in a real browser, exposed
through a turnkey framework-agnostic `JsonEditor` class, demonstrated by the
`doc/` app.

## Scope

### Workstream 1 — Fix validation end-to-end

- Wire CM's `jsonParseLinter()` (from `@codemirror/lang-json`) as an always-on
  syntax-error source, replacing the `linter(null)` placeholder. Syntax errors
  surface on the fast path, independent of the committed sync.
- Keep the existing committed-path schema-diagnostics dispatch
  (`collectDiagnostics` → `setDiagnostics`) for valid-but-schema-invalid JSON.
- Confirm the two sources coexist (a combined `linter()` source or the
  `setDiagnostics` + `linter(parseSource)` composition) without one clobbering
  the other.
- **New e2e coverage:** a schema-validation case on *valid* JSON that violates
  the schema (e.g. an out-of-enum value, a type mismatch) asserting a
  `.cm-diagnostic` appears with the resolved (i18n'd) message. The current suite
  only tests *syntactic* invalidity; schema diagnostics have zero e2e coverage.
- **Gate:** `lint` e2e green + new schema-diagnostics e2e green.

### Workstream 2 — Fix autocomplete end-to-end

- Root-cause and fix enum value-completion at an empty-string position.
- Root-cause and fix dynamic `getItems` completion.
- Regression-guard the already-passing variant + required-scaffold completions.
- **Gate:** `enum-completion` and `dynamic-get-items` e2e green.

### Workstream 3 — Turnkey `JsonEditor` class

- Build the framework-agnostic `JsonEditor` class per the original spec's
  Public API section, as a thin wrapper over `jsonLayoutExtensions()`:
  constructor mounts an `EditorView` into a host element with the returned
  extensions plus a basic theme; exposes `value` (get/set), `data` (get),
  `diagnostics` (get), `statefulLayout` (get, escape hatch), `focus()`,
  `destroy()`.
- Defer `setSavedData()` / `modified` (depends on the cut modified-gutter
  feature).
- Refactor the doc app's `JsonEditor.vue` to wrap this class rather than
  re-implement the extension wiring (it currently duplicates it and polls
  `statefulLayout.data` on a timer — the class should expose data changes more
  cleanly, e.g. via the existing `onData`-style callback in the options).
- **Gate:** doc app renders through the class; `JsonEditor` has a smoke/unit
  test.

### Workstream 4 — Doc app as living demo

- Ensure curated examples visibly exercise working validation + autocomplete.
- Trim/park examples that depend on cut features: the slot demo (image-upload)
  and the `getItems`-returning-objects → deferred-widget fallback example.
- Keep: simple leaves, nested object, array of objects, oneOf+discriminator,
  `getItems` scalar, `if/then/else` + expressions.
- **Gate:** doc app runs, examples demonstrate the two MVP features.

### Secondary (not a release gate)

- **Hover/help:** fix the failing `hover` e2e. Cheap and already wired; included
  because it rounds out the "assisted" feel, but validation + autocomplete are
  the gates — hover can slip without blocking the MVP.

### Explicitly cut from MVP (deferred)

These remain in the original spec for a future iteration:

- Inline widgets (boolean toggle, enum picker, color swatch, date picker,
  number stepper).
- Slot mechanism + deferred widgets (host-provided DOM callbacks).
- Modified gutter marker + `setSavedData()`.
- YAML / mini-markup / multi-format.
- Framework adapter packages (`code-vue`, `code-react`).
- Lint quick-fix code actions.

## Definition of Done

- All existing e2e tests green, **plus** the new schema-diagnostics e2e.
  (10 → 11 e2e, 0 failing.)
- `JsonEditor` class shipped and unit-smoke-tested; doc app's `JsonEditor.vue`
  wraps it.
- Unit tests still green (149+).
- `npm run quality` (lint → build → test) passes across workspaces.
- Hover e2e green is desirable but not required for done.

## Risks / Open Implementation Questions

- **Two diagnostic sources coexisting.** `setDiagnostics` (imperative,
  committed path) and a `linter()` source (pull-based, syntax) use different CM
  mechanisms. Need to confirm they merge rather than overwrite each other's
  diagnostics in the lint state field. May require routing both through a single
  `linter()` source that reads committed schema diagnostics from a facet.
- **Empty-string completion classification.** `offsetToPath` at
  `{"color": "|"}` must classify the cursor as a `value` position inside the
  empty string. Verify the Lezer-tree walk handles the zero-length string node.
- **Dynamic completion timing.** `getItems` candidates arrive on the committed
  path (debounced 250ms); the e2e must trigger completion *after* a sync.
  Confirm the test's settle timing and the completion source's freshness.
- **Data-change notification.** The doc app currently polls `statefulLayout.data`
  on a 120ms timer. The `JsonEditor` class should expose changes via callback
  instead; confirm `jsonLayoutExtensions()` surfaces an `onData` hook (spec
  lists it) or add it.
