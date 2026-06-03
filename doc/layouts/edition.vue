<script setup>
import examples from '~/examples/index.js'
</script>

<template>
  <v-app>
    <TopBar />

    <v-navigation-drawer
      permanent
      width="260"
      color="background"
      class="drawer-border"
    >
      <v-list
        nav
        density="compact"
      >
        <v-list-item
          to="/json-edition"
          title="Overview"
          prepend-icon="mdi-book-open-variant"
        />
        <v-list-item
          to="/json-edition/editor"
          title="Editor"
          prepend-icon="mdi-pencil-box-outline"
          data-testid="nav-editor"
        />
        <v-list-subheader>Examples</v-list-subheader>
        <v-list-item
          v-for="ex in examples"
          :key="ex.id"
          :to="`/json-edition/${ex.id}`"
          :title="ex.title"
          :subtitle="ex.summary"
          prepend-icon="mdi-code-json"
          :data-testid="`nav-example-${ex.id}`"
        />
      </v-list>
    </v-navigation-drawer>

    <v-main>
      <v-container fluid>
        <slot />
      </v-container>
    </v-main>
  </v-app>
</template>

<style scoped>
.drawer-border {
  border-right: 1px solid #fff !important;
}
</style>
