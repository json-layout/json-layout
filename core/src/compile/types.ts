import type ajvModule from 'ajv/dist/2019.js'
import type MarkdownIt from 'markdown-it'
import { type ComponentInfo, type BaseCompObject, type NormalizedLayout, type StateNodeOptionsBase } from '@json-layout/vocabulary'
import { type ValidateFunction, type SchemaObject, type ErrorObject } from 'ajv/dist/2019.js'
import { type Display } from '../state/utils/display.js'
import { type LocaleMessages } from '../i18n/types.js'

export interface ParentContextExpression {
  data: unknown
  parent: ParentContextExpression | undefined | null
}

export type CompiledExpression = (
  data: any,
  options: StateNodeOptionsBase,
  context: object,
  display: Display,
  layout: BaseCompObject,
  rootData?: unknown,
  parent?: ParentContextExpression | null
) => any

export interface CompileOptions {
  ajv: ajvModule.default
  ajvOptions?: ajvModule.Options
  code: boolean
  markdown: (text: string) => string
  markdownItOptions?: MarkdownIt.Options
  locale: string
  messages: LocaleMessages
  optionsKeys: string[]
  components: Record<string, ComponentInfo>
}

export type PartialCompileOptions = Partial<Omit<CompileOptions, 'messages'>> & {
  messages?: Partial<LocaleMessages>
  components?: Record<string, Omit<ComponentInfo, 'name'>>
}

export interface CompiledLayout {
  options?: CompileOptions
  schema?: SchemaObject
  skeletonTree: SkeletonTree
  validates: Record<string, ValidateFunction>
  validationErrors: Record<string, string[]>
  normalizedLayouts: Record<string, NormalizedLayout>
  expressions: CompiledExpression[]
  locale: string
  messages: LocaleMessages
  components: Record<string, Omit<ComponentInfo, 'schema'>>
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
  pure: boolean
  propertyKeys: string[]
  roPropertyKeys: string[]
  children?: SkeletonNode[] // optional children in the case of arrays and object nodes
  childrenTrees?: SkeletonTree[] // other trees that can be instantiated with separate validation (for example in the case of new array items of oneOfs, etc)
}
