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
