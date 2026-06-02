# JSON edition free-form editor page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a free-form editor (playground) page to the `json-edition` doc section where Schema and Stateful-layout-options are editable JSON on the left and the live `@json-layout/code` assisted data editor renders on the right; each example gets an "Edit" button that seeds the playground.

**Architecture:** A new Nuxt page `pages/json-edition/editor.vue` orchestrates two editable CodeMirror inputs (a new reusable `CodeInput.vue`) for schema + options. On a debounced change it parses each input and validates the schema with `compile()` from `@json-layout/core`; on a clean compile it bumps a `:key` that remounts the existing `JsonEditor.vue` component, re-seeded with the live data so a schema edit never wipes the data. State persists to `localStorage['jl-editor-state']`; example pages write that key and navigate here.

**Tech Stack:** Nuxt 4, Vue 3 `<script setup>`, Vuetify 4, CodeMirror 6 (`@codemirror/*`), `@json-layout/code`, `@json-layout/core`. Source is plain JS with JSDoc; neostandard lint (no semicolons, 2-space indent).

---

## Testing note (read first)

The `doc/` workspace has **no Vue component / e2e test harness** (the repo's Playwright suite under `code/test-browser/` targets the `@json-layout/code` package via a separate Vite app, not the Nuxt doc app). Classic red-green TDD does not apply to these SFCs. The automated gate for each task is therefore **`npm run lint -w doc`**, a full **`npm run build -w doc`** at the end, and a **manual verification checklist** (final task). This deviation from TDD is intentional and matches how the rest of `doc/` is developed.

## File structure

- **Modify** `doc/package.json` — declare `@codemirror/lang-json` (already hoisted in root `node_modules`).
- **Create** `doc/components/CodeInput.vue` — reusable editable CodeMirror JSON editor (editable counterpart to `CodeBlock.vue`); text-only `v-model`.
- **Create** `doc/pages/json-edition/editor.vue` — playground orchestrator page.
- **Modify** `doc/pages/json-edition/[id].vue` — add an "Edit in playground" button.
- **Modify** `doc/layouts/edition.vue` — add an "Editor" nav item.
- **Modify** `doc/components/TopBar.vue` — add the `editor` breadcrumb label.

---

### Task 1: Declare the `@codemirror/lang-json` dependency

**Files:**
- Modify: `doc/package.json`

- [ ] **Step 1: Add the dependency**

In `doc/package.json`, add `@codemirror/lang-json` to `dependencies`, keeping the block alphabetically ordered (it goes right after `@codemirror/commands`):

```json
  "dependencies": {
    "@codemirror/commands": "^6.6.0",
    "@codemirror/lang-json": "^6.0.1",
    "@codemirror/theme-one-dark": "^6.1.3",
    "@json-layout/code": "*",
    "@json-layout/core": "*",
    "@mdi/font": "^7.4.47",
    "nuxt": "^4.2.2",
    "prism-themes": "^1.9.0",
    "prismjs": "^1.30.0",
    "vuetify": "^4.0.0",
    "vuetify-nuxt-module": "^0.19.5"
  },
```

- [ ] **Step 2: Install**

Run: `npm install`
Expected: completes without error; `package-lock.json` records `@codemirror/lang-json` under the `doc` workspace (no new download — it is already present transitively).

- [ ] **Step 3: Verify the import resolves**

Run: `node -e "import('@codemirror/lang-json').then(m => console.log(typeof m.json))"`
Expected: prints `function`.

- [ ] **Step 4: Commit**

```bash
git add doc/package.json package-lock.json
git commit -m "build(doc): declare @codemirror/lang-json dependency"
```

---

### Task 2: Create the reusable `CodeInput.vue` editor

**Files:**
- Create: `doc/components/CodeInput.vue`

- [ ] **Step 1: Write the component**

Create `doc/components/CodeInput.vue` with exactly this content. It mirrors the existing `JsonEditor.vue` lifecycle (mount in `onMounted`, destroy in `onBeforeUnmount`) but is a plain editable JSON buffer: `v-model` is the raw text string, and it reflects external changes back into the view without an update loop.

```vue
<script setup>
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { EditorView, lineNumbers, keymap } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { json } from '@codemirror/lang-json'
import { oneDark } from '@codemirror/theme-one-dark'

const props = defineProps({
  modelValue: { type: String, default: '' }
})

const emit = defineEmits(['update:modelValue'])

const host = ref(/** @type {HTMLElement | null} */(null))
/** @type {EditorView | null} */
let view = null

onMounted(() => {
  if (!host.value) return
  view = new EditorView({
    parent: host.value,
    state: EditorState.create({
      doc: props.modelValue,
      extensions: [
        lineNumbers(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        json(),
        oneDark,
        EditorView.updateListener.of((update) => {
          if (!update.docChanged) return
          const text = update.state.doc.toString()
          if (text !== props.modelValue) emit('update:modelValue', text)
        })
      ]
    })
  })
})

// Reflect external model changes (bootstrap, reset) into the editor without
// echoing them straight back out through the update listener.
watch(() => props.modelValue, (value) => {
  if (!view) return
  if (value === view.state.doc.toString()) return
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } })
})

onBeforeUnmount(() => {
  if (view) {
    view.destroy()
    view = null
  }
})
</script>

<template>
  <div
    ref="host"
    class="jl-code-input"
    data-testid="code-input"
  />
</template>

<style scoped>
.jl-code-input {
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 4px;
  min-height: 240px;
  font-family: 'Fira Code', 'Menlo', monospace;
  font-size: 13px;
}
.jl-code-input :deep(.cm-editor) {
  min-height: 240px;
}
.jl-code-input :deep(.cm-content) {
  padding: 8px 0;
}
</style>
```

- [ ] **Step 2: Lint**

Run: `npm run lint -w doc`
Expected: PASS, no errors for `components/CodeInput.vue`.

- [ ] **Step 3: Commit**

```bash
git add doc/components/CodeInput.vue
git commit -m "feat(doc): add editable CodeInput CodeMirror component"
```

---

### Task 3: Create the playground page `editor.vue`

**Files:**
- Create: `doc/pages/json-edition/editor.vue`

- [ ] **Step 1: Write the page**

Create `doc/pages/json-edition/editor.vue` with exactly this content. Notes on the design:
- `runRebuild` is the raw async build; `scheduleRebuild` is its debounced form, fired by the input watcher. `onMounted` awaits `runRebuild()` once for an immediate first mount; the dedupe guard (`lastBuiltSchemaText` / `lastBuiltOptionsText`, set only on a clean build) makes the debounced follow-up call a no-op so the editor is not remounted twice.
- The right editor is hidden whenever there is any parse or compile error (`errorText`), and `currentData` (held on the page) is preserved across remounts, so re-enabling it restores the user's data.
- `definePageMeta`, `useHead`, and `ClientOnly` are Nuxt auto-imports (used the same way in `[id].vue`).

```vue
<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { compile } from '@json-layout/core'
import examples from '~/examples/index.js'

definePageMeta({ layout: 'edition' })
useHead({ title: 'JSON Layout — Editor' })

const STORAGE_KEY = 'jl-editor-state'

const tab = ref('schema')
const schemaText = ref('{}')
const optionsText = ref('{}')

// Last good parsed inputs handed to the right editor.
const schema = ref(/** @type {object | null} */(null))
const options = ref(/** @type {object} */({}))
// Live data held by the assisted editor; seeded at load, preserved on remount.
const currentData = ref(/** @type {unknown} */(null))

const editorKey = ref(0)

/** @type {Record<string, string>} */
const parseErrors = reactive({})
const schemaError = ref('')

const errorText = computed(() => {
  const parts = []
  for (const [key, message] of Object.entries(parseErrors)) parts.push(`${key}: ${message}`)
  if (schemaError.value) parts.push(schemaError.value)
  return parts.join('\n')
})

/**
 * Minimal setTimeout debounce (@vueuse/core is not a dependency of doc/).
 * @template {(...args: any[]) => void} F
 * @param {F} fn
 * @param {number} ms
 * @returns {(...args: Parameters<F>) => void}
 */
function debounce (fn, ms) {
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timer
  return (...args) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }
}

/**
 * @param {string} key
 * @param {string} text
 * @returns {any} parsed value, or undefined when the text is not valid JSON
 */
function parseTab (key, text) {
  try {
    const value = JSON.parse(text)
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete parseErrors[key]
    return value
  } catch (/** @type {any} */err) {
    parseErrors[key] = err.message
    return undefined
  }
}

let lastBuiltSchemaText = /** @type {string | null} */(null)
let lastBuiltOptionsText = /** @type {string | null} */(null)

async function runRebuild () {
  if (
    schemaText.value === lastBuiltSchemaText &&
    optionsText.value === lastBuiltOptionsText
  ) return

  const parsedSchema = parseTab('schema', schemaText.value)
  const parsedOptions = parseTab('options', optionsText.value)
  if (parsedSchema === undefined || parsedOptions === undefined) return

  try {
    const compiled = await compile(parsedSchema)
    const validationErrors = compiled.validationErrors
    if (validationErrors && Object.keys(validationErrors).length) {
      schemaError.value = JSON.stringify(validationErrors, null, 2)
      return
    }
  } catch (/** @type {any} */err) {
    schemaError.value = err.message
    return
  }

  schemaError.value = ''
  schema.value = parsedSchema
  options.value = parsedOptions
  lastBuiltSchemaText = schemaText.value
  lastBuiltOptionsText = optionsText.value
  editorKey.value++
}

const scheduleRebuild = debounce(() => { void runRebuild() }, 300)
watch([schemaText, optionsText], scheduleRebuild)

const persist = debounce(() => {
  if (!schema.value) return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
    schema: schema.value,
    options: options.value,
    data: currentData.value
  }))
}, 300)
watch([schema, options, currentData], persist)

/** @param {unknown} data */
function onUpdateData (data) {
  currentData.value = data
}

function bootstrapFromExample () {
  const example = examples[0]
  schemaText.value = JSON.stringify(example.schema, null, 2)
  optionsText.value = JSON.stringify(example.statefulLayoutOptions ?? {}, null, 2)
  currentData.value = example.initialData ?? null
}

onMounted(async () => {
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored) {
    try {
      const state = JSON.parse(stored)
      schemaText.value = JSON.stringify(state.schema ?? {}, null, 2)
      optionsText.value = JSON.stringify(state.options ?? {}, null, 2)
      currentData.value = state.data ?? null
    } catch {
      bootstrapFromExample()
    }
  } else {
    bootstrapFromExample()
  }
  await runRebuild()
})
</script>

<template>
  <v-row>
    <v-col
      cols="12"
      md="6"
    >
      <v-tabs
        v-model="tab"
        density="compact"
      >
        <v-tab value="schema">
          Schema
        </v-tab>
        <v-tab value="options">
          Options
        </v-tab>
      </v-tabs>
      <v-window v-model="tab">
        <v-window-item value="schema">
          <CodeInput
            v-model="schemaText"
            data-testid="schema-input"
          />
        </v-window-item>
        <v-window-item value="options">
          <CodeInput
            v-model="optionsText"
            data-testid="options-input"
          />
        </v-window-item>
      </v-window>

      <v-alert
        v-if="errorText"
        type="error"
        variant="tonal"
        class="mt-3"
        data-testid="editor-errors"
      >
        <pre class="text-caption mb-0">{{ errorText }}</pre>
      </v-alert>
    </v-col>

    <v-col
      cols="12"
      md="6"
    >
      <ClientOnly>
        <JsonEditor
          v-if="schema && !errorText"
          :key="editorKey"
          :schema="schema"
          :initial-data="currentData"
          :stateful-layout-options="options"
          @update:data="onUpdateData"
        />
        <template #fallback>
          <div data-testid="editor-loading">
            Loading editor…
          </div>
        </template>
      </ClientOnly>
    </v-col>
  </v-row>
</template>
```

- [ ] **Step 2: Lint**

Run: `npm run lint -w doc`
Expected: PASS, no errors for `pages/json-edition/editor.vue`.

- [ ] **Step 3: Commit**

```bash
git add doc/pages/json-edition/editor.vue
git commit -m "feat(doc): add json-edition free-form editor playground page"
```

---

### Task 4: Add the "Edit in playground" button to example pages

**Files:**
- Modify: `doc/pages/json-edition/[id].vue`

- [ ] **Step 1: Import the router in the script block**

In `doc/pages/json-edition/[id].vue`, the script already does `import { useRoute } from 'vue-router'`. Change that line to also import `useRouter`:

```js
import { useRoute, useRouter } from 'vue-router'
```

- [ ] **Step 2: Add the router instance and the handler**

Immediately after the existing `const route = useRoute()` line, add:

```js
const router = useRouter()

function editInPlayground () {
  window.localStorage.setItem('jl-editor-state', JSON.stringify({
    schema: example.schema,
    options: example.statefulLayoutOptions ?? {},
    data: example.initialData
  }))
  router.push('/json-edition/editor')
}
```

- [ ] **Step 3: Add the button to the template**

In the template, the title column currently is:

```vue
    <v-col cols="12">
      <h2 class="text-h5 mb-2">
        {{ example.title }}
      </h2>
      <ul class="mb-4">
```

Insert the button between the `</h2>` and the `<ul>`:

```vue
    <v-col cols="12">
      <h2 class="text-h5 mb-2">
        {{ example.title }}
      </h2>
      <v-btn
        color="primary"
        variant="tonal"
        size="small"
        prepend-icon="mdi-pencil"
        class="mb-4"
        data-testid="edit-example"
        @click="editInPlayground"
      >
        Edit in playground
      </v-btn>
      <ul class="mb-4">
```

- [ ] **Step 4: Lint**

Run: `npm run lint -w doc`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add doc/pages/json-edition/\[id\].vue
git commit -m "feat(doc): add Edit-in-playground button to example pages"
```

---

### Task 5: Add the "Editor" nav item and breadcrumb label

**Files:**
- Modify: `doc/layouts/edition.vue`
- Modify: `doc/components/TopBar.vue`

- [ ] **Step 1: Add the nav item in the layout**

In `doc/layouts/edition.vue`, the list currently starts:

```vue
      <v-list nav density="compact">
        <v-list-item to="/json-edition" title="Overview" prepend-icon="mdi-book-open-variant" />
        <v-list-subheader>Examples</v-list-subheader>
```

Insert the Editor item between the Overview item and the subheader:

```vue
      <v-list nav density="compact">
        <v-list-item to="/json-edition" title="Overview" prepend-icon="mdi-book-open-variant" />
        <v-list-item to="/json-edition/editor" title="Editor" prepend-icon="mdi-pencil-box-outline" data-testid="nav-editor" />
        <v-list-subheader>Examples</v-list-subheader>
```

- [ ] **Step 2: Add the breadcrumb label**

In `doc/components/TopBar.vue`, the labels map is:

```js
const labels = {
  'vocabulary': 'Vocabulary & API',
  'webmcp': 'WebMCP tools',
  'json-edition': 'JSON edition',
}
```

Add an `editor` entry:

```js
const labels = {
  'vocabulary': 'Vocabulary & API',
  'webmcp': 'WebMCP tools',
  'json-edition': 'JSON edition',
  'editor': 'Editor',
}
```

- [ ] **Step 3: Lint**

Run: `npm run lint -w doc`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add doc/layouts/edition.vue doc/components/TopBar.vue
git commit -m "feat(doc): link the json-edition editor in nav and breadcrumbs"
```

---

### Task 6: Build and manual verification

**Files:** none (verification only)

- [ ] **Step 1: Ensure workspace packages are built**

The doc app imports `@json-layout/code` and `@json-layout/core`, which must be built first.

Run: `npm run build`
Expected: vocabulary → core → code → examples all build with no error.

- [ ] **Step 2: Build the doc app**

Run: `npm run build -w doc`
Expected: `nuxt build` completes with no type/compile errors (the new page and component compile).

- [ ] **Step 3: Run the dev server**

Run: `npm run dev -w doc`
Expected: server starts on `http://localhost:3134`.

- [ ] **Step 4: Manual checklist**

In the browser, confirm each:
1. `/json-edition/editor` loads bootstrapped from the first example; the assisted editor shows on the right with the example's data, and the breadcrumb reads "Home / JSON edition / Editor".
2. The sidebar has an "Editor" item that routes to `/json-edition/editor`.
3. Editing the Schema tab (e.g. add a property) rebuilds the right editor (~300ms) and the new property's completion/hover works; the data already typed is **not** wiped.
4. Typing invalid JSON in the Schema or Options tab shows the red error panel and hides the right editor; fixing it restores the editor with the data intact.
5. Opening an example page (e.g. `/json-edition/basic`) shows an "Edit in playground" button; clicking it lands on `/json-edition/editor` seeded with that example's schema/options/data.
6. Reload `/json-edition/editor` — the schema/options/data persist (localStorage).

- [ ] **Step 5: Stop the dev server** (Ctrl+C).

- [ ] **Step 6: Final quality gate**

Run: `npm run quality`
Expected: lint + build + test all PASS (this is the pre-commit gate; confirms nothing else regressed).

---

## Self-review

- **Spec coverage:** CodeInput (Task 2) ✓; editor.vue with Schema+Options tabs, debounced compile/validate, remount-with-preserved-data, localStorage persist, error panel (Task 3) ✓; Edit button on examples (Task 4) ✓; sidebar nav + breadcrumb label (Task 5) ✓; `@codemirror/lang-json` dep (Task 1) ✓; JSON-only / no Inspector / no separate data tab — honored by omission ✓; testing = lint + build + manual (Task 6) ✓.
- **Type/name consistency:** `jl-editor-state` localStorage key identical in `editor.vue` and `[id].vue`; `currentData`/`schema`/`options`/`editorKey`/`runRebuild`/`scheduleRebuild` used consistently; `JsonEditor` props (`schema`, `initial-data`, `stateful-layout-options`, `@update:data`) match `components/JsonEditor.vue`'s `defineProps`/`defineEmits`.
- **Placeholders:** none — every code step is complete.
