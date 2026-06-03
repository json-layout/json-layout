<script setup>
import { ref, shallowRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import examples from '~/examples/index.js'

definePageMeta({ layout: 'edition' })

const route = useRoute()
const router = useRouter()
const example = examples.find(e => e.id === route.params.id)
if (!example) {
  throw createError({ statusCode: 404, statusMessage: `Unknown example: ${route.params.id}` })
}

const initialText = JSON.stringify(example.initialData, null, 2)
const schemaPretty = JSON.stringify(example.schema, null, 2)
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

function editInPlayground() {
  window.localStorage.setItem('jl-editor-state', JSON.stringify({
    schema: example.schema,
    options: example.statefulLayoutOptions ?? {},
    data: example.initialData,
  }))
  router.push('/json-edition/editor')
}
</script>

<template>
  <v-row>
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
      <v-expansion-panels
        class="mb-3"
        data-testid="example-schema"
      >
        <v-expansion-panel title="Input schema">
          <template #text>
            <CodeBlock
              language="json"
              :code="schemaPretty"
            />
          </template>
        </v-expansion-panel>
      </v-expansion-panels>

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

<style scoped>
/* Let the schema code block fill the expansion panel body flush, instead of
   sitting as a padded box inside the panel's own padded box. */
[data-testid="example-schema"] :deep(.v-expansion-panel-text__wrapper) {
  padding: 0;
}
[data-testid="example-schema"] :deep(.code-block) {
  margin-bottom: 0;
  border-radius: 0;
}
</style>
