<script setup>
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { EditorView, lineNumbers, keymap } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { json } from '@codemirror/lang-json'
import { oneDark } from '@codemirror/theme-one-dark'

const props = defineProps({
  modelValue: { type: String, default: '' },
})

const emit = defineEmits(['update:modelValue'])

const host = ref(/** @type {HTMLElement | null} */(null))
/** @type {EditorView | null} */
let view = null

onMounted(() => {
  if (!host.value) return
  view = new EditorView({
    parent: host.value,
    state: EditorState.create({
      doc: props.modelValue,
      extensions: [
        lineNumbers(),
        history(),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        json(),
        oneDark,
        EditorView.updateListener.of((update) => {
          if (!update.docChanged) return
          const text = update.state.doc.toString()
          if (text !== props.modelValue) emit('update:modelValue', text)
        }),
      ],
    }),
  })
})

// Reflect external model changes (bootstrap, reset) into the editor without
// echoing them straight back out through the update listener.
watch(() => props.modelValue, (value) => {
  if (!view) return
  if (value === view.state.doc.toString()) return
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } })
})

onBeforeUnmount(() => {
  if (view) {
    view.destroy()
    view = null
  }
})
</script>

<template>
  <div
    ref="host"
    class="jl-code-input"
    data-testid="code-input"
  />
</template>

<style scoped>
.jl-code-input {
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 4px;
  min-height: 240px;
  font-family: 'Fira Code', 'Menlo', monospace;
  font-size: 13px;
}
.jl-code-input :deep(.cm-editor) {
  min-height: 240px;
}
.jl-code-input :deep(.cm-content) {
  padding: 8px 0;
}
</style>
