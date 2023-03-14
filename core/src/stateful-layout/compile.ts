/*
TODO:
  - traverse json schema
  - create a normalized layout keyword for each level based on schema and optional layout annotation
  - validate the normalized layout (json schema + custom assertion like the fact the the children keys match reality)
  - compile all partial schemas necessary for the stateful layout
  - optionally suggest serializing the result to js, serialization would include (serialization could also include types compiled from the schema)
*/

import traverse from 'json-schema-traverse'
import Ajv, { type ValidateFunction } from 'ajv'
import addFormats from 'ajv-formats'
// import rfdc from 'rfdc'
import Debug from 'debug'
import { normalizeSchemaFragment, type NormalizedLayout, type SchemaFragment } from '../normalized-layout'

// const clone = rfdc()

const debug = Debug('json-layout:compile')

export interface CompileSchemaOptions {
  ajv?: Ajv
}

export interface StatefulLayoutSkeleton {
  key: string
  layout: string // reference to a layout object in the normalizedLayouts store
  validate?: string // optional reference to a validate function in the validates store
  children?: StatefulLayoutSkeleton[]
  item?: StatefulLayoutSkeleton
}

export interface CompiledLayout {
  skeleton: StatefulLayoutSkeleton
  skeletons: Record<string, StatefulLayoutSkeleton>
  validates: Record<string, ValidateFunction>
  normalizedLayouts: Record<string, NormalizedLayout>
}

export function compileSchema (schema: any, options: CompileSchemaOptions = {}): CompiledLayout {
  const validates: Record<string, ValidateFunction> = {}
  const normalizedLayouts: Record<string, NormalizedLayout> = {}
  const skeletons: Record<string, StatefulLayoutSkeleton> = {}

  schema = schema as traverse.SchemaObject
  let ajv = options.ajv
  if (!ajv) {
    ajv = new Ajv({ strict: false })
    addFormats(ajv)
  }
  const skeleton = makeSkeleton(schema, ajv, validates, normalizedLayouts)

  return { skeleton, skeletons, validates, normalizedLayouts }
}

function makeSkeleton (
  schema: any,
  ajv: Ajv,
  validates: Record<string, ValidateFunction>,
  normalizedLayouts: Record<string, NormalizedLayout>
): StatefulLayoutSkeleton {
  // const uriResolver = ajv.opts.uriResolver
  const skeletonsStack: StatefulLayoutSkeleton[] = []
  let skeleton: StatefulLayoutSkeleton = { key: '', layout: '' }
  traverse(schema, {
    cb: {
      // pre is called before the children are traversed
      pre: (fragment, pointer, rootSchema, parentPointer, parentKeyword, parentFragment, key) => {
        // TODO: fragment might be missing type here ?
        normalizedLayouts[pointer] = normalizedLayouts[pointer] || normalizeSchemaFragment(fragment as SchemaFragment, pointer)
        const skeleton: StatefulLayoutSkeleton = { key: `${key ?? ''}`, layout: pointer }
        skeletonsStack.push(skeleton)
      },
      // post is called after the children are traversed
      post: (fragment, pointer, rootSchema, parentPointer, parentKeyword, parentFragment, key) => {
        // TODO: put current skeleton as child in parent
        skeleton = skeletonsStack.pop() as StatefulLayoutSkeleton
        const parent = skeletonsStack[skeletonsStack.length - 1]
        if (parent) {
          parent.children = parent.children ?? []
          parent.children.push(skeleton)
        }
        debug('skeleton finished for schema fragment', key)
      }
    }
  })
  return skeleton
}
