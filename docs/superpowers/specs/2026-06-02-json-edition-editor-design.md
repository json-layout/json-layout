# JSON edition free-form editor page — design

Date: 2026-06-02
Status: approved

## Goal

Add a free-form editor (playground) page to the `json-edition` doc section,
analogous to the editor in the sibling `vjsf` project. The two configuration
inputs — **Schema** and **Stateful layout options** — are editable JSON on the
left; the live `@json-layout/code` assisted data editor renders on the right and
holds the **data** itself (seeded at page load, edited in place — there is no
separate "initial data" tab, exactly as the vjsf editor treats data). Each
curated example gains an **Edit** button that seeds the playground with that
example's content and navigates to it.

## Context

The `doc/` workspace is a Nuxt 4 + Vuetify app exercising `@json-layout/code`.
The existing `json-edition` section has:

- `pages/json-edition/index.vue` — usage docs (Overview).
- `pages/json-edition/[id].vue` — per-example page: a fixed-schema `JsonEditor`
  (left) + `Inspector` (right) for each entry in `doc/examples/index.js`.
- `layouts/edition.vue` — app shell with a left nav drawer listing Overview +
  the examples.
- `components/JsonEditor.vue` — Vue wrapper over the `@json-layout/code`
  `JsonEditor` class (CodeMirror). Constructs on mount, destroys on unmount,
  emits `ready` / `update:text` / `update:data`.
- `components/CodeBlock.vue` — read-only Prism-highlighted code display.
- `components/Inspector.vue`, `components/TopBar.vue`.

The `vjsf` editor (`vjsf/doc/pages/editor.vue`) is the reference: a tabbed
left panel (Schema / Options / Data) of editable code, a live preview on the
right, state persisted in `localStorage`, and an `editExample()` on example
pages that writes `localStorage` then `router.push('/editor')`.

Key difference: in json-layout the `JsonEditor` **is** the product (a
schema-assisted CodeMirror editor for the *data*), so the playground edits the
schema and options on the left and previews — and edits — the assisted *data*
editor on the right, rather than rendering a form. Because the right panel is
itself a JSON text editor for the data, there is no separate left "data" tab:
the data simply lives in the assisted editor, seeded at page load.

Available deps in `doc/`: `@codemirror/commands`, `@codemirror/theme-one-dark`,
`@json-layout/code`, `@json-layout/core`, `vuetify`, `prismjs`.
`@codemirror/lang-json` is present in the root `node_modules` (transitive via
`@json-layout/code`) and will be declared explicitly in `doc/package.json`.
There is **no** `yaml` dependency — editing is JSON-only (no YAML toggle).

## Components

### 1. `doc/components/CodeInput.vue` (new)

A small reusable **editable** CodeMirror JSON editor — the editable counterpart
to the read-only `CodeBlock`.

- Imports: `EditorView`, `lineNumbers`, `keymap` from `@codemirror/view`;
  `EditorState` from `@codemirror/state`; `defaultKeymap`, `history`,
  `historyKeymap` from `@codemirror/commands`; `json()` from
  `@codemirror/lang-json`; `oneDark` from `@codemirror/theme-one-dark`.
- Props: `modelValue: String` (raw text).
- Emits: `update:modelValue` on every doc change.
- `v-model` is the **raw text string**; the component is deliberately dumb —
  the parent owns JSON parsing and error handling.
- Mirrors `JsonEditor.vue` structure: mount an `EditorView` into a host `div`
  in `onMounted`, destroy in `onBeforeUnmount`. Guard against external/internal
  update loops (only dispatch a doc change when `modelValue` differs from the
  current doc text).
- Styling matches `JsonEditor.vue` (`.jl-editor`-like border, monospace font).

### 2. `doc/pages/json-edition/editor.vue` (new)

Orchestrator page. `definePageMeta({ layout: 'edition' })`.

State:
- `schemaText`, `optionsText` — `ref<string>`, each edited by a `CodeInput`
  inside a Vuetify tab strip (tabs: Schema / Options), mirroring the vjsf left
  panel.
- `currentData` — the live data held by the assisted editor. Seeded at page
  load and kept up to date from the editor's `update:data` emit. This is what
  gets re-seeded on remount and persisted — there is no left data tab.
- `parseErrors` — reactive record keyed by tab, populated by parsing each text
  ref in a `watch` (try/catch `JSON.parse`).
- `schemaError` — string holding a compile/validation error message.
- `editorKey` — number bumped to force-remount the right `JsonEditor`.

Behavior:
- On mount: read `localStorage['jl-editor-state']`. If present
  (`{schema, options, data}`), pretty-print `schema`/`options` into the text
  refs and set `currentData = data`. Otherwise fall back to `examples[0]`
  (`schema`, `statefulLayoutOptions`, `initialData`).
- Debounced (~300ms via a small inline `setTimeout`-based debounce helper —
  `@vueuse/core` is **not** a dependency of `doc/`): when
  `schemaText`/`optionsText` change and parse cleanly,
  validate the schema via `compile(schema)` from `@json-layout/core`. On clean
  compile (no throw **and** empty `validationErrors`), clear `schemaError` and
  bump `editorKey` to remount the right editor — re-seeding it with the
  preserved `currentData` so a schema/options edit never wipes the data the user
  typed. On any parse/compile/validation error, set the relevant error and keep
  the right editor unmounted.
- The right `JsonEditor` keeps `currentData` in step via its `@update:data`
  handler, so the latest edits survive the next remount.
- Debounced: persist `{schema, options, data: currentData}` to
  `localStorage['jl-editor-state']`.
- The right `JsonEditor` is rendered with `:key="editorKey"` and
  `:schema`, `:statefulLayoutOptions="options"`, `:initial-data="currentData"`.
  It is wrapped in `<ClientOnly>` (CodeMirror is browser-only, like `[id].vue`).

Layout: two columns (left tabs + error panel, right assisted editor), following
the Vuetify `v-row`/`v-col` conventions already used in `[id].vue`.

### 3. `doc/components/JsonEditor.vue` (reused, unchanged)

Used as the right panel, remounted via `:key="editorKey"`. No changes required.

## Edit button & navigation

- `pages/json-edition/[id].vue`: add an **Edit** button (e.g. near the title /
  teaching notes). On click it writes
  `{schema: example.schema, options: example.statefulLayoutOptions ?? {}, data: example.initialData}`
  to `localStorage['jl-editor-state']`, then `router.push('/json-edition/editor')`.
- `layouts/edition.vue`: add an "Editor" nav item (`to="/json-edition/editor"`,
  a suitable mdi icon) between the Overview item and the Examples subheader.
- `components/TopBar.vue`: add `'editor': 'Editor'` to the breadcrumb `labels`
  map so `/json-edition/editor` reads "Home / JSON edition / Editor".
- Routing: a static `pages/json-edition/editor.vue` takes precedence over the
  dynamic `[id].vue`, so `/json-edition/editor` resolves to the playground (it
  is never looked up as an example id).

## Error handling

- Per-tab JSON parse errors (`parseErrors`) and the schema compile/validation
  error (`schemaError`) are surfaced together in a single alert panel near the
  right editor, echoing vjsf's `errorsYaml` panel.
- The assisted editor only renders when the schema parses and compiles cleanly;
  while errored, the alert is shown and the previously mounted editor is hidden.

## Testing

- `eslint` (neostandard + jsdoc) over the new/changed files.
- `nuxt build` of the `doc` workspace succeeds.
- Manual verification via `npm run dev -w doc` (port 3134):
  1. `/json-edition/editor` loads, bootstrapped from the first example.
  2. Editing the schema rebuilds the assisted editor; completion/hover/lint work.
  3. Invalid JSON in any tab shows the error panel and hides the editor.
  4. An example's **Edit** button lands on the playground seeded with that
     example's schema/options/data.
  5. State survives a page reload (localStorage).

No Nuxt e2e suite exists in the repo (the Playwright `test-browser` harness
targets the `@json-layout/code` package via a separate Vite app), so automated
coverage is limited to lint + build.

## Out of scope (YAGNI)

- YAML editing / language toggle (no `yaml` dep; JSON only).
- An Inspector on the right side (the playground focuses on the assisted editor).
- A separate left "Initial data" tab (data lives in the assisted editor).
- Shareable URL/query-param bootstrap (localStorage only, per the vjsf pattern).
