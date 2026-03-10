import type { CompiledLayout } from '@json-layout/core'
import type { StatefulLayout } from '@json-layout/core/state'

// --- Store types ---

export interface StoreEntry<T> {
  value: T
  expiresAt: number
}

export interface Store {
  generateId: () => string
  setCompiled: (id: string, value: CompiledLayout) => void
  getCompiled: (id: string) => CompiledLayout | undefined
  setCompiledByPath: (path: string, value: CompiledLayout, updateDate: number) => void
  getCompiledByPath: (path: string) => { layout: CompiledLayout, updateDate: number } | undefined
  setState: (id: string, value: StatefulLayout) => void
  getState: (id: string) => StatefulLayout | undefined
  deleteCompiled: (id: string) => boolean
  deleteState: (id: string) => boolean
  clear: () => void
}

// --- Projection types ---

export interface ProjectedNode {
  key: string | number
  path: string
  comp: string
  data: unknown
  title?: string
  label?: string
  help?: string
  error?: string
  childError?: boolean
  required?: boolean
  readOnly?: boolean
  constraints?: Record<string, unknown>
  oneOfItems?: Array<{ key: number, title: string }>
  children?: ProjectedNode[]
}

export interface ProjectedStateTree {
  root: ProjectedNode
  valid: boolean
}

// --- Tool input/output types ---

export type GetSchemaContext = (
  path: string,
  updateDate?: number
) => { schema: Record<string, unknown>, updateDate: number } | null

export interface CompileInput {
  path: string
  options?: Record<string, unknown>
}

export interface CompileResult {
  id: string
  valid: boolean
  errors: Array<{ pointer: string, messages: string[] }>
  recompiled: boolean
  updateDate: number
}

export interface CreateStateInput {
  compiledId: string
  data?: unknown
  options?: Record<string, unknown>
}

export interface CreateStateResult {
  stateId: string
  state: ProjectedStateTree
}

export interface DescribeStateInput {
  stateId: string
  path?: string
}

export interface DescribeStateResult {
  state: ProjectedStateTree | ProjectedNode
  valid: boolean
  errors: Array<{ path: string, message: string }>
}

export interface SetDataInput {
  stateId: string
  data: unknown
}

export interface SetDataResult {
  state: ProjectedStateTree
  valid: boolean
  errors: Array<{ path: string, message: string }>
}

export interface SetFieldValueInput {
  stateId: string
  path: string
  value: unknown
}

export interface SetFieldValueResult {
  state: ProjectedStateTree
  valid: boolean
  errors: Array<{ path: string, message: string }>
}

export interface GetFieldSuggestionsInput {
  stateId: string
  path: string
  query?: string
}

export interface SuggestionItem {
  value: unknown
  title: string
  key?: string
}

export interface GetFieldSuggestionsResult {
  items: SuggestionItem[]
}

export interface ValidateStateInput {
  stateId: string
}

export interface ValidateStateResult {
  valid: boolean
  errors: Array<{ path: string, message: string }>
  data: unknown
}

export interface GetDataInput {
  stateId: string
}

export interface GetDataResult {
  data: unknown
  valid: boolean
}

export interface DestroyInput {
  compiledId?: string
  stateId?: string
}

export interface DestroyResult {
  deletedCompiled: boolean
  deletedState: boolean
}
