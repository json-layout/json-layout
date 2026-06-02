# Doc site home restructure — design

Date: 2026-06-02

## Goal

Turn the `doc/` workspace (currently a "Code edition dev app") into a proper
documentation site fronted by a flat, easily readable home page modeled on the
[vjsf](https://koumoul-dev.github.io/vuetify-jsonschema-form/latest/) home page.

The home page gives a short description of JSON Layout and a list of the most
important implementation contexts, each linking to a focused destination. The
existing editor examples move under a `/json-edition` subdirectory.

## Information architecture & routes

| Route | Content | Layout |
|-------|---------|--------|
| `/` | New flat home — short description + list of implementation contexts | `default` (flat) |
| `/vocabulary` | New — concise Vocabulary + main API surface overview | `default` (flat) |
| `/webmcp` | New — concise WebMCP form-tools usage | `default` (flat) |
| `/json-edition` | Current examples list (moved from `pages/index.vue`) | `edition` (drawer) |
| `/json-edition/[id]` | Current editor (moved from `pages/examples/[id].vue`) | `edition` (drawer) |
| (external) | vjsf documentation → `https://koumoul-dev.github.io/vuetify-jsonschema-form/latest/` | — |

The home page's four implementation contexts link to:

1. **Vocabulary & API** → `/vocabulary`
2. **vjsf documentation** → external vjsf docs
3. **WebMCP tools** → `/webmcp`
4. **JSON edition** → `/json-edition`

## Layouts

Two Nuxt layouts:

- **`layouts/default.vue`** (new, flat): top `v-app-bar` with a "JSON Layout"
  title and a GitHub link; a centered `v-main`. No nav drawer. Used by `/`,
  `/vocabulary`, `/webmcp` (these are the default layout, so no opt-in needed).
- **`layouts/edition.vue`** (rename of the current `layouts/default.vue`): keeps
  the examples nav-drawer. Its "Home" item points to `/`, and the example links
  point to `/json-edition/[id]`. Used by the edition pages via
  `definePageMeta({ layout: 'edition' })`.

## Page details

### `/` — home (flat, vjsf-style, centered)

- Title: **JSON Layout**
- Tagline (from README): *"Vocabulary and tools for rendering and edition of
  schematized JSON documents."*
- One short descriptive paragraph: JSON Layout is a framework-agnostic building
  block for rich forms based on JSON schemas; it compiles an annotated schema
  into a layout description and manages form state.
- A clean vertical list of cards, one per implementation context, each with a
  title, a one-line summary, and a link (internal `to` or external `href`).

### `/vocabulary` — Vocabulary & API (concise real content)

Sourced from the README and package exports. Covers:

- The `layout` keyword that augments a JSON schema with rendering information.
- `@json-layout/vocabulary`: normalization — validates layout keywords, fills
  defaults, transforms into normalized form.
- `@json-layout/core` main API surface:
  - `compile(schema, options)` → a result that can be serialized at build time
    or evaluated at runtime (produces Ajv validators, compiled markdown,
    compiled expressions, and a skeleton component tree).
  - `StatefulLayout` — manages the full state tree of a form instance:
    bidirectional data binding, validation error placement, immutable state via
    immer.

### `/webmcp` — WebMCP form tools (concise real content)

Sourced from `core/src/webmcp`. Covers:

- What WebMCP is: tools registered on the browser's `navigator.modelContext`
  so an AI agent can read and fill a live form.
- The `WebMCP` class from `@json-layout/core/webmcp`:
  `new WebMCP(statefulLayout, options)` with `getTools()`, `registerTools()`,
  and `unregisterTools()`.
- The tool set (one line each), from `core/src/webmcp/tools`:
  - `describe-state` — describe the current form state/structure
  - `get-data` / `set-data` — read / replace the whole data document
  - `set-field-value` — set a single field value
  - `get-field-suggestions` — suggestions for a field
  - `edit-array` — array item operations
  - `fill-form-skill` — optional higher-level fill-the-form skill
- A short wiring snippet: build a `StatefulLayout`, construct `WebMCP`, call
  `await registerTools()`.

## Out of scope

- No changes to `@json-layout/core`, `@json-layout/code`, or any non-`doc`
  workspace.
- No exhaustive per-keyword vocabulary reference or full API reference — the two
  new pages are concise overviews with links onward.
- No new tooling/build changes beyond what Nuxt needs for the new pages/layouts.

## Verification

- `npm run lint -w doc` passes.
- `npm run dev -w doc` (port 3134) serves: home renders flat with the four
  links; `/vocabulary` and `/webmcp` render; `/json-edition` lists examples and
  `/json-edition/[id]` opens the editor with the drawer.
