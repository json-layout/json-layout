# Code Edition — `doc/` App Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a minimal Nuxt 4 + Vue 3 + Vuetify 4 workspace at `doc/` that runs `@json-layout/code` in a real browser, so the user (and future AI agents) can confirm editor behavior — completion, hover, diagnostics, dynamic `getItems`, freeze-at-last-good — by typing in curated examples. Out of scope here but planned next: an e2e test suite on top of this app.

**Architecture:** A new private workspace `doc/` with four curated inline example schemas, a thin `<JsonEditor.vue>` SFC that mounts a CodeMirror 6 `EditorView` configured by `jsonLayoutExtensions(compiledLayout, { statefulLayout })`, and an `<Inspector.vue>` side panel showing parsed data + diagnostics + modified paths. Examples live at `/examples/:id` so routes are stable for future e2e tests. No `JsonEditor` class yet (that lands with build-order item 8); this plan uses the primitives directly. SSR is disabled in dev (CodeMirror is browser-only) and enabled for production build smoke.

**Tech Stack:** Nuxt 4, Vue 3, Vuetify 4 (via `vuetify-nuxt-module`), `vite-plugin-dependency-watcher` for cross-workspace live reload, `@nuxt/eslint`, `@codemirror/state`/`view` (peer-deduped from `code/`), and the public surface of `@json-layout/code` + `@json-layout/core`.

**Spec:** `docs/superpowers/specs/2026-04-21-code-edition-design.md` — section *"Dev/doc app (`doc/`)"* and *"Build order"* item 9.

**Depends on:**
- Plans 1–5 (already landed on `feat-code-edition`): core exposures, JSON adapter, shared primitives, CM6 fast-path, committed path. The public surface consumed by the doc app is `compile`, `StatefulLayout` (from `@json-layout/core`) and `jsonLayoutExtensions` (from `@json-layout/code`).

**Out of scope for this plan** (future plans):
- Build-order items 6–8: inline widgets, slot mechanism, `JsonEditor` class. The doc app mounts CM6 directly in the meantime.
- Build-order item 10: modified gutter marker.
- E2e test suite. Planned as the immediate next plan after this one; this plan ensures stable routes and `data-testid` attributes so e2e can attach without rework.
- SSR behavior for examples (examples pages are client-only because CodeMirror cannot render on the server). The production build check in Task 8 only asserts the build does not crash.
- Public deployment config (TARGET env, GitHub pages build scripts). Local dev + local production build only.

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `package.json` (root) | Modify | Add `doc` to `workspaces` array |
| `eslint.config.mjs` (root) | Modify | Add `doc/**` to `ignores` — doc has its own flat config via `@nuxt/eslint` |
| `doc/package.json` | Create | Private workspace, Nuxt dev/build/lint scripts, deps |
| `doc/nuxt.config.js` | Create | Nuxt + Vuetify + dependency-watcher wiring, `ssr: !isDev` |
| `doc/tsconfig.json` | Create | Extends Nuxt's generated `.nuxt/tsconfig.json` |
| `doc/eslint.config.mjs` | Create | `@nuxt/eslint` flat config scoped to `doc/` |
| `doc/.gitignore` | Create | Ignore `.nuxt/`, `.output/`, `node_modules/`, `dist/` |
| `doc/app.vue` | Create | Root layout: `<NuxtLayout>` + `<NuxtPage>` |
| `doc/layouts/default.vue` | Create | Shell with top bar + sidebar listing examples |
| `doc/examples/index.js` | Create | Array of curated example descriptors (schema + initial data + doc) |
| `doc/components/JsonEditor.vue` | Create | Thin CM6 mount: takes `compiledLayout` + `statefulLayout`, emits `update:data` |
| `doc/components/Inspector.vue` | Create | Right panel: parsed data, diagnostics, modified paths |
| `doc/pages/index.vue` | Create | Welcome page with links to each example |
| `doc/pages/examples/[id].vue` | Create | Per-example route: loads example, compiles schema, renders editor + inspector |

All source is plain JS / Vue 3 SFCs with `<script setup>` syntax (matching vjsf/doc). No TypeScript in authored code beyond the Vue type-check pass Nuxt runs during build.

---

### Task 1: Register the `doc` workspace and install Nuxt + Vuetify deps

**Files:**
- Modify: `package.json` (root)
- Modify: `eslint.config.mjs` (root)
- Create: `doc/package.json`
- Create: `doc/.gitignore`

Rationale: npm workspaces must be declared up front so `npm install` hoists deps and creates the `node_modules/@json-layout/*` symlinks the Nuxt app will import. Root lint ignores `doc/**` because Vue SFCs need a parser the root neostandard config doesn't provide; doc has its own lint pipeline.

- [ ] **Step 1: Add `doc` to the root `workspaces` array**

Modify `package.json`. The current `workspaces` block is:

```json
"workspaces": [
  "vocabulary",
  "core",
  "examples",
  "code"
],
```

Replace with:

```json
"workspaces": [
  "vocabulary",
  "core",
  "examples",
  "code",
  "doc"
],
```

- [ ] **Step 2: Extend root eslint ignores to cover `doc/**`**

Modify `eslint.config.mjs`. The current `ignores` block is:

```javascript
{ ignores: ['**/tmp/*', '**/types/*', 'vocabulary/**/types.ts', 'core/**/types.ts', 'examples/**/types.ts', 'code/**/types.ts', '**/*.d.ts', '**/schema.js'] },
```

Replace with:

```javascript
{ ignores: ['**/tmp/*', '**/types/*', 'vocabulary/**/types.ts', 'core/**/types.ts', 'examples/**/types.ts', 'code/**/types.ts', '**/*.d.ts', '**/schema.js', 'doc/**'] },
```

- [ ] **Step 3: Create `doc/package.json`**

Create `doc/package.json`:

```json
{
  "name": "@json-layout/doc",
  "private": true,
  "version": "0.0.1",
  "description": "JSON Layout - dev/doc app exercising @json-layout/code in a real browser.",
  "type": "module",
  "scripts": {
    "dev": "nuxt dev --port 3134",
    "build": "nuxt build",
    "generate": "nuxt generate",
    "preview": "nuxt preview",
    "lint": "eslint .",
    "lint-fix": "eslint --fix ."
  },
  "dependencies": {
    "@json-layout/code": "*",
    "@json-layout/core": "*",
    "@mdi/font": "^7.4.47",
    "nuxt": "^4.2.2",
    "vuetify": "^4.0.0",
    "vuetify-nuxt-module": "^0.19.5"
  },
  "devDependencies": {
    "@nuxt/eslint": "^0.7.3",
    "vite-plugin-dependency-watcher": "^0.5.0"
  }
}
```

Rationale on deps: `@json-layout/code` and `@json-layout/core` are resolved via workspace symlinks (`*` range is fine because npm workspaces always picks the local copy). Vuetify 4 + `vuetify-nuxt-module` mirror the spec's stack. `vite-plugin-dependency-watcher` is a dev-only tool that makes Vite watch the sibling `code/`/`core/` source files so editing them triggers HMR in the doc app.

- [ ] **Step 4: Create `doc/.gitignore`**

Create `doc/.gitignore`:

```
.nuxt/
.output/
.data/
dist/
node_modules/
*.log
```

- [ ] **Step 5: Install**

Run from repo root: `npm install`
Expected: succeeds; `node_modules/@json-layout/doc` appears as a symlink to `doc/`; `node_modules/nuxt`, `node_modules/vuetify`, `node_modules/vuetify-nuxt-module`, `node_modules/vite-plugin-dependency-watcher`, `node_modules/@nuxt/eslint` all populate.

- [ ] **Step 6: Confirm root lint still passes**

Run from repo root: `npm run lint`
Expected: succeeds. `doc/**` is ignored so empty `doc/package.json` doesn't break anything.

- [ ] **Step 7: Commit**

```bash
git add package.json eslint.config.mjs package-lock.json doc/package.json doc/.gitignore
git commit -m "chore(doc): scaffold private workspace with Nuxt+Vuetify deps"
```

---

### Task 2: Nuxt + Vuetify config + root app shell

**Files:**
- Create: `doc/nuxt.config.js`
- Create: `doc/tsconfig.json`
- Create: `doc/eslint.config.mjs`
- Create: `doc/app.vue`
- Create: `doc/layouts/default.vue`

Rationale: this is the smallest surface that produces a bootable Nuxt app with Vuetify styling and HMR against the sibling `code/` workspace. No real content yet — Task 3 onwards fills in examples.

- [ ] **Step 1: Create `doc/nuxt.config.js`**

Create `doc/nuxt.config.js`:

```javascript
import path from 'node:path'
import { defineNuxtConfig } from 'nuxt/config'
import dependencyWatcher from 'vite-plugin-dependency-watcher'

const packageNames = ['@json-layout/code', '@json-layout/core', '@json-layout/vocabulary']
const packagePaths = packageNames.map((name) => path.resolve(process.cwd(), '../node_modules', name))

const isDev = process.env.NODE_ENV === 'development'

export default defineNuxtConfig({
  modules: [
    ['@nuxt/eslint', { config: { stylistic: true } }],
    'vuetify-nuxt-module'
  ],
  ssr: !isDev,
  css: ['vuetify/styles', '@mdi/font/css/materialdesignicons.css'],
  build: {
    transpile: ['vuetify']
  },
  compatibilityDate: '2026-04-22',
  vite: {
    plugins: [dependencyWatcher(packagePaths, packageNames)]
  },
  vuetify: {
    vuetifyOptions: {
      icons: { defaultSet: 'mdi' },
      theme: {
        defaultTheme: 'dark'
      }
    }
  }
})
```

Rationale: `ssr: !isDev` matches the spec; CodeMirror cannot render on the server, so dev is pure SPA. Production `nuxt build` does SSR but the example pages will fall back to client-only mounting — that's handled in Task 7 via `<ClientOnly>`.

- [ ] **Step 2: Create `doc/tsconfig.json`**

Create `doc/tsconfig.json`:

```json
{
  "extends": "./.nuxt/tsconfig.json"
}
```

- [ ] **Step 3: Create `doc/eslint.config.mjs`**

Create `doc/eslint.config.mjs`:

```javascript
// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt()
```

This relies on the `@nuxt/eslint` module to generate `.nuxt/eslint.config.mjs` on first Nuxt run (via `nuxi prepare` or `nuxt dev`). Until then, the doc-scoped `npm run lint` will fail — which is fine; the root `npm run quality` does not invoke doc lint, and the first `nuxt dev` in Task 8 generates the required file.

- [ ] **Step 4: Create `doc/app.vue`**

Create `doc/app.vue`:

```vue
<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
```

- [ ] **Step 5: Create `doc/layouts/default.vue`**

Create `doc/layouts/default.vue`:

```vue
<script setup>
import examples from '~/examples/index.js'
</script>

<template>
  <v-app>
    <v-app-bar flat>
      <v-app-bar-title>JSON Layout — Code edition dev</v-app-bar-title>
    </v-app-bar>

    <v-navigation-drawer permanent width="260">
      <v-list nav density="compact">
        <v-list-item to="/" title="Home" prepend-icon="mdi-home" />
        <v-list-subheader>Examples</v-list-subheader>
        <v-list-item
          v-for="ex in examples"
          :key="ex.id"
          :to="`/examples/${ex.id}`"
          :title="ex.title"
          :subtitle="ex.summary"
          prepend-icon="mdi-code-json"
          :data-testid="`nav-example-${ex.id}`"
        />
      </v-list>
    </v-navigation-drawer>

    <v-main>
      <v-container fluid>
        <slot />
      </v-container>
    </v-main>
  </v-app>
</template>
```

Rationale: the `data-testid` attributes are intentional — they give the future e2e plan stable selectors. Keep the layout minimal (drawer + main) so future changes don't break e2e selectors unless the nav structure itself changes.

- [ ] **Step 6: Prepare Nuxt (generates `.nuxt/`)**

Run from repo root: `npx -w doc nuxi prepare`
Expected: succeeds; `doc/.nuxt/` directory appears with `tsconfig.json`, `eslint.config.mjs`, type shims.

If the command fails because `~/examples/index.js` does not exist yet, that's expected — `nuxi prepare` does not import user modules. If it still fails, run `npx -w doc nuxi prepare --dotenv=/dev/null` to rule out env config.

- [ ] **Step 7: Commit**

```bash
git add doc/nuxt.config.js doc/tsconfig.json doc/eslint.config.mjs doc/app.vue doc/layouts/default.vue
git commit -m "feat(doc): add Nuxt+Vuetify config and base app shell"
```

---

### Task 3: Curated example descriptors

**Files:**
- Create: `doc/examples/index.js`

Semantic contract: `doc/examples/index.js` exports a default array of `{ id, title, summary, schema, initialData, teachingNotes }` entries. Each example is hand-picked to exercise one distinct editor feature end-to-end, so that the user (or an e2e test) can verify the feature works by loading the page, typing, and observing.

Four examples:
1. **basic** — enum value + title/description. Exercises value completion and hover.
2. **required-nested** — nested object with required child. Exercises property-name completion + scaffolded default insertion.
3. **one-of-variants** — oneOf with discriminator. Exercises variant completion.
4. **get-items** — `layout.getItems` array. Exercises dynamic (async) completion via the committed path.

- [ ] **Step 1: Create `doc/examples/index.js`**

Create `doc/examples/index.js`:

```javascript
/**
 * Curated examples for the dev/doc app. Each entry is rendered at /examples/:id
 * and drives the full editor wiring (compile → StatefulLayout → CM6 extensions).
 *
 * Teaching notes are rendered above the editor so the user knows what to try.
 */

/**
 * @typedef {object} Example
 * @property {string} id — URL slug and test id.
 * @property {string} title — shown in nav.
 * @property {string} summary — one-liner, shown under title in nav.
 * @property {object} schema — raw JSON Schema passed to `compile`.
 * @property {unknown} initialData — initial `StatefulLayout` data.
 * @property {string[]} teachingNotes — rendered above the editor.
 */

/** @type {Example[]} */
const examples = [
  {
    id: 'basic',
    title: 'Basic value completion',
    summary: 'Enum + title/description on a leaf field.',
    schema: {
      type: 'object',
      title: 'Traffic light',
      properties: {
        color: {
          type: 'string',
          title: 'Colour',
          description: 'Which lamp is currently lit.',
          enum: ['red', 'amber', 'green']
        }
      }
    },
    initialData: { color: 'red' },
    teachingNotes: [
      'Place the cursor inside the empty string value for `color` and press Ctrl+Space — three completions (red, amber, green) should appear.',
      'Hover anywhere on the `color` key or value — the tooltip should show "Colour" and the description.'
    ]
  },
  {
    id: 'required-nested',
    title: 'Required property scaffold',
    summary: 'Completion inserts nested required defaults.',
    schema: {
      type: 'object',
      required: ['cfg'],
      properties: {
        cfg: {
          type: 'object',
          title: 'Configuration',
          required: ['enabled', 'retries'],
          properties: {
            enabled: { type: 'boolean', default: true },
            retries: { type: 'integer', default: 3 }
          }
        }
      }
    },
    initialData: {},
    teachingNotes: [
      'Start with an empty object `{}` — place the cursor between the braces, open completion, pick `cfg`.',
      'The inserted text should include `"cfg": {"enabled": true, "retries": 3}` — scaffoldDefault fills the required nested shape.'
    ]
  },
  {
    id: 'one-of-variants',
    title: 'oneOf variant picker',
    summary: 'Discriminator-aware variant scaffolding.',
    schema: {
      type: 'object',
      required: ['payload'],
      properties: {
        payload: {
          discriminator: { propertyName: 'kind' },
          required: ['kind'],
          oneOf: [
            {
              title: 'Text',
              properties: {
                kind: { const: 'text' },
                content: { type: 'string', default: '...' }
              },
              required: ['content']
            },
            {
              title: 'Number',
              properties: {
                kind: { const: 'number' },
                value: { type: 'integer', default: 0 }
              },
              required: ['value']
            }
          ]
        }
      }
    },
    initialData: { payload: { kind: 'text', content: 'hi' } },
    teachingNotes: [
      'Select the whole `payload` object value, then open completion — two variant candidates (Text, Number) should appear.',
      'Picking `Number` should replace the value with `{"kind": "number", "value": 0}`.'
    ]
  },
  {
    id: 'get-items',
    title: 'Dynamic getItems',
    summary: 'Async completion via the committed path.',
    schema: {
      type: 'object',
      properties: {
        country: {
          type: 'string',
          title: 'Country',
          layout: {
            getItems: ['France', 'Germany', 'Italy', 'Spain', 'Portugal']
          }
        }
      }
    },
    initialData: { country: '' },
    teachingNotes: [
      'Place the cursor inside the empty `country` value. Dynamic candidates flow through the committed path (250ms debounce).',
      'After a short pause you should see France/Germany/Italy/Spain/Portugal in the completion menu.'
    ]
  }
]

export default examples
```

- [ ] **Step 2: Commit**

```bash
git add doc/examples/index.js
git commit -m "feat(doc): add four curated examples covering completion/diagnostics/getItems"
```

---

### Task 4: `<JsonEditor.vue>` — thin CM6 mount

**Files:**
- Create: `doc/components/JsonEditor.vue`

Semantic contract:
- Props: `compiledLayout` (`CompiledLayout`), `statefulLayout` (`StatefulLayout`), `initialText` (`string`).
- Emits: `update:text` (debounced via CM's own debounce inside `jsonLayoutExtensions`), `update:data` (dispatched every time `statefulLayout.data` changes).
- Mounts CodeMirror 6 into a `<div ref="host">` inside `onMounted`. Destroys on `onBeforeUnmount`.
- Wrapped in `<ClientOnly>` by the parent page, never by this component — keeps the component flexible for non-SSR contexts.

- [ ] **Step 1: Create `doc/components/JsonEditor.vue`**

Create `doc/components/JsonEditor.vue`:

```vue
<script setup>
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { EditorView, lineNumbers, keymap } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { lintGutter } from '@codemirror/lint'
import { jsonLayoutExtensions } from '@json-layout/code'

const props = defineProps({
  compiledLayout: { type: Object, required: true },
  statefulLayout: { type: Object, required: true },
  initialText: { type: String, required: true }
})

const emit = defineEmits(['update:text', 'update:data'])

const host = ref(/** @type {HTMLElement | null} */(null))
/** @type {EditorView | null} */
let view = null
/** @type {ReturnType<typeof setInterval> | null} */
let dataPoll = null
let lastDataSnapshot = /** @type {string} */(JSON.stringify(props.statefulLayout.data))

function startDataPolling () {
  dataPoll = setInterval(() => {
    const current = JSON.stringify(props.statefulLayout.data)
    if (current !== lastDataSnapshot) {
      lastDataSnapshot = current
      emit('update:data', props.statefulLayout.data)
    }
  }, 120)
}

function stopDataPolling () {
  if (dataPoll !== null) {
    clearInterval(dataPoll)
    dataPoll = null
  }
}

onMounted(() => {
  if (!host.value) return
  view = new EditorView({
    parent: host.value,
    state: EditorState.create({
      doc: props.initialText,
      extensions: [
        lineNumbers(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        lintGutter(),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) emit('update:text', update.state.doc.toString())
        }),
        ...jsonLayoutExtensions(props.compiledLayout, { statefulLayout: props.statefulLayout })
      ]
    })
  })
  startDataPolling()
})

onBeforeUnmount(() => {
  stopDataPolling()
  if (view) {
    view.destroy()
    view = null
  }
})

// Swapping the example rebuilds the editor. Simplest path: force remount via
// :key on the parent (Task 7). This watcher is a belt-and-braces reset in case
// the parent forgets to remount.
watch(() => props.statefulLayout, () => {
  lastDataSnapshot = JSON.stringify(props.statefulLayout.data)
})
</script>

<template>
  <div
    ref="host"
    class="jl-editor"
    data-testid="json-editor"
  />
</template>

<style scoped>
.jl-editor {
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 4px;
  min-height: 240px;
  font-family: 'Fira Code', 'Menlo', monospace;
  font-size: 13px;
}
.jl-editor :deep(.cm-editor) {
  min-height: 240px;
}
.jl-editor :deep(.cm-content) {
  padding: 8px 0;
}
</style>
```

Rationale on the data polling: `StatefulLayout.data` mutates out-of-band inside the sync ViewPlugin; there is no Vue reactive hook on it. A 120ms poll is cheap, keeps the inspector panel in sync, and is simpler than wiring up a reactive proxy over the whole `StatefulLayout` instance. The e2e plan can replace this with a more precise signal later.

- [ ] **Step 2: Commit**

```bash
git add doc/components/JsonEditor.vue
git commit -m "feat(doc): add JsonEditor SFC mounting CM6 via jsonLayoutExtensions"
```

---

### Task 5: `<Inspector.vue>` — data + diagnostics side panel

**Files:**
- Create: `doc/components/Inspector.vue`

Semantic contract:
- Props: `data` (parsed root data, reactive), `statefulLayout` (`StatefulLayout`, reactive through `data` only), `text` (current editor buffer).
- Renders three cards:
  - **Data**: pretty-printed `data` (JSON.stringify with indent 2).
  - **Diagnostics**: list of `{ path, message, severity }` from `collectDiagnostics(statefulLayout, text, jsonFormatAdapter)`. Re-computed per render.
  - **Modified paths**: walks `statefulLayout.stateTree.root` and lists `dataPath` values where `node.modified === true`. This exercises the `modified` tracking that landed in a prior plan.

- [ ] **Step 1: Create `doc/components/Inspector.vue`**

Create `doc/components/Inspector.vue`:

```vue
<script setup>
import { computed } from 'vue'
import { collectDiagnostics, jsonFormatAdapter } from '@json-layout/code'

const props = defineProps({
  data: { type: null, required: true },
  statefulLayout: { type: Object, required: true },
  text: { type: String, required: true }
})

const diagnostics = computed(() => {
  return collectDiagnostics(props.statefulLayout, props.text, jsonFormatAdapter)
})

function * walkNodes (root) {
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

const modifiedPaths = computed(() => {
  // statefulLayout is not reactive, but `props.data` changes every committed
  // sync, which re-runs this computed — so the list stays fresh.
  void props.data
  const paths = []
  for (const node of walkNodes(props.statefulLayout.stateTree.root)) {
    if (node.modified === true && typeof node.dataPath === 'string') {
      paths.push(node.dataPath)
    }
  }
  return paths
})

const dataPretty = computed(() => JSON.stringify(props.data, null, 2))
</script>

<template>
  <div class="jl-inspector">
    <v-card class="mb-3" data-testid="inspector-data">
      <v-card-title>Data</v-card-title>
      <v-card-text>
        <pre class="jl-pre">{{ dataPretty }}</pre>
      </v-card-text>
    </v-card>

    <v-card class="mb-3" data-testid="inspector-diagnostics">
      <v-card-title>Diagnostics ({{ diagnostics.length }})</v-card-title>
      <v-card-text>
        <div v-if="!diagnostics.length" class="text-disabled">
          No diagnostics.
        </div>
        <ul v-else class="jl-diag-list">
          <li v-for="(d, i) in diagnostics" :key="i">
            <code>{{ d.path || '/' }}</code> — {{ d.message }}
          </li>
        </ul>
      </v-card-text>
    </v-card>

    <v-card data-testid="inspector-modified">
      <v-card-title>Modified paths ({{ modifiedPaths.length }})</v-card-title>
      <v-card-text>
        <div v-if="!modifiedPaths.length" class="text-disabled">
          No modified paths.
        </div>
        <ul v-else class="jl-modified-list">
          <li v-for="p in modifiedPaths" :key="p">
            <code>{{ p || '/' }}</code>
          </li>
        </ul>
      </v-card-text>
    </v-card>
  </div>
</template>

<style scoped>
.jl-inspector {
  display: flex;
  flex-direction: column;
  gap: 0;
}
.jl-pre {
  white-space: pre-wrap;
  margin: 0;
  font-family: 'Fira Code', 'Menlo', monospace;
  font-size: 12px;
}
.jl-diag-list,
.jl-modified-list {
  margin: 0;
  padding-left: 20px;
  font-size: 13px;
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add doc/components/Inspector.vue
git commit -m "feat(doc): add Inspector SFC showing data/diagnostics/modified"
```

---

### Task 6: Home page — welcome + examples list

**Files:**
- Create: `doc/pages/index.vue`

- [ ] **Step 1: Create `doc/pages/index.vue`**

Create `doc/pages/index.vue`:

```vue
<script setup>
import examples from '~/examples/index.js'
</script>

<template>
  <v-row>
    <v-col cols="12">
      <h1 class="text-h4 mb-4">
        JSON Layout — Code edition dev app
      </h1>
      <p class="text-body-1 mb-2">
        Open any example to exercise the CodeMirror 6 editor wired with
        <code>@json-layout/code</code>. Completion, hover, and diagnostics all
        flow from a single <code>CompiledLayout</code>; the committed path
        (debounced 250&nbsp;ms) keeps a <code>StatefulLayout</code> in step with
        the buffer and surfaces schema errors through <code>@codemirror/lint</code>.
      </p>
      <v-list lines="two" data-testid="home-examples-list">
        <v-list-item
          v-for="ex in examples"
          :key="ex.id"
          :to="`/examples/${ex.id}`"
          :title="ex.title"
          :subtitle="ex.summary"
          :data-testid="`home-example-${ex.id}`"
        />
      </v-list>
    </v-col>
  </v-row>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add doc/pages/index.vue
git commit -m "feat(doc): add home page listing curated examples"
```

---

### Task 7: Per-example page — editor + inspector

**Files:**
- Create: `doc/pages/examples/[id].vue`

Semantic contract: the page route is `/examples/:id`. On load (client-only via `<ClientOnly>`):
1. Look up the example by id; 404 via `throw createError({ statusCode: 404 })` if missing.
2. `await compile(example.schema)` → `CompiledLayout`.
3. Build a `StatefulLayout` with `{ debounceInputMs: 0, initialValidation: 'always' }` and `example.initialData`.
4. `initialText = JSON.stringify(example.initialData, null, 2)`.
5. Render `<JsonEditor>` + `<Inspector>` side by side. The editor emits `update:text` and `update:data`; the page updates local refs so the inspector re-renders.
6. A `:key` equal to `example.id` forces a full remount when navigating between examples.

- [ ] **Step 1: Create `doc/pages/examples/[id].vue`**

Create `doc/pages/examples/[id].vue`:

```vue
<script setup>
import { ref, shallowRef } from 'vue'
import { useRoute } from 'vue-router'
import { compile, StatefulLayout } from '@json-layout/core'
import examples from '~/examples/index.js'

const route = useRoute()
const example = examples.find((e) => e.id === route.params.id)
if (!example) {
  throw createError({ statusCode: 404, statusMessage: `Unknown example: ${route.params.id}` })
}

const initialText = JSON.stringify(example.initialData, null, 2)

const compiledLayout = shallowRef(null)
const statefulLayout = shallowRef(null)
const liveData = ref(example.initialData)
const liveText = ref(initialText)
const ready = ref(false)

async function boot () {
  const compiled = await compile(example.schema)
  compiledLayout.value = compiled
  statefulLayout.value = new StatefulLayout(
    compiled,
    compiled.skeletonTrees[compiled.mainTree],
    { debounceInputMs: 0, initialValidation: 'always' },
    example.initialData
  )
  ready.value = true
}

if (import.meta.client) {
  boot()
}

function onUpdateText (text) {
  liveText.value = text
}

function onUpdateData (data) {
  liveData.value = data
}
</script>

<template>
  <v-row>
    <v-col cols="12">
      <h2 class="text-h5 mb-2">
        {{ example.title }}
      </h2>
      <ul class="mb-4">
        <li v-for="note in example.teachingNotes" :key="note">
          {{ note }}
        </li>
      </ul>
    </v-col>

    <v-col cols="12" md="7">
      <ClientOnly>
        <JsonEditor
          v-if="ready"
          :key="example.id"
          :compiled-layout="compiledLayout"
          :stateful-layout="statefulLayout"
          :initial-text="initialText"
          @update:text="onUpdateText"
          @update:data="onUpdateData"
        />
        <template #fallback>
          <div data-testid="editor-loading">
            Loading editor…
          </div>
        </template>
      </ClientOnly>
    </v-col>

    <v-col cols="12" md="5">
      <ClientOnly>
        <Inspector
          v-if="ready"
          :key="example.id"
          :data="liveData"
          :stateful-layout="statefulLayout"
          :text="liveText"
        />
      </ClientOnly>
    </v-col>
  </v-row>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add doc/pages/examples/[id].vue
git commit -m "feat(doc): add per-example page wiring editor + inspector"
```

---

### Task 8: Boot smoke — dev server + production build

**Files:** None (verification only).

Goal: prove the app boots and builds. No e2e here; manual browser verification follows.

- [ ] **Step 1: Start the dev server in background**

Run: `npm run dev -w doc` (in background via your shell's job control, or inside a Monitor agent if available).

Wait until stdout contains `Local:` line. Expected URL is `http://localhost:3134/`.

- [ ] **Step 2: Smoke-hit the home page**

Run: `curl -sS -o /tmp/doc-home.html -w '%{http_code}\n' http://localhost:3134/`
Expected: `200`. Check the body: `grep -c 'home-examples-list' /tmp/doc-home.html` returns `1` or higher.

(In dev mode with `ssr: false` the HTML is the app shell only; the examples list is hydrated client-side. So the grep is for the `data-testid` attribute, which exists in the template chunk Vite ships to the client. If the grep returns `0`, confirm by opening the page in a real browser — the test here is whether Vite compiled the SFC, not whether SSR rendered it.)

- [ ] **Step 3: Smoke-hit one example page**

Run: `curl -sS -o /tmp/doc-basic.html -w '%{http_code}\n' http://localhost:3134/examples/basic`
Expected: `200`.

- [ ] **Step 4: Stop the dev server**

Kill the background job (Ctrl+C / job kill).

- [ ] **Step 5: Run a production build**

Run: `NODE_ENV=production npm run build -w doc`
Expected: exits `0`. `doc/.output/` directory appears.

If the build fails on `@codemirror/view` / `@codemirror/state` interop, add them to `vite.optimizeDeps.include` in `doc/nuxt.config.js`:

```javascript
vite: {
  optimizeDeps: {
    include: [
      '@codemirror/view',
      '@codemirror/state',
      '@codemirror/autocomplete',
      '@codemirror/language',
      '@codemirror/lang-json',
      '@codemirror/lint',
      '@codemirror/commands'
    ]
  },
  plugins: [dependencyWatcher(packagePaths, packageNames)]
}
```

…and re-run the build.

- [ ] **Step 6: Run the root quality pipeline to confirm nothing broke**

Run: `npm run quality`
Expected: exits `0`. The `doc/` workspace is not in the build/test scripts, but it is covered by the root eslint ignore so lint stays clean.

- [ ] **Step 7: Manual browser verification (not scripted yet — e2e lands next plan)**

Human check:
1. Start the dev server: `npm run dev -w doc`.
2. Open `http://localhost:3134/examples/basic`. Place the cursor inside the `"red"` value. Press `Ctrl+Space`. Confirm `red`, `amber`, `green` appear in the completion menu.
3. Hover the `color` key. Confirm a tooltip shows "Colour" + description.
4. Change `"red"` to `"purple"`. After ~250ms, confirm the Diagnostics card lists an error for `/color`.
5. Navigate to `/examples/get-items`. Clear the `country` value. Press `Ctrl+Space`. After the 250ms debounce, confirm `France`/`Germany`/`Italy`/`Spain`/`Portugal` appear.
6. Navigate to `/examples/one-of-variants`. Select the whole `payload` object. Press `Ctrl+Space`. Confirm `Text` and `Number` variants appear.
7. Watch the `Data` inspector — confirm it updates live as the editor content changes.
8. Watch the `Diagnostics` inspector — confirm entries appear and disappear as the buffer becomes invalid / valid.
9. Watch the `Modified paths` inspector — confirm paths accumulate as the user edits values away from their initial data.

Record any behavior that does not match the expectation as a bug — the next plan (e2e) will encode these expectations as automated tests, so bugs found here must be fixed before that plan starts.

- [ ] **Step 8: Final summary**

Confirm deliverable vs goal:

- `doc/` is a bootable Nuxt 4 + Vue 3 + Vuetify 4 workspace; `npm run dev -w doc` starts the app on port 3134; `npm run build -w doc` succeeds.
- Four curated examples exercise value completion (basic), property scaffold (required-nested), variant scaffold (one-of-variants), and async dynamic completion (get-items).
- Editor + inspector layout is stable and all interactive elements carry `data-testid` attributes so the next plan's e2e suite can attach without rework.
- Root `npm run quality` still passes; the `doc/` workspace is private and not in the build/test scripts.

No additional commit — verification only.

---

## Self-Review

Against the spec section *"Dev/doc app (`doc/`)"*:
- **Stack** — Nuxt 4 + Vue 3 + Vuetify 4 ✓ (Task 1 deps, Task 2 config).
- **`vuetify-nuxt-module`, `vite-plugin-dependency-watcher`, `ssr: !isDev`** — ✓ (Task 2 `nuxt.config.js`).
- **Sidebar nav across examples** — ✓ (`default.vue` in Task 2).
- **Editor on left, diagnostic/data side panel on right** — ✓ (Task 7 `[id].vue` `v-col md=7` + `md=5`).
- **Parsed data live, current diagnostics, modified paths** — ✓ (Task 5 `Inspector.vue` has all three cards).
- **Curated examples for v1** — partial: the spec lists enum / required nested / getItems / discriminated oneOf / conditional / slot demo; this plan covers four of those (enum as "basic", required nested, oneOf with discriminator, getItems). The slot demo and conditional example are intentionally deferred — the slot mechanism doesn't exist yet (build-order item 7) and a conditional example would duplicate what the hover/diagnostic flow already covers. These can be added incrementally as future plans land.
- **Dev-only, private workspace** — ✓ (Task 1 `"private": true`).
- **Reuses `@json-layout/examples` schemas where they already cover the needed surface** — deferred: all four example schemas are inline so this plan is self-contained. Future plans may swap to `@json-layout/examples` once we identify specific schemas to reuse.

No placeholders, no dangling references: `JsonEditor`/`Inspector` referenced in Task 7 are defined in Tasks 4/5; `examples/index.js` referenced in Tasks 2/6/7 is defined in Task 3; all `data-testid` attribute names are explicit.
