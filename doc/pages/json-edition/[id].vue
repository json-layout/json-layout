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
