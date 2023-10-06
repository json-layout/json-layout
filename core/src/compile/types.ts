import type ajvModule from 'ajv'
import type MarkdownIt from 'markdown-it'
import { type NormalizedLayout, type StateNodeOptions } from '@json-layout/vocabulary'
import { type ValidateFunction, type SchemaObject } from 'ajv'
import { type Display } from '../state/utils/display.js'

export type CompiledExpression = (data: any, options: StateNodeOptions, display: Display) => any

export interface CompileOptions {
  ajv: ajvModule.default
  code: boolean
  markdown: (text: string) => string
  markdownIt?: MarkdownIt.Options
  locale: string
}

export interface CompiledLayout {
  options: CompileOptions
  schema?: SchemaObject
  skeletonTree: SkeletonTree
  validates: Record<string, ValidateFunction>
  normalizedLayouts: Record<string, NormalizedLayout>
  expressions: CompiledExpression[]
  localizeErrors: (errors: ajvModule.ErrorObject[]) => void
}

// a tree is a root node and a validation function
// it will be used to instantiate a StateLayoutTree with 1 validation context
export interface SkeletonTree {
  title: string
  root: SkeletonNode
}

// a skeleton node is a light recursive structure
// at runtime each one will be instantiated as a StateNode with a value and an associated component instance
export interface SkeletonNode {
  key: string | number
  pointer: string
  parentPointer: string | null
  defaultData?: unknown
  children?: SkeletonNode[] // optional children in the case of arrays and object nodes
  childrenTrees?: SkeletonTree[] // other trees that can be instantiated with separate validation (for example in the case of new array items of oneOfs, etc)
}
