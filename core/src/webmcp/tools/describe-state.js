/**
 * @file describeState tool
 */

import { collectScopedErrors, projectNodeToMarkdown, projectStateTreeToMarkdown, formatMutationResult } from '../project.js'
import { resolveNodeForEdit, nodeNotFoundError } from '../resolve.js'
import { VariantsMemo } from '../variants-memo.js'
import { describeFormSchema, resolveSchemaPath } from '../form-schema.js'

export const inputSchema = {
  type: 'object',
  properties: {
    path: {
      type: 'string',
      description: 'Node path as returned by describeState (e.g. "/address/city"). Omit for the whole tree. It may name what does not exist yet: an option not chosen ("/menu/0/$oneOf/2"), or an item of a list still empty ("/menu/0").'
    }
  }
}

/**
 * @param {string} dataTitle
 * @param {boolean} [screen] - false for a form edited with no screen
 * @returns {string}
 */
export function getDescription (dataTitle, screen = true) {
  const sections = screen ? ' Of tabs or steps, the one on screen is marked (open); writing a field opens the one that holds it.' : ''
  // what the form can hold beyond its state, so that a choice can be named before it is made
  const potentialText = ' Each option of a choice is listed with the fields it brings, and a path to an option not chosen (".../$oneOf/2") or to an item of a list still empty describes what it would hold.'
  return `Describe the "${dataTitle}" form: every field with its path, type, constraints, current value and errors. Pass "path" to describe one subtree instead of the whole form.${sections}${potentialText}`
}

/**
 * @param {import('../../state/index.js').StatefulLayout} statefulLayout
 * @param {{ path?: string }} args
 * @param {import('../variants-memo.js').VariantsMemo} [variantsMemo] - updated, not consulted:
 * a read is what the agent asked to see, so every union under it is listed in full, and the
 * memo is what later writes use to avoid repeating those lists
 * @param {boolean} [screen] - false for a form edited with no screen: no section is "open"
 * @returns {string}
 */
export function toMarkdown (statefulLayout, args, variantsMemo, screen = true) {
  const listed = new VariantsMemo()

  if (args.path) {
    const node = resolveNodeForEdit(statefulLayout, args.path)
    if (!node) {
      // what does not exist yet: an option not chosen, an item not added
      let resolved
      try { resolved = resolveSchemaPath(statefulLayout, args.path) } catch { resolved = undefined }
      if (resolved) {
        const { pointer, path, variant } = resolved
        return `not in the form yet — what it would hold, writable once chosen or added:\n${describeFormSchema(statefulLayout.compiledLayout, { pointer, path, variant })}`
      }
      throw nodeNotFoundError(statefulLayout, args.path)
    }
    const { errors, otherErrors } = collectScopedErrors(statefulLayout, node)
    const markdown = formatMutationResult(statefulLayout.valid, errors,
      projectNodeToMarkdown(node, statefulLayout, 0, undefined, listed, screen, true),
      otherErrors
    )
    variantsMemo?.merge(listed)
    return markdown
  }

  const markdown = projectStateTreeToMarkdown(statefulLayout.stateTree, statefulLayout, listed, screen, true)
  variantsMemo?.merge(listed)
  return markdown
}
