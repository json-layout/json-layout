import path from 'node:path'
import { defineNuxtConfig } from 'nuxt/config'
import dependencyWatcher from 'vite-plugin-dependency-watcher'

const packageNames = ['@json-layout/code', '@json-layout/core', '@json-layout/vocabulary']
const packagePaths = packageNames.map((name) => path.resolve(process.cwd(), '../node_modules', name))

const isDev = process.env.NODE_ENV === 'development'

export default defineNuxtConfig({
  modules: [
    ['@nuxt/eslint', { config: { stylistic: true } }],
    'vuetify-nuxt-module'
  ],
  ssr: !isDev,
  css: ['vuetify/styles', '@mdi/font/css/materialdesignicons.css'],
  build: {
    transpile: ['vuetify']
  },
  compatibilityDate: '2026-04-22',
  vite: {
    plugins: [dependencyWatcher(packagePaths, packageNames)]
  },
  vuetify: {
    vuetifyOptions: {
      icons: { defaultSet: 'mdi' },
      theme: {
        defaultTheme: 'dark'
      }
    }
  }
})
