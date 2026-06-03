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
function debounce(fn, ms) {
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
function parseTab(key, text) {
  try {
    const value = JSON.parse(text)
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete parseErrors[key]
    return value
  }
  catch (/** @type {any} */err) {
    parseErrors[key] = err.message
    return undefined
  }
}

let lastBuiltSchemaText = /** @type {string | null} */(null)
let lastBuiltOptionsText = /** @type {string | null} */(null)

async function runRebuild() {
  if (
    schemaText.value === lastBuiltSchemaText
    && optionsText.value === lastBuiltOptionsText
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
  }
  catch (/** @type {any} */err) {
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

const scheduleRebuild = debounce(runRebuild, 300)
watch([schemaText, optionsText], scheduleRebuild)

const persist = debounce(() => {
  if (!schema.value) return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
    schema: schema.value,
    options: options.value,
    data: currentData.value,
  }))
}, 300)
watch([schema, options, currentData], persist)

/** @param {unknown} data */
function onUpdateData(data) {
  currentData.value = data
}

function bootstrapFromExample() {
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
    }
    catch {
      bootstrapFromExample()
    }
  }
  else {
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
