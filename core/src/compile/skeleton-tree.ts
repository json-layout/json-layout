// import Debug from 'debug'
import { type NormalizedLayout, type Expression } from '@json-layout/vocabulary'
import { type SkeletonNode, makeSkeletonNode } from './skeleton-node'
import { type CompileOptions } from '.'

// const debug = Debug('json-layout:compile-raw')

// a tree is a root node and a validation function
// it will be used to instantiate a StateLayoutTree with 1 validation context
export interface SkeletonTree {
  title: string
  root: SkeletonNode
}

export function makeSkeletonTree (
  schema: any,
  options: CompileOptions,
  validates: string[],
  normalizedLayouts: Record<string, NormalizedLayout>,
  expressions: Expression[],
  pointer: string,
  title: string
): SkeletonTree {
  const root = makeSkeletonNode(schema, options, validates, normalizedLayouts, expressions, '', pointer, null)
  validates.push(pointer)
  return { title, root }
}
