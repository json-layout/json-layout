# Schema-Assisted Code Edition

## Overview

Add a third "head" to the json-layout foundation alongside form-rendering (vjsf) and LLM-tooling (webmcp): an assisted code editor that lets users edit JSON (and later YAML / mini-markup) directly as text while benefiting from the schema + json-layout annotations for completion, help, diagnostics, and inline/deferred widgets.

The three heads share the same compiled foundation: forms project the skeleton tree to DOM widgets, webmcp projects it to MCP tool descriptors, code-edition projects it to CodeMirror decorations, completions, diagnostics, and widget decorators.

v1 delivers JSON edition only. YAML and mini-markup parsers are future iterations.

## Scope

### In scope for v1

- New `code/` workspace, internally split into `shared/` and `json/`.
- Reuse of `@json-layout/core` — specifically `compile()` outputs and a full `StatefulLayout` kept in sync with the parsed buffer.
- Schema-driven completion covering leaf values, property names, oneOf/anyOf/discriminator scaffolds, and required-object scaffolds.
- Inline widgets baked in for common small leaf types (enum, boolean, getItems scalars, date, etc.).
- Deferred widgets anchored in-editor via CM6 tooltip/popover, plugged via a framework-agnostic callback slot mechanism.
- Diagnostics via `@codemirror/lint` combining syntax errors (fast path) and schema errors (committed path, messages sourced from `StatefulLayout`).
- Hover tooltips for `title` / `description` / `help` (markdown-rendered).
- Bonus: `modified` gutter marker reusing the `modified` tracking recently added to `StatefulLayout`.
- Public API: both a turnkey `JsonEditor` class and a low-level `jsonLayoutExtensions()` factory returning CM6 extensions.
- A Nuxt-based dev/doc app at `doc/` exercising the editor on curated examples.

### Out of scope for v1

- YAML parser, mini-markup parsers.
- vjsf "code view" toggle integration.
- Lint quick-fix code actions (structural corrections).
- Schema authoring (we edit data *against* a schema, not schemas themselves).
- Framework adapter packages (`code-vue`, `code-react`). Left as optional future work if DX demands it.

## Architecture

### Workspace layout

```
json-layout/
  vocabulary/           (existing)
  core/                 (existing)
  examples/             (existing)
  code/                 (new workspace)
    src/
      shared/
      json/
      index.js
    test/
    package.json
  doc/                  (new workspace, private)
    nuxt.config.js
    package.json
    pages/
    examples/
    components/
```

`code/` is a new npm workspace named `@json-layout/code`. It peer-depends on `@json-layout/vocabulary` and depends on `@json-layout/core`. The only heavy external dep is CodeMirror 6 (split into `@codemirror/*` and `@lezer/*` packages as appropriate).

`doc/` is a private (`"private": true`) workspace, not published, used as dev environment and future public documentation.

### Module split: `shared/` vs `json/`

Format-specific surface lives in `json/` (and later `yaml/`, `markup/`). Format-agnostic, schema-driven logic lives in `shared/`.

**`shared/` responsibilities**

- Completion candidate generation from the schema (enum, const, examples, default).
- Dynamic completion candidates via `getItems` (lifted from `core/webmcp/tools/get-field-suggestions.js`).
- Help / description resolution (title, description, help markdown).
- AJV-error → CM `Diagnostic` mapping, reusing `StatefulLayout`'s per-node resolved error messages (i18n + `errorMessages` layout option already applied).
- Widget / slot registry and inline widget descriptors (format-agnostic in concept; placement is delegated to the format adapter).
- The StatefulLayout sync loop — debounced ingestion of parsed data, freeze-at-last-good on syntax error.

**`json/` responsibilities (the format adapter contract)**

The format adapter is the single place where text ↔ structured data translation happens. Its interface:

```typescript
interface FormatAdapter {
  // CM6 language + parser
  language: LanguageSupport

  // Parse text to a JS value (or throw on syntax error)
  parse(text: string): unknown

  // Map a data path ("/foo/0/bar") to the text range of its value token
  pathToRange(text: string, path: string): { from: number, to: number } | null

  // Map a text offset to a data path + which part (key|value|structural)
  offsetToPath(text: string, offset: number): {
    path: string,
    at: 'key' | 'value' | 'structural'
  } | null

  // Serialize a JS value to a format-appropriate snippet for insertion
  scaffold(value: unknown, indent: { column: number, unit: string }): string

  // Insertion semantics: where and how to insert a new property into an object
  insertProperty(text: string, objectPath: string, name: string, value: unknown): {
    from: number,
    to: number,
    insert: string
  }
}
```

`shared/` consumes this interface and never imports `json/` directly — the format adapter is injected at editor construction time. This is the seam that keeps yaml/markup additions cheap.

## State model

### Source of truth

The text buffer is authoritative. The user owns whitespace, comments (relevant for YAML later), and formatting. `StatefulLayout` is a derived mirror that provides validation, expression evaluation, conditional behavior, default-data scaffolding, and message resolution — but is never written back to text.

### Two-tier execution

**Fast path (every keystroke).** Uses CM's own language parser and the format adapter's `offsetToPath`. Provides completion, hover, and help without touching `StatefulLayout`. Works while the buffer is mid-edit or syntactically invalid. Resolves static completion candidates (enum/const/examples/default) directly from `normalizedLayouts`.

**Committed path (debounced / commit-point triggered).** Runs full `format.parse(text)` → updates `StatefulLayout` data → runs AJV validation → pushes diagnostics, widget state, and dynamic completion candidates back into the editor via CM facets / effects.

### Sync triggers

The committed path runs on whichever fires first:

- **Syntactic commit points** detected by a small CM ViewPlugin watching transactions: closing `}` / `]` / `"` / `'`, or end-of-line where the current line ends a structural unit (value completion, property line with no trailing comma, etc.).
- **Debounce fallback** — 250ms idle timer for cases the detector misses.

A v1 non-goal: incremental diffing into `StatefulLayout`. On each committed sync we apply the parsed data as a whole via the root data setter; `StatefulLayout`'s existing immer-based machinery handles structural sharing. If performance on large documents becomes a problem we can revisit.

### Behavior while syntactically invalid

`StatefulLayout` is frozen at the last successfully parsed state. Schema diagnostics shown in the editor remain those from the last good parse, plus the CM-native syntax error. No partial recovery in v1 — the combination of CM syntax diagnostic + frozen schema diagnostics is sufficient UX.

## Features

### Completion

Completion is exposed via a CM6 `CompletionSource`. Scope for v1:

1. **Leaf value completion.** Enum, const, examples, default → static. `getItems` scalars → dynamic (may be async, may depend on form state evaluated by `StatefulLayout`). Both kinds flow through the same `CompletionResult`; static candidates appear immediately, dynamic candidates arrive on the next committed sync.
2. **Property-name completion.** When the cursor is at a key position inside an object, offer all schema properties with `title` / `description` as detail / info, `required` ones ranked first. Accepting a completion inserts `"<name>": <scaffold>` using the adapter's `scaffold` for the property's value schema.
3. **oneOf / anyOf / discriminator scaffolding.** At a value position whose schema is a oneOf/anyOf (or discriminated variant), offer one completion per variant, each labeled with the variant's `title` / `description`. Accepting inserts a default-data scaffold for that variant, built from `StatefulLayout`'s default-data logic. Discriminator-based oneOfs auto-fill the discriminator property.
4. **Required-object scaffold.** At an empty object position (or on explicit trigger), offer a "fill required" completion that scaffolds all required properties with their defaults / placeholders, built from the same default-data primitive as (3).

(3) and (4) share one implementation — a function `scaffoldDefault(schemaNode, compiledLayout): unknown` that walks the skeleton tree and applies `StatefulLayout`'s default-computation rules — with two different trigger surfaces in the completion source.

**Deferred:** lint quick-fix code actions for structural corrections ("add missing required property X") — v2.

### Widgets and slots

**Inline widgets (baked in).** Small, cursor-adjacent decorations rendered via `Decoration.widget` / `Decoration.replace` by the editor itself. v1 ships:

- Boolean toggle (on `boolean` type).
- Enum picker (small popover listing enum values with titles).
- `getItems` value picker (for scalar return types — when `getItems` returns objects, falls through to a deferred widget).
- Color swatch (on `format: color`).
- Date / time picker popover (on date-ish formats).
- Number stepper (on `number` with `min`/`max`/`step`).

Placement is driven by the format adapter's `pathToRange` — widgets anchor to the value token.

**Deferred widgets (slotted).** Rendered via CM6 tooltip/popover anchored at the token. Triggered by a cursor affordance (small `⎘` glyph at the value token, or a keyboard shortcut when the cursor is on the value). Host provides the DOM:

```javascript
new JsonEditor(container, {
  schema,
  slots: {
    'image-upload': (container, ctx) => {
      // ctx: { path, schema, currentValue, applyValue, close }
      // Host mounts whatever UI it wants (Vue, React, vanilla) into container.
    },
    'oneof-picker': (container, ctx) => { /* ... */ }
  }
})
```

Slot resolution order at a given path:

1. Explicit `slot` / `composite-slot` layout keyword → named slot lookup.
2. Built-in inline widget for the type → render inline.
3. No match → no widget; fall back to raw text editing + completion.

Slot definitions live in `shared/` as a framework-agnostic registry. Framework-specific adapters (Vue/React) are deferred.

### Diagnostics

Integrated via `@codemirror/lint`. A single `linter()` instance combines:

- **Syntax errors** from CM's JSON parser — fast path, always on.
- **Schema errors** from `StatefulLayout.validationErrors`, mapped to text ranges via `format.pathToRange(text, errorPath)`.

Range granularity rules:

- Value-scoped errors (`type`, `pattern`, `min`/`max`, `enum`, `format`) → underline the value token.
- Structural errors (`required`, `additionalProperties`, oneOf mismatch) → underline the enclosing `{` or the offending key.
- If `pathToRange` returns null (path no longer resolvable in the current text), the diagnostic is suppressed until the next commit.

Messages are read from `StatefulLayout` so they are already i18n'd and already honor `errorMessages` overrides — no re-resolution in `code/`.

The diagnostic `Collection` is exposed via a CM facet so hosts can render their own error-count badge, side panel, or navigation UI without the workspace owning summary UI.

### Help / description

Hover anywhere on a value or key → CM tooltip with `title` + `description` + `help` (markdown-rendered via `marked`, already a `core` dep). The same content appears as completion `detail` / `info`.

No gutter help glyph, no persistent info panel — keep the decoration budget low; everything is hover-on-demand.

### Modified tracking (bonus)

Reuse `StatefulLayout`'s `modified` / `childModified` flags (added in the modified-tracking spec). Render a subtle gutter marker on any line containing a node whose `modified` is true. Inactive when the host did not pass `savedData` to the editor. Cheap — it is purely a rendering pass on the existing flags.

## Public API

Two exports, both from `@json-layout/code/json`:

### Low-level: extension factory

```typescript
function jsonLayoutExtensions(options: {
  schema: object
  slots?: Record<string, SlotRenderer>
  locale?: string
  compileOptions?: PartialCompileOptions
  statefulLayoutOptions?: PartialStatefulLayoutOptions
  onData?: (data: unknown, source: 'user' | 'programmatic') => void
  onDiagnostics?: (diagnostics: Diagnostic[]) => void
}): Extension[]
```

Returns an array of CM6 extensions that a host composes into its own `EditorView`. This is the composable surface for vjsf-the-library and other power users who want to mix with their own extensions.

### Turnkey: editor class

```typescript
class JsonEditor {
  constructor(parent: HTMLElement, options: JsonEditorOptions)

  get value(): string                    // current text
  set value(v: string)

  get data(): unknown                    // last-committed parsed data (frozen-at-last-good while invalid)
  get diagnostics(): Diagnostic[]
  get statefulLayout(): StatefulLayout   // escape hatch for advanced consumers
  get modified(): boolean

  setSavedData(savedData: unknown): void // enables/updates modified tracking
  focus(): void
  destroy(): void
}
```

Built internally as a thin wrapper over `jsonLayoutExtensions()` — roughly 30 lines creating an `EditorView` with the returned extensions plus a basic theme.

### Slot renderer signature

```typescript
type SlotRenderer = (
  container: HTMLElement,
  ctx: {
    path: string
    schema: object
    currentValue: unknown
    applyValue: (v: unknown) => void
    close: () => void
    statefulLayout: StatefulLayout
  }
) => void | (() => void)  // optional cleanup callback
```

## Dev/doc app (`doc/`)

- **Stack:** Nuxt 4 + Vue 3 + Vuetify 4, mirroring `../vjsf/doc` — `vuetify-nuxt-module`, `vite-plugin-dependency-watcher` for cross-workspace live reload, `ssr: !isDev`.
- **Layout:** sidebar navigation across examples. Each example page renders the `JsonEditor` on the left (or top) and a diagnostic/data side panel on the right showing: parsed data (live), current diagnostics, `modified` paths.
- **Curated examples for v1:**
  - Simple leaves (string/number/boolean/enum).
  - Nested object.
  - Array of objects.
  - oneOf with discriminator (exercises scaffold completion and variant switching).
  - Schema with `getItems` on a scalar (exercises dynamic completion).
  - Schema with `getItems` returning objects (exercises deferred widget fallback).
  - Slot demo: image-upload slot wired to a fake async upload returning an id.
  - Schema with `if/then/else` + expressions (exercises `StatefulLayout` reuse — the required set changes with data).
- **Dev-only, private** workspace. Grows into public docs in a later iteration; vjsf code-view demo slot lives here when that work starts.
- Reuses `@json-layout/examples` schemas where they already cover the needed surface.

## Testing strategy

Follows project conventions (`node:test` + `node:assert`).

- **`code/test/shared/*.spec.js`** — pure unit tests for completion candidate generation, AJV-error → diagnostic mapping, scaffold-default logic. No DOM, no CodeMirror runtime.
- **`code/test/json/adapter.spec.js`** — format adapter round-trips: `parse`, `pathToRange`, `offsetToPath`, `scaffold`, `insertProperty` on a battery of hand-written JSON fixtures covering nested/arrays/oneOf/pattern properties.
- **`code/test/json/integration.spec.js`** — editor integration tests using `happy-dom` or similar to simulate CodeMirror. Drives user-like transactions (type, trigger completion, accept, hover) and asserts on resulting state (editor content, diagnostics collection, `StatefulLayout.data`).
- No visual/E2E tests in v1 — the dev app serves as the manual test surface for visual behavior.

## Dependencies added

To `code/package.json`:

- `@codemirror/state`, `@codemirror/view`, `@codemirror/language`, `@codemirror/autocomplete`, `@codemirror/lint`, `@codemirror/lang-json`.
- `@lezer/json` (transitive, pinned).
- Peer: `@json-layout/vocabulary`. Regular: `@json-layout/core`.

To `doc/package.json`: the vjsf/doc set pared down — Nuxt, `vuetify-nuxt-module`, `vite-plugin-dependency-watcher`, plus `@json-layout/code` and `@json-layout/examples`.

## Risks and open implementation questions

- **Sync performance on large documents.** Full `format.parse` + full data setter on each committed sync may be slow on deeply nested documents. Mitigations available if needed: move parse to a web worker, introduce path-level diffing into `StatefulLayout`. Measure before optimizing.
- **Position stability across edits.** `pathToRange` re-runs on every render; if positions shift between diagnostic computation and render the underline may be stale for one frame. Acceptable for v1; if it becomes visible, map ranges through CM transactions instead.
- **Commit-point detection false negatives.** The 250ms debounce fallback covers this but could feel laggy. Tune after the dev app is usable.
- **`getItems` async cancellation.** A keystroke can invalidate an in-flight dynamic completion. Use an abort controller keyed to the current completion token; discard stale results.
- **Slot lifecycle.** Cleanup callbacks must run when the tooltip closes or the editor is destroyed. Needs a small registry + CM state effect to track mounted slots.

## Build order

Implementation plan will decompose further, but the natural build order is:

1. `code/shared/` format-agnostic primitives + `scaffoldDefault` + diagnostic mapping + help resolution.
2. `code/json/` format adapter.
3. `jsonLayoutExtensions()` wiring the two together.
4. Fast path (completion, hover, help).
5. Committed path (StatefulLayout sync, diagnostics).
6. Inline widgets.
7. Slot mechanism + deferred widgets.
8. `JsonEditor` class.
9. `doc/` app scaffold + examples.
10. Modified gutter marker.

Each step has its own tests and can be exercised through the dev app incrementally.
