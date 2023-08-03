// compileStatic is meant to produce a serializable result

import { type Expression, type NormalizedLayout } from '@json-layout/vocabulary'
import type Ajv from 'ajv'
import { makeSkeletonTree, type SkeletonTree } from './skeleton-tree'

export interface CompileStaticOptions {
  ajv: Ajv
}

export interface CompiledStatic {
  tree: SkeletonTree
  validates: string[]
  normalizedLayouts: Record<string, NormalizedLayout>
  expressions: Expression[]
}

export function compileStatic (schema: any, options: CompileStaticOptions): CompiledStatic {
  const validates: string[] = []
  const normalizedLayouts: Record<string, NormalizedLayout> = {}
  const expressions: Expression[] = []

  // TODO: produce a resolved/normalized version of the schema
  // useful to get predictable schemaPath properties in errors and to have proper handling of default values
  const tree = makeSkeletonTree(schema, options.ajv, validates, normalizedLayouts, expressions, `${schema.$id}#`, 'main')

  return { tree, validates, normalizedLayouts, expressions }
}
