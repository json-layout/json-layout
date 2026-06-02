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
