<template>
  <v-app>
    <v-app-bar flat>
      <v-app-bar-title>JSON Layout</v-app-bar-title>
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

    <v-main>
      <v-container class="py-8">
        <slot />
      </v-container>
    </v-main>
  </v-app>
</template>
