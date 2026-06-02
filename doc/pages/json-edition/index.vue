<script setup>
definePageMeta({ layout: 'edition' })

useHead({ title: 'JSON Layout — JSON edition' })

const installExample = 'npm install @json-layout/code'

const editorExample = `import { JsonEditor } from '@json-layout/code'

const editor = new JsonEditor(host, {
  schema: {
    type: 'object',
    properties: { name: { type: 'string', title: 'Name' } }
  },
  data: { name: 'Alice' },          // optional initial data
  statefulLayoutOptions: {},        // e.g. { context: {...} } for expressions
  onText: (text) => { /* every doc change */ },
  onData: (data) => { /* resolved data after each committed sync */ }
})

await editor.whenReady
editor.statefulLayout            // the live StatefulLayout instance
editor.data                      // current resolved data
editor.diagnostics()             // active lint diagnostics
editor.destroy()                 // tear down the CodeMirror view`
</script>

<template>
  <div class="mx-auto" style="max-width: 820px;">
    <h1 class="text-h4 mb-4">
      JSON edition
    </h1>

    <p class="text-body-1 mb-6">
      <code>@json-layout/code</code> turns a JSON Schema (annotated with the
      <code>layout</code> keyword) into a schema-assisted editing experience in
      <a
        href="https://codemirror.net/"
        target="_blank"
        rel="noopener"
      >CodeMirror 6</a>. Completion, hover help, and diagnostics all flow from a
      single compiled layout, while a <code>StatefulLayout</code> is kept in step
      with the buffer so you always have resolved, validated data on hand.
    </p>

    <h2 class="text-h6 mb-2">
      Install
    </h2>
    <CodeBlock
      language="bash"
      :code="installExample"
    />

    <h2 class="text-h6 mb-2">
      The <code>JsonEditor</code> class
    </h2>
    <p class="text-body-1 mb-2">
      The high-level entry point mounts a ready-to-use editor into a host
      element. Pass a schema and (optionally) initial data; the editor compiles
      the layout, builds the CodeMirror extensions, and calls your callbacks as
      the document changes. Compilation is asynchronous, so await
      <code>whenReady</code> before reaching for <code>statefulLayout</code>.
    </p>

    <CodeBlock
      language="javascript"
      :code="editorExample"
    />

    <h2 class="text-h6 mb-2">
      Composable extensions
    </h2>
    <p class="text-body-1 mb-6">
      If you manage your own <code>EditorView</code>, the building blocks are
      exported individually — <code>jsonLayoutExtensions</code>,
      <code>jsonLayoutCompletion</code>, <code>jsonLayoutHover</code>,
      <code>jsonLayoutLinter</code>, the <code>compiledLayoutField</code> /
      <code>statefulLayoutField</code> state fields, plus JSON helpers like
      <code>parse</code>, <code>scaffold</code> and <code>insertProperty</code> —
      so you can assemble only the features you need.
    </p>

    <p class="text-body-1 mb-6">
      Source:
      <a
        href="https://github.com/json-layout/json-layout/blob/main/code/src/editor/json-editor.js"
        target="_blank"
        rel="noopener"
      >JsonEditor</a>,
      <a
        href="https://github.com/json-layout/json-layout/tree/main/code/src"
        target="_blank"
        rel="noopener"
      ><code>@json-layout/code</code> sources</a>.
    </p>

    <v-alert
      type="info"
      variant="tonal"
      class="mb-4"
    >
      Pick an example from the sidebar to see the editor in action — each one
      pairs a live editor with an inspector showing the resolved data and state.
    </v-alert>
  </div>
</template>
