<script setup>
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { EditorView, lineNumbers, keymap } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { lintGutter } from '@codemirror/lint'
import { oneDark } from '@codemirror/theme-one-dark'
import { jsonLayoutExtensions } from '@json-layout/code'

const props = defineProps({
  compiledLayout: { type: Object, required: true },
  statefulLayout: { type: Object, required: true },
  initialText: { type: String, required: true }
})

const emit = defineEmits(['update:text', 'update:data'])

const host = ref(/** @type {HTMLElement | null} */(null))
/** @type {EditorView | null} */
let view = null
/** @type {ReturnType<typeof setInterval> | null} */
let dataPoll = null
let lastDataSnapshot = /** @type {string} */(JSON.stringify(props.statefulLayout.data))

function startDataPolling () {
  dataPoll = setInterval(() => {
    const current = JSON.stringify(props.statefulLayout.data)
    if (current !== lastDataSnapshot) {
      lastDataSnapshot = current
      emit('update:data', props.statefulLayout.data)
    }
  }, 120)
}

function stopDataPolling () {
  if (dataPoll !== null) {
    clearInterval(dataPoll)
    dataPoll = null
  }
}

onMounted(() => {
  if (!host.value) return
  view = new EditorView({
    parent: host.value,
    state: EditorState.create({
      doc: props.initialText,
      extensions: [
        oneDark,
        lineNumbers(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        lintGutter(),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) emit('update:text', update.state.doc.toString())
        }),
        ...jsonLayoutExtensions(props.compiledLayout, { statefulLayout: props.statefulLayout })
      ]
    })
  })
  startDataPolling()
})

onBeforeUnmount(() => {
  stopDataPolling()
  if (view) {
    view.destroy()
    view = null
  }
})

// Swapping the example rebuilds the editor. Simplest path: force remount via
// :key on the parent (Task 7). This watcher is a belt-and-braces reset in case
// the parent forgets to remount.
watch(() => props.statefulLayout, () => {
  lastDataSnapshot = JSON.stringify(props.statefulLayout.data)
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
