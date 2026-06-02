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
