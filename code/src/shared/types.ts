import type { StatefulLayout, CompiledLayout } from '@json-layout/core'

/**
 * A generic completion candidate — used for leaf value completion (static enum
 * items, dynamic getItems results, etc.) and wherever the surface just needs a
 * (value, title, optional key) triple.
 */
export interface CompletionCandidate {
  value: unknown
  title: string
  key?: string
}

/**
 * A completion candidate for a property name inside an object.
 * `defaultValue` is the scaffolded value to insert as the property's value —
 * undefined if no static default applies (leaf without schema default, optional
 * empty object, etc.).
 */
export interface PropertyCandidate {
  key: string
  title?: string
  description?: string
  required: boolean
  defaultValue: unknown
}

/**
 * A completion candidate for picking a oneOf/anyOf variant at a value position.
 * `value` is the pre-scaffolded object for the variant, with discriminator
 * property filled in when applicable.
 */
export interface VariantCandidate {
  title: string
  value: unknown
}

/**
 * Help info extracted for a given path — all fields optional.
 */
export interface HelpInfo {
  title?: string
  description?: string
  help?: string
}

/**
 * Editor-agnostic diagnostic entry produced from a StatefulLayout error.
 * `from`/`to` are text offsets supplied by the format adapter's `pathToRange`.
 * `severity` is always `'error'` in v1 — reserved for future warn/info tiers.
 */
export interface Diagnostic {
  from: number
  to: number
  path: string
  message: string
  severity: 'error'
}

// Re-export the two core types shared/ consumers most often need, so callers
// can `import type { CompiledLayout } from '@json-layout/code'` when convenient.
export type { StatefulLayout, CompiledLayout }
