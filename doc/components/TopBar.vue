<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const labels = {
  'vocabulary': 'Vocabulary & API',
  'webmcp': 'WebMCP tools',
  'json-edition': 'JSON edition',
  'editor': 'Editor',
}

const breadcrumbs = computed(() => {
  const items = [{ title: 'Home', to: '/', disabled: route.path === '/' }]
  const segments = route.path.split('/').filter(Boolean)
  let path = ''
  segments.forEach((segment, index) => {
    path += `/${segment}`
    items.push({
      title: labels[segment] ?? segment,
      to: path,
      disabled: index === segments.length - 1,
    })
  })
  return items
})
</script>

<template>
  <v-app-bar
    flat
    color="background"
    class="topbar-border"
  >
    <v-app-bar-title class="flex-grow-0">
      JSON Layout
    </v-app-bar-title>
    <v-breadcrumbs
      :items="breadcrumbs"
      density="comfortable"
    />
    <v-spacer />
    <v-btn
      href="https://github.com/json-layout/json-layout"
      target="_blank"
      rel="noopener"
      variant="text"
      prepend-icon="mdi-github"
    >
      GitHub
    </v-btn>
  </v-app-bar>
</template>

<style scoped>
.topbar-border {
  border-bottom: 1px solid #fff !important;
}
</style>
