<script setup>
import { computed } from 'vue'
import { collectDiagnostics, jsonFormatAdapter } from '@json-layout/code'

const props = defineProps({
  data: { type: null, required: true },
  statefulLayout: { type: Object, required: true },
  text: { type: String, required: true }
})

const diagnostics = computed(() => {
  return collectDiagnostics(props.statefulLayout, props.text, jsonFormatAdapter)
})

function * walkNodes (root) {
  const stack = [root]
  while (stack.length) {
    const node = stack.pop()
    if (!node) continue
    yield node
    if (Array.isArray(node.children)) {
      for (let i = node.children.length - 1; i >= 0; i--) stack.push(node.children[i])
    }
  }
}

const modifiedPaths = computed(() => {
  // statefulLayout is not reactive, but `props.data` changes every committed
  // sync, which re-runs this computed — so the list stays fresh.
  void props.data
  const paths = []
  for (const node of walkNodes(props.statefulLayout.stateTree.root)) {
    if (node.modified === true && typeof node.dataPath === 'string') {
      paths.push(node.dataPath)
    }
  }
  return paths
})

const dataPretty = computed(() => JSON.stringify(props.data, null, 2))
</script>

<template>
  <div class="jl-inspector">
    <v-card class="mb-3" data-testid="inspector-data">
      <v-card-title>Data</v-card-title>
      <v-card-text>
        <pre class="jl-pre">{{ dataPretty }}</pre>
      </v-card-text>
    </v-card>

    <v-card class="mb-3" data-testid="inspector-diagnostics">
      <v-card-title>Diagnostics ({{ diagnostics.length }})</v-card-title>
      <v-card-text>
        <div v-if="!diagnostics.length" class="text-disabled">
          No diagnostics.
        </div>
        <ul v-else class="jl-diag-list">
          <li v-for="(d, i) in diagnostics" :key="i">
            <code>{{ d.path || '/' }}</code> — {{ d.message }}
          </li>
        </ul>
      </v-card-text>
    </v-card>

    <v-card data-testid="inspector-modified">
      <v-card-title>Modified paths ({{ modifiedPaths.length }})</v-card-title>
      <v-card-text>
        <div v-if="!modifiedPaths.length" class="text-disabled">
          No modified paths.
        </div>
        <ul v-else class="jl-modified-list">
          <li v-for="p in modifiedPaths" :key="p">
            <code>{{ p || '/' }}</code>
          </li>
        </ul>
      </v-card-text>
    </v-card>
  </div>
</template>

<style scoped>
.jl-inspector {
  display: flex;
  flex-direction: column;
  gap: 0;
}
.jl-pre {
  white-space: pre-wrap;
  margin: 0;
  font-family: 'Fira Code', 'Menlo', monospace;
  font-size: 12px;
}
.jl-diag-list,
.jl-modified-list {
  margin: 0;
  padding-left: 20px;
  font-size: 13px;
}
</style>
