/*
TODO:
  - traverse json schema
  - create a normalized layout keyword for each level based on schema and optional layout annotation
  - validate the normalized layout (json schema + custom assertion like the fact the the children keys match reality)
  - compile all partial schemas necessary for the stateful layout
  - optionally suggest serializing the result to js, serialization would include (serialization could also include types compiled from the schema)
*/

import type traverse from 'json-schema-traverse'
import type Ajv from 'ajv'
import Debug from 'debug'
import { normalizeLayoutFragment, type NormalizedLayout, type SchemaFragment } from '../normalized-layout'

const debug = Debug('json-layout:compile-raw')

export interface CompileSchemaOptions {
  ajv: Ajv
}

export interface StatefulLayoutSkeleton {
  key: string
  layout: string // reference to a layout object in the normalizedLayouts store
  validate?: string // optional reference to a validate function in the validates store
  children?: StatefulLayoutSkeleton[]
  item?: StatefulLayoutSkeleton
}

export interface CompiledRaw {
  skeleton: StatefulLayoutSkeleton
  validates: string[]
  normalizedLayouts: Record<string, NormalizedLayout>
}

export function compileRaw (schema: object, options: CompileSchemaOptions): CompiledRaw {
  const validates: string[] = []
  const normalizedLayouts: Record<string, NormalizedLayout> = {}

  schema = schema as traverse.SchemaObject
  const skeleton = makeSkeleton(schema, options.ajv, validates, normalizedLayouts, '', '#')

  return { skeleton, validates, normalizedLayouts }
}

function makeSkeleton (
  schema: any,
  ajv: Ajv,
  validates: string[],
  normalizedLayouts: Record<string, NormalizedLayout>,
  key: string,
  pointer: string
): StatefulLayoutSkeleton {
  /*
  // const uriResolver = ajv.opts.uriResolver
  const skeletonsStack: StatefulLayoutSkeleton[] = []
  let skeleton: StatefulLayoutSkeleton = { key: '', layout: '' }
  traverse(schema, {
    cb: {
      // pre is called before the children are traversed
      pre: (fragment, pointer, rootSchema, parentPointer, parentKeyword, parentFragment, key) => {
        // TODO: fragment might be missing type here ?
        normalizedLayouts[pointer] = normalizedLayouts[pointer] || normalizeLayoutFragment(fragment as SchemaFragment, pointer)
        validates.push(pointer)
        const skeleton: StatefulLayoutSkeleton = { key: `${key ?? ''}`, layout: pointer, validate: pointer }
        skeletonsStack.push(skeleton)
      },
      // post is called after the children are traversed
      post: (fragment, pointer, rootSchema, parentPointer, parentKeyword, parentFragment, key) => {
        skeleton = skeletonsStack.pop() as StatefulLayoutSkeleton
        const parent = skeletonsStack[skeletonsStack.length - 1]
        if (parent) {
          parent.children = parent.children ?? []
          parent.children.push(skeleton)
        }
        debug('skeleton finished for schema fragment', key)
      }
    }
  }) */
  normalizedLayouts[pointer] = normalizedLayouts[pointer] || normalizeLayoutFragment(schema as SchemaFragment, pointer)
  validates.push(pointer)
  const skeleton: StatefulLayoutSkeleton = { key: `${key ?? ''}`, layout: pointer, validate: pointer }
  const childrenCandidates: Array<{ key: string, pointer: string, schema: any }> = []
  if (schema.properties) {
    for (const propertyKey of Object.keys(schema.properties)) {
      childrenCandidates.push({ key: propertyKey, pointer: `${pointer}/properties/${propertyKey}`, schema: schema.properties[propertyKey] })
    }
  }
  if (childrenCandidates.length) {
    skeleton.children = childrenCandidates.map(cc => makeSkeleton(cc.schema, ajv, validates, normalizedLayouts, cc.key, cc.pointer))
  }
  return skeleton
}
