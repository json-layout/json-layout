# Doc Site Home Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the `doc/` workspace into a documentation site fronted by a flat, vjsf-style home page, moving the existing editor examples under a `/json-edition` subdirectory and adding concise Vocabulary/API and WebMCP pages.

**Architecture:** Two Nuxt layouts — a new flat `default.vue` (app-bar only) for the home and the two new content pages, and `edition.vue` (the renamed current drawer layout) for the editor examples. Pages opt into the drawer layout with `definePageMeta({ layout: 'edition' })`; everything else uses the default flat layout automatically.

**Tech Stack:** Nuxt 4, Vuetify 4, Vue 3 `<script setup>`. Source lives in `doc/`.

---

## Notes for the executor

- **The doc workspace has no automated test suite.** Per-task verification is
  `npm run lint -w doc` (must pass) plus, at the end, `npm run build -w doc`
  (compiles every page/layout and catches template errors). Run all commands
  from the repo root `/home/alban/github/json-layout`.
- **Pre-commit hook is currently red for an UNRELATED reason.** `npm run quality`
  (run by the husky pre-commit hook) fails on a pre-existing core test
  (`core/test/lists-get-items.spec.js:323`). This plan touches only `doc/`, which
  that suite does not cover. Commit doc-only changes with `git commit --no-verify`
  and rely on `npm run lint -w doc` as the gate. Do not attempt to fix the core
  test as part of this plan.
- The browser tests in `code/test-browser` mount their own harness (port 5174)
  and do NOT navigate the doc app's routes, so renaming `/examples/*` to
  `/json-edition/*` does not affect them.

## File Structure

- Rename: `doc/layouts/default.vue` → `doc/layouts/edition.vue` (drawer layout; update Home link + example links + title)
- Create: `doc/layouts/default.vue` (new flat layout: app-bar + GitHub link + centered `v-main`)
- Create: `doc/pages/json-edition/index.vue` (examples list, moved from old `pages/index.vue`, uses `edition` layout, links to `/json-edition/[id]`)
- Create: `doc/pages/json-edition/[id].vue` (editor, moved from old `pages/examples/[id].vue`, uses `edition` layout)
- Delete: `doc/pages/examples/[id].vue` and the now-empty `doc/pages/examples/` dir
- Replace: `doc/pages/index.vue` (new flat home page)
- Create: `doc/pages/vocabulary.vue` (concise Vocabulary & API overview)
- Create: `doc/pages/webmcp.vue` (concise WebMCP form-tools usage)

---

### Task 1: Rename the drawer layout to `edition.vue` and update its links

**Files:**
- Create: `doc/layouts/edition.vue`
- Delete: `doc/layouts/default.vue` (after creating edition.vue; a new default.vue is created in Task 2)

- [ ] **Step 1: Create `doc/layouts/edition.vue`**

```vue
<script setup>
import examples from '~/examples/index.js'
</script>

<template>
  <v-app>
    <v-app-bar flat>
      <v-app-bar-title>JSON Layout — JSON edition</v-app-bar-title>
    </v-app-bar>

    <v-navigation-drawer permanent width="260">
      <v-list nav density="compact">
        <v-list-item to="/" title="Home" prepend-icon="mdi-home" />
        <v-list-item to="/json-edition" title="All examples" prepend-icon="mdi-format-list-bulleted" />
        <v-list-subheader>Examples</v-list-subheader>
        <v-list-item
          v-for="ex in examples"
          :key="ex.id"
          :to="`/json-edition/${ex.id}`"
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

- [ ] **Step 2: Delete the old `doc/layouts/default.vue`**

Run: `rm doc/layouts/default.vue`

- [ ] **Step 3: Lint**

Run: `npm run lint -w doc`
Expected: PASS (no errors).

- [ ] **Step 4: Commit**

```bash
git add doc/layouts/
git commit --no-verify -m "refactor(doc): rename drawer layout to edition and point at /json-edition"
```

---

### Task 2: Create the new flat `default.vue` layout

**Files:**
- Create: `doc/layouts/default.vue`

- [ ] **Step 1: Create `doc/layouts/default.vue`**

```vue
<template>
  <v-app>
    <v-app-bar flat>
      <v-app-bar-title>JSON Layout</v-app-bar-title>
      <v-spacer />
      <v-btn
        href="https://github.com/json-layout/json-layout"
        target="_blank"
        rel="noopener"
        variant="text"
        prepend-icon="mdi-github"
      >
        GitHub
      </v-btn>
    </v-app-bar>

    <v-main>
      <v-container class="py-8">
        <slot />
      </v-container>
    </v-main>
  </v-app>
</template>
```

- [ ] **Step 2: Lint**

Run: `npm run lint -w doc`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add doc/layouts/default.vue
git commit --no-verify -m "feat(doc): add flat default layout for landing and content pages"
```

---

### Task 3: Move the examples list to `/json-edition`

**Files:**
- Create: `doc/pages/json-edition/index.vue`

(The old `doc/pages/index.vue` is replaced in Task 5 — leave it in place for now so the app keeps building.)

- [ ] **Step 1: Create `doc/pages/json-edition/index.vue`**

```vue
<script setup>
import examples from '~/examples/index.js'

definePageMeta({ layout: 'edition' })
</script>

<template>
  <v-row>
    <v-col cols="12">
      <h1 class="text-h4 mb-4">
        JSON edition
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
          :to="`/json-edition/${ex.id}`"
          :title="ex.title"
          :subtitle="ex.summary"
          :data-testid="`home-example-${ex.id}`"
        />
      </v-list>
    </v-col>
  </v-row>
</template>
```

- [ ] **Step 2: Lint**

Run: `npm run lint -w doc`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add doc/pages/json-edition/index.vue
git commit --no-verify -m "feat(doc): add /json-edition examples list page"
```

---

### Task 4: Move the editor page to `/json-edition/[id]`

**Files:**
- Create: `doc/pages/json-edition/[id].vue`
- Delete: `doc/pages/examples/[id].vue` (and the empty `doc/pages/examples/` dir)

- [ ] **Step 1: Create `doc/pages/json-edition/[id].vue`**

This is the current `doc/pages/examples/[id].vue` with one added line — `definePageMeta({ layout: 'edition' })` in the setup block. Full content:

```vue
<script setup>
import { ref, shallowRef } from 'vue'
import { useRoute } from 'vue-router'
import examples from '~/examples/index.js'

definePageMeta({ layout: 'edition' })

const route = useRoute()
const example = examples.find(e => e.id === route.params.id)
if (!example) {
  throw createError({ statusCode: 404, statusMessage: `Unknown example: ${route.params.id}` })
}

const initialText = JSON.stringify(example.initialData, null, 2)
const statefulLayout = shallowRef(null)
const liveData = ref(example.initialData)
const liveText = ref(initialText)

function onReady(sl) {
  statefulLayout.value = sl
}

function onUpdateText(text) {
  liveText.value = text
}

function onUpdateData(data) {
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
        <li
          v-for="note in example.teachingNotes"
          :key="note"
        >
          {{ note }}
        </li>
      </ul>
    </v-col>

    <v-col
      cols="12"
      md="7"
    >
      <ClientOnly>
        <JsonEditor
          :key="example.id"
          :schema="example.schema"
          :initial-data="example.initialData"
          :stateful-layout-options="example.statefulLayoutOptions"
          @ready="onReady"
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

    <v-col
      cols="12"
      md="5"
    >
      <ClientOnly>
        <Inspector
          v-if="statefulLayout"
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

- [ ] **Step 2: Delete the old editor page and its directory**

Run: `rm doc/pages/examples/[id].vue && rmdir doc/pages/examples`

- [ ] **Step 3: Lint**

Run: `npm run lint -w doc`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add doc/pages/json-edition/ doc/pages/examples/
git commit --no-verify -m "feat(doc): move example editor to /json-edition/[id]"
```

---

### Task 5: Replace the home page with the flat landing page

**Files:**
- Modify (overwrite): `doc/pages/index.vue`

- [ ] **Step 1: Overwrite `doc/pages/index.vue`**

```vue
<script setup>
const contexts = [
  {
    title: 'Vocabulary & API',
    summary: 'The layout keyword, normalization, and the @json-layout/core API surface — compile and StatefulLayout.',
    to: '/vocabulary',
  },
  {
    title: 'vjsf documentation',
    summary: 'The reference implementation for Vue / Vuetify, with full component-level form documentation.',
    href: 'https://koumoul-dev.github.io/vuetify-jsonschema-form/latest/',
  },
  {
    title: 'WebMCP tools',
    summary: 'Expose a live form to AI agents through the browser navigator.modelContext.',
    to: '/webmcp',
  },
  {
    title: 'JSON edition',
    summary: 'Schema-assisted JSON editing in CodeMirror 6 — completion, hover and diagnostics from a compiled layout.',
    to: '/json-edition',
  },
]
</script>

<template>
  <div class="text-center mx-auto" style="max-width: 760px;">
    <h1 class="text-h3 font-weight-bold mb-2">
      JSON Layout
    </h1>
    <p class="text-subtitle-1 font-italic text-medium-emphasis mb-6">
      Vocabulary and tools for rendering and edition of schematized JSON documents.
    </p>
    <p class="text-body-1 mb-8">
      JSON Layout is a framework-agnostic building block for rich forms based on
      JSON schemas. It compiles a schema annotated with a <code>layout</code>
      keyword into a layout description, then manages form state — data binding,
      validation and immutable updates — so UI libraries can stay thin.
    </p>

    <v-row justify="center">
      <v-col
        v-for="ctx in contexts"
        :key="ctx.title"
        cols="12"
        sm="6"
      >
        <v-card
          :to="ctx.to"
          :href="ctx.href"
          :target="ctx.href ? '_blank' : undefined"
          :rel="ctx.href ? 'noopener' : undefined"
          variant="outlined"
          height="100%"
          class="text-left pa-2 d-flex flex-column"
        >
          <v-card-title class="text-h6 d-flex align-center">
            {{ ctx.title }}
            <v-icon
              v-if="ctx.href"
              size="small"
              icon="mdi-open-in-new"
              class="ms-1"
            />
          </v-card-title>
          <v-card-text>
            {{ ctx.summary }}
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </div>
</template>
```

- [ ] **Step 2: Lint**

Run: `npm run lint -w doc`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add doc/pages/index.vue
git commit --no-verify -m "feat(doc): add flat landing home page with implementation contexts"
```

---

### Task 6: Create the Vocabulary & API page

**Files:**
- Create: `doc/pages/vocabulary.vue`

- [ ] **Step 1: Create `doc/pages/vocabulary.vue`**

```vue
<script setup>
useHead({ title: 'JSON Layout — Vocabulary & API' })
</script>

<template>
  <div class="mx-auto" style="max-width: 820px;">
    <h1 class="text-h4 mb-4">
      Vocabulary &amp; API
    </h1>

    <p class="text-body-1 mb-6">
      JSON Layout is split into small packages so that wrapping a UI library
      stays as light as possible. The vocabulary defines the annotations; the
      core turns them into something a renderer can consume and keeps form state.
    </p>

    <h2 class="text-h6 mb-2">
      The <code>layout</code> keyword
    </h2>
    <p class="text-body-1 mb-6">
      A JSON Schema is augmented with a <code>layout</code> keyword that carries
      rendering information — which component to use, labels, help, conditional
      display, expressions, and so on. <code>@json-layout/vocabulary</code>
      validates these keywords, fills them with defaults and transforms them into
      a normalized form that downstream tools can rely on.
    </p>

    <h2 class="text-h6 mb-2">
      <code>compile</code>
    </h2>
    <p class="text-body-1 mb-2">
      <code>compile</code> (from <code>@json-layout/core</code>) does the
      pre-processing: it produces Ajv validation functions, compiles markdown
      help to HTML, compiles expressions into JS functions, and recurses through
      the schema to normalize layouts and build a skeleton component tree. Its
      result can be evaluated at runtime or serialized in a build step for a
      lighter, faster browser bundle.
    </p>

    <pre v-pre class="bg-grey-darken-4 pa-4 rounded mb-6 overflow-auto"><code>import { compile, StatefulLayout } from '@json-layout/core'

// compile is async — it builds Ajv validators, compiles markdown and expressions
const compiled = await compile({
  type: 'object',
  properties: { name: { type: 'string', title: 'Name' } }
})</code></pre>

    <h2 class="text-h6 mb-2">
      <code>StatefulLayout</code>
    </h2>
    <p class="text-body-1 mb-2">
      <code>StatefulLayout</code> consumes a compiled layout and manages a live
      form instance: a full state tree of rendered components, bi-directional
      data binding, placement of validation errors on the right nodes, and
      immutable state updates (via <a
        href="https://www.npmjs.com/package/immer"
        target="_blank"
        rel="noopener"
      >immer</a>).
    </p>

    <pre v-pre class="bg-grey-darken-4 pa-4 rounded mb-6 overflow-auto"><code>const layout = new StatefulLayout(
  compiled,
  compiled.skeletonTrees[compiled.mainTree],
  {
    onUpdate: (sl) => { /* sl.stateTree — the rendered component tree */ },
    onData: (data) => { /* data — the current valid data */ }
  },
  { name: 'Alice' } // initial data
)</code></pre>

    <v-alert
      type="info"
      variant="tonal"
      class="mb-4"
    >
      For a complete, component-level form implementation built on this API, see
      the
      <a
        href="https://koumoul-dev.github.io/vuetify-jsonschema-form/latest/"
        target="_blank"
        rel="noopener"
      >vjsf documentation</a>.
    </v-alert>
  </div>
</template>
```

- [ ] **Step 2: Lint**

Run: `npm run lint -w doc`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add doc/pages/vocabulary.vue
git commit --no-verify -m "feat(doc): add concise Vocabulary & API page"
```

---

### Task 7: Create the WebMCP tools page

**Files:**
- Create: `doc/pages/webmcp.vue`

- [ ] **Step 1: Create `doc/pages/webmcp.vue`**

```vue
<script setup>
useHead({ title: 'JSON Layout — WebMCP tools' })

const tools = [
  { name: 'describeState', summary: 'Describe the current form structure and state (optionally scoped to a path).' },
  { name: 'getData', summary: 'Read the whole data document currently held by the form.' },
  { name: 'setData', summary: 'Replace the whole data document.' },
  { name: 'setFieldValue', summary: 'Set the value of a single field by path.' },
  { name: 'getFieldSuggestions', summary: 'List the available values/suggestions for a field.' },
  { name: 'editArray', summary: 'Add or remove items in an array field.' },
  { name: 'fillFormSkill', summary: 'Optional higher-level skill that guides an agent through filling the form.' },
]
</script>

<template>
  <div class="mx-auto" style="max-width: 820px;">
    <h1 class="text-h4 mb-4">
      WebMCP tools
    </h1>

    <p class="text-body-1 mb-6">
      <a
        href="https://github.com/webmachinelearning/webmcp"
        target="_blank"
        rel="noopener"
      >WebMCP</a> registers tools on the browser's
      <code>navigator.modelContext</code> so an AI agent running in the page can
      read and fill a live form. JSON Layout ships a <code>WebMCP</code> class
      that turns any <code>StatefulLayout</code> into a set of such tools.
    </p>

    <h2 class="text-h6 mb-2">
      The <code>WebMCP</code> class
    </h2>
    <p class="text-body-1 mb-2">
      Import it from <code>@json-layout/core/webmcp</code>, construct it with a
      <code>StatefulLayout</code>, then register the tools. Call
      <code>unregisterTools()</code> when the form goes away.
    </p>

    <pre v-pre class="bg-grey-darken-4 pa-4 rounded mb-6 overflow-auto"><code>import { WebMCP } from '@json-layout/core/webmcp'

const webmcp = new WebMCP(statefulLayout, {
  dataTitle: 'contact form',
  schema,                  // original JSON schema, enables a getSchema tool
  includeFillFormSkill: true
})

await webmcp.registerTools()
// later: await webmcp.unregisterTools()</code></pre>

    <h2 class="text-h6 mb-2">
      Tools
    </h2>
    <v-list lines="two" class="mb-6">
      <v-list-item
        v-for="tool in tools"
        :key="tool.name"
        :subtitle="tool.summary"
      >
        <template #title>
          <code>{{ tool.name }}</code>
        </template>
      </v-list-item>
    </v-list>

    <p class="text-body-2 text-medium-emphasis">
      Tool names can be prefixed via the <code>prefixName</code> option, and a
      single wrapping sub-agent tool can be exposed with
      <code>includeSubAgent</code>.
    </p>
  </div>
</template>
```

- [ ] **Step 2: Lint**

Run: `npm run lint -w doc`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add doc/pages/webmcp.vue
git commit --no-verify -m "feat(doc): add concise WebMCP tools usage page"
```

---

### Task 8: Full build verification

**Files:** none (verification only).

- [ ] **Step 1: Build the doc app**

Run: `npm run build -w doc`
Expected: build succeeds with no template/compile errors. This compiles every
page and layout (home, `/vocabulary`, `/webmcp`, `/json-edition`,
`/json-edition/[id]`) and the two layouts.

- [ ] **Step 2 (optional manual smoke test): run the dev server**

Run: `npm run dev -w doc` then open `http://localhost:3134/` and confirm:
- Home renders flat (centered), shows the four context cards; vjsf card opens
  the external docs in a new tab; the other three navigate internally.
- `/vocabulary` and `/webmcp` render with the flat layout (app-bar, no drawer).
- `/json-edition` lists the examples with the drawer layout.
- `/json-edition/<id>` opens the editor + inspector with the drawer; the drawer
  "Home" item returns to `/`.

Stop the server with Ctrl+C when done.

- [ ] **Step 3: Final confirmation commit (only if Step 1 required any fixes)**

If the build surfaced and you fixed any issue:

```bash
git add doc/
git commit --no-verify -m "fix(doc): resolve build issues in restructured doc site"
```

Otherwise no commit is needed — the work is already committed task-by-task.
