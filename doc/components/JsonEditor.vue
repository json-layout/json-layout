<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { oneDark } from '@codemirror/theme-one-dark'
import { JsonEditor } from '@json-layout/code'

const props = defineProps({
  schema: { type: Object, required: true },
  initialData: { type: null, required: true },
  statefulLayoutOptions: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['update:text', 'update:data', 'ready'])

const host = ref(/** @type {HTMLElement | null} */(null))
/** @type {JsonEditor | null} */
let editor = null

onMounted(async () => {
  if (!host.value) return
  const ed = new JsonEditor(host.value, {
    schema: props.schema,
    data: props.initialData,
    statefulLayoutOptions: props.statefulLayoutOptions,
    theme: oneDark,
    onText: text => emit('update:text', text),
    onData: data => emit('update:data', data),
  })
  editor = ed
  await ed.whenReady
  // The component may have unmounted while the schema was compiling.
  if (editor) emit('ready', ed.statefulLayout)
})

onBeforeUnmount(() => {
  if (editor) {
    editor.destroy()
    editor = null
  }
})
</script>

<template>
  <div
    ref="host"
    class="jl-editor"
    data-testid="json-editor"
  />
</template>

<style scoped>
.jl-editor {
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 4px;
  min-height: 240px;
  font-family: 'Fira Code', 'Menlo', monospace;
  font-size: 13px;
}
.jl-editor :deep(.cm-editor) {
  min-height: 240px;
}
.jl-editor :deep(.cm-content) {
  padding: 8px 0;
}
</style>
