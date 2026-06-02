<script setup>
useHead({ title: 'JSON Layout — Vocabulary & API' })

const compileExample = `import { compile, StatefulLayout } from '@json-layout/core'

// compile builds Ajv validators, compiles markdown and expressions, then
// returns a layout you can evaluate at runtime or serialize at build time
const compiled = compile({
  type: 'object',
  properties: { name: { type: 'string', title: 'Name' } }
})`

const statefulLayoutExample = `const layout = new StatefulLayout(
  compiled,
  compiled.skeletonTrees[compiled.mainTree],
  {
    onUpdate: (sl) => { /* sl.stateTree — the rendered component tree */ },
    onData: (data) => { /* data — the current valid data */ }
  },
  { name: 'Alice' } // initial data
)`
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
    <p class="text-body-1 mb-6">
      Source:
      <a
        href="https://github.com/json-layout/json-layout/blob/main/vocabulary/src/layout-keyword/schema.json"
        target="_blank"
        rel="noopener"
      >layout keyword schema</a>,
      <a
        href="https://github.com/json-layout/json-layout/blob/main/vocabulary/src/normalized-layout/schema.json"
        target="_blank"
        rel="noopener"
      >normalized layout schema</a>,
      <a
        href="https://github.com/json-layout/json-layout/blob/main/vocabulary/src/components/index.js"
        target="_blank"
        rel="noopener"
      >standard components list</a>.
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

    <CodeBlock
      language="javascript"
      :code="compileExample"
    />

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

    <CodeBlock
      language="javascript"
      :code="statefulLayoutExample"
    />

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
