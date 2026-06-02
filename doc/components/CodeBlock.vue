<!-- eslint-disable vue/no-v-html -->
<template>
  <pre
    class="code-block rounded mb-6 overflow-auto"
    :class="`language-${language}`"
  ><code
    :class="`language-${language}`"
    v-html="html"
  /></pre>
</template>

<script setup>
import { computed } from 'vue'
import Prism from '~/assets/prism.js'

Prism.manual = true

const props = defineProps({
  code: {
    type: String,
    required: true,
  },
  language: {
    type: String,
    default: 'javascript',
  },
})

const html = computed(() => {
  const grammar = Prism.languages[props.language] ?? Prism.languages.javascript
  return Prism.highlight(props.code, grammar, props.language)
})
</script>

<style scoped>
.code-block {
  margin-top: 0;
  padding: 16px;
  font-size: 13px;
  border: none;
  background: rgb(var(--v-theme-surface));
}
</style>
