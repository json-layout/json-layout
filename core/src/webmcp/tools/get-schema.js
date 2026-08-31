/**
 * @file getSchema tool
 */

import { resolveNode, visibleChildren } from '../resolve.js'
import { resolveNodeSchema, projectDeclaredFields } from '../schema.js'

/**
 * Above this size the serialized schema is not returned: transporting it is very slow
 * and it floods the context of the agent. A "path" must then be used to get a sub-schema.
 */
export const SCHEMA_MAX_LENGTH = 20000

export const inputSchema = {
  type: 'object',
  properties: {
    path: {
      type: 'string',
      description: 'Path of a node of the form as returned by describeState (e.g. "/address" or "/items/0"). Returns only the sub-schema that governs this node. Required on large schemas.'
    }
  }
}

export const outputSchema = {
  type: 'object',
  description: 'The JSON schema definition, a sub-schema, or an explanation of how to get one'
}

/**
 * @param {string} dataTitle
 * @returns {string}
 */
export function getDescription (dataTitle) {
  return `Get the JSON schema that governs the "${dataTitle}" form. Pass "path" (a node path from describeState) to get only the sub-schema of this node: on a large schema the full schema is not returned at all, as it would be too slow to transport and too large to read.`
}

/**
 * @typedef {{
 *   schema?: object,
 *   path?: string,
 *   fields?: Array<import('../schema.js').DeclaredField>,
 *   tooLarge?: boolean,
 *   length?: number,
 *   paths?: Array<{path: string, type: string, title?: string}>,
 *   message?: string
 * }} GetSchemaResult
 */

/**
 * @param {import('../../state/index.js').StatefulLayout} statefulLayout
 * @returns {Array<{path: string, type: string, title?: string}>}
 */
function topLevelPaths (statefulLayout) {
  return visibleChildren(statefulLayout.stateTree.root).map((child) => {
    /** @type {{path: string, type: string, title?: string}} */
    const out = { path: child.fullKey, type: child.layout.comp }
    const layout = /** @type {Record<string, unknown>} */(child.layout)
    if (typeof layout.title === 'string') out.title = layout.title
    else if (typeof layout.label === 'string') out.title = layout.label
    return out
  })
}

/**
 * The fields a node declares, with a message that matches what the agent can actually do with
 * them: they are empty on a node the skeleton says nothing about, and unreachable when they
 * belong to array items that do not exist yet.
 * @param {import('../../state/index.js').StatefulLayout} statefulLayout
 * @param {import('../../state/types.js').StateNode} node
 * @param {object|null} schema
 * @returns {{fields: Array<import('../schema.js').DeclaredField>, note: string}}
 */
function declaredFieldsWithNote (statefulLayout, node, schema) {
  const fields = projectDeclaredFields(node, statefulLayout, schema)
  if (fields.length === 0) {
    return { fields, note: 'It declares no field that can be listed here, use describeState on this path to explore it.' }
  }
  if (!resolveNode(statefulLayout.stateTree.root, fields[0].path)) {
    return { fields, note: 'Here are the fields declared by its items, add an item with editArray before reading or filling them.' }
  }
  return { fields, note: 'Here are the fields it declares, call getSchema again on one of them for more details.' }
}

/**
 * @param {import('../../state/index.js').StatefulLayout} statefulLayout
 * @param {object|null} schema
 * @param {{ path?: string }} args
 * @returns {GetSchemaResult}
 */
export function execute (statefulLayout, schema, args) {
  if (args.path) {
    const node = resolveNode(statefulLayout.stateTree.root, args.path)
    if (!node) {
      throw new Error(`node not found at path: ${args.path}`)
    }
    const subSchema = resolveNodeSchema(node, statefulLayout, schema)
    if (subSchema) {
      const length = JSON.stringify(subSchema).length
      if (length <= SCHEMA_MAX_LENGTH) {
        return { path: args.path, schema: subSchema }
      }
      const tooLargeFields = declaredFieldsWithNote(statefulLayout, node, schema)
      return {
        path: args.path,
        length,
        tooLarge: true,
        fields: tooLargeFields.fields,
        message: `The sub-schema at path "${args.path}" is still too large (${length} characters). ${tooLargeFields.note}`
      }
    }
    const unresolved = declaredFieldsWithNote(statefulLayout, node, schema)
    return {
      path: args.path,
      fields: unresolved.fields,
      message: `No JSON sub-schema could be resolved for path "${args.path}". ${unresolved.note}`
    }
  }

  if (!schema) throw new Error('no schema available')

  const serialized = JSON.stringify(schema)
  if (serialized.length <= SCHEMA_MAX_LENGTH) return { schema }

  return {
    tooLarge: true,
    length: serialized.length,
    paths: topLevelPaths(statefulLayout),
    message: `The schema is too large to be returned as a whole (${serialized.length} characters, limit is ${SCHEMA_MAX_LENGTH}). Call getSchema again with a "path" parameter to get the sub-schema of a node, or use describeState to explore the form. Top level paths are listed in "paths".`
  }
}

/**
 * @param {GetSchemaResult} result
 * @returns {string}
 */
export function toText (result) {
  if (result.tooLarge || result.fields) {
    const lines = [/** @type {string} */(result.message)]
    if (result.paths) {
      for (const p of result.paths) {
        lines.push(`- ${p.path} (${p.type})${p.title ? ` title="${p.title}"` : ''}`)
      }
    }
    if (result.fields) {
      for (const f of result.fields) {
        const meta = [f.type ?? 'unknown']
        if (f.required) meta.push('required')
        if (f.enum) meta.push(`enum=${JSON.stringify(f.enum)}`)
        lines.push(`- ${f.path} (${meta.join(', ')})`)
      }
    }
    return lines.join('\n')
  }
  return JSON.stringify(result.schema)
}
