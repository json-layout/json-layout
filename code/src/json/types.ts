import type { LanguageSupport } from '@codemirror/language'

export interface Range {
  from: number
  to: number
}

export type OffsetLocation =
  | { path: string, at: 'key' }
  | { path: string, at: 'value' }
  | { path: string, at: 'structural' }

export interface IndentOptions {
  column: number
  unit: string
}

export interface InsertOp {
  from: number
  to: number
  insert: string
}

export interface FormatAdapter {
  language: LanguageSupport
  parse(text: string): unknown
  pathToRange(text: string, path: string): Range | null
  offsetToPath(text: string, offset: number): OffsetLocation | null
  valueTokenAt(text: string, offset: number): { from: number, to: number, quoted: boolean } | null
  scaffold(value: unknown, indent: IndentOptions): string
  insertProperty(text: string, objectPath: string, name: string, value: unknown): InsertOp
}
