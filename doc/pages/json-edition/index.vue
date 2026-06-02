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
