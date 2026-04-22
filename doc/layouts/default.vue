<script setup>
import examples from '~/examples/index.js'
</script>

<template>
  <v-app>
    <v-app-bar flat>
      <v-app-bar-title>JSON Layout — Code edition dev</v-app-bar-title>
    </v-app-bar>

    <v-navigation-drawer permanent width="260">
      <v-list nav density="compact">
        <v-list-item to="/" title="Home" prepend-icon="mdi-home" />
        <v-list-subheader>Examples</v-list-subheader>
        <v-list-item
          v-for="ex in examples"
          :key="ex.id"
          :to="`/examples/${ex.id}`"
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
