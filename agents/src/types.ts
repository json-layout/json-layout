import type { CompiledLayout, PartialCompileOptions } from '@json-layout/core'
import type { StatefulLayoutOptions } from '@json-layout/core/state'

// what a session hands the consumer's save function besides the document itself
export interface SaveContext {
  // the version the document was loaded at, when the consumer's load returned one, and
  // when the last save reported one
  version?: unknown
  // the document as loaded or last saved, before the edits being saved
  base?: unknown
}

// an MCP-shaped tool descriptor, handed to whatever server SDK the consumer uses
export interface FormTool {
  // the tool name, prefixed when the session sets one
  name: string
  // what the agent reads to decide when to call it
  description: string
  // JSON Schema of the accepted arguments
  inputSchema?: object
  // returns an MCP-shaped tool result
  execute: (args?: any) => Promise<any>
}

export type SessionStatus = 'closed' | 'opening' | 'ready' | 'stale' | 'saving' | 'error'

export interface SessionSpec {
  // returns the resource document, or `{ data, version }`; absent, or returning no
  // document, for a session that creates records: its form empties after each save
  load?: () => unknown
  // persists the document; absent means the session is read-only
  save?: (data: unknown, context: SaveContext) => unknown
  // returns a JSON Schema, or `{ schema, version }`
  schema?: () => unknown
  // an already compiled layout; wins over `schema`
  layout?: CompiledLayout
  // what the form edits, e.g. "portal page"; goes into every tool description
  title: string
  // forwarded to the state layer (notably `fetch` and `fetchBaseURL` for remote items)
  options?: Partial<StatefulLayoutOptions>
  // only used when compiling `schema`
  compileOptions?: PartialCompileOptions
  // 'explicit' (default): saved by saveForm or a write's `save: true`; 'auto': saved after
  // every write that leaves the form valid, for a document bound to a server-side draft
  saveMode?: 'explicit' | 'auto'
  // let `save` persist a document that fails the schema's validation (default false)
  allowInvalid?: boolean
  // prefix for every tool name, for a consumer that registers several sessions in one
  // namespace
  prefixName?: string
}

// the part of a session spec the layout cache needs
export interface LayoutSpec {
  layout?: CompiledLayout
  schema?: () => unknown
  compileOptions?: PartialCompileOptions
}
