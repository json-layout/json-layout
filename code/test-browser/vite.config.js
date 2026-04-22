/**
 * Vite config for the Playwright harness. Serves test-browser/index.html at /
 * and pre-bundles the CJS-prone deps that @json-layout/core pulls in. These
 * are the same ones the doc/ Nuxt config has to whitelist — catching that
 * class of breakage here (with Vite) is the whole point.
 */

import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  root: here,
  server: { port: 5174, strictPort: true },
  optimizeDeps: {
    include: [
      'ajv/dist/2019.js',
      'ajv-i18n',
      'ajv-formats',
      'ajv-errors',
      'debug',
      'fast-deep-equal',
      'immer',
      'marked'
    ]
  }
})
