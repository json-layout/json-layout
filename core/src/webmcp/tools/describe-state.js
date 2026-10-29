/**
 * @file describeState tool
 */

import { collectScopedErrors, formatMutationResult } from '../errors.js'
import { recordItemOptionsUnderList, projectNodeToMarkdown, projectStateTreeToMarkdown } from '../project.js'
import { projectHiddenField, projectQueryMatches, QUERY_MATCHES_MAX } from '../query.js'
import { byteLength, OUTLINE_BUDGET_BYTES, outlineThatFits, outlineFooter, projectStateTreeOutline } from '../outline.js'
import { resolveNodeForEdit, nodeNotFoundError, inactiveOptionNote } from '../resolve.js'
import { VariantsMemo } from '../variants-memo.js'
import { describeFormSchema, resolveSchemaPath } from '../form-schema.js'

export const inputSchema = {
  type: 'object',
  properties: {
    path: {
      type: 'string',
      description: 'Node path as returned by describeState (e.g. "/address/city"). Omit for the whole tree. It may name what does not exist yet: an option not chosen ("/menu/0/$oneOf/2"), or an item of a list still empty ("/menu/0").'
    },
    query: {
      type: 'string',
      description: 'Words to look for instead of describing: lists the fields (under "path" if given) whose key, title, help or short text value holds all of them, accents and case apart, including those a condition hides.'
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
  const potentialText = ' Each option of a choice is listed with the fields it brings, and a path to an option not chosen (".../$oneOf/2") or to an item of a list still empty describes what it would hold. To find a field without knowing which tab holds it, pass "query" with words of its name.'
  return `Describe the "${dataTitle}" form: every field with its path, type, constraints, current value and errors. Pass "path" to describe one subtree instead of the whole form; what is too large to describe whole is answered as an outline.${sections}${potentialText}`
}

/**
 * @param {import('../../state/index.js').StatefulLayout} statefulLayout
 * @param {{ path?: string, query?: string }} args
 * @param {import('../variants-memo.js').VariantsMemo} [variantsMemo] - updated, not consulted:
 * a read is what the agent asked to see, so every union under it is listed in full, and the
 * memo is what later writes use to avoid repeating those lists
 * @param {boolean} [screen] - false for a form edited with no screen: no section is "open"
 * @returns {string}
 */
export function toMarkdown (statefulLayout, args, variantsMemo, screen = true) {
  const listed = new VariantsMemo()

  if (args.query?.trim()) return queryMarkdown(statefulLayout, args.query.trim(), args.path)

  if (args.path) {
    const node = resolveNodeForEdit(statefulLayout, args.path)
    // a field hidden by its own condition resolves to its hidden node
    const hiddenNode = node?.layout.comp === 'none' ? projectHiddenField(statefulLayout, args.path) : undefined
    if (hiddenNode) return hiddenNode
    if (!node) {
      // a part hidden by a condition holds it: say so, and what it holds now
      const hidden = projectHiddenField(statefulLayout, args.path)
      if (hidden) return hidden
      // what does not exist yet: an option not chosen, an item not added
      let resolved
      try { resolved = resolveSchemaPath(statefulLayout, args.path) } catch { resolved = undefined }
      if (resolved) {
        const { pointer, path, variant } = resolved
        const option = inactiveOptionNote(statefulLayout, args.path)
        if (option) return `not in the form yet. ${option} What it would hold:\n${describeFormSchema(statefulLayout.compiledLayout, { pointer, path, variant })}`
        return `not in the form yet — what it would hold, writable once chosen or added:\n${describeFormSchema(statefulLayout.compiledLayout, { pointer, path, variant })}`
      }
      throw nodeNotFoundError(statefulLayout, args.path)
    }
    const { errors, otherErrors, elsewhere } = collectScopedErrors(statefulLayout, node)
    /** @param {string} description */
    const answer = (description) => formatMutationResult(statefulLayout.valid, errors, description, otherErrors, elsewhere)
    recordItemOptionsUnderList(node, statefulLayout, listed)
    const markdown = answer(projectNodeToMarkdown(node, statefulLayout, 0, undefined, listed, screen, true))
    if (byteLength(markdown) <= OUTLINE_BUDGET_BYTES) {
      variantsMemo?.merge(listed)
      return markdown
    }
    // a part too large is shown shallower rather than cut, as the whole form is
    return outlineThatFits(node, statefulLayout, variantsMemo ?? new VariantsMemo(), screen,
      (outline, depth) => `${answer(outline)}\n${outlineFooter(depth)}`)
  }

  const markdown = projectStateTreeToMarkdown(statefulLayout.stateTree, statefulLayout, listed, screen, true)
  if (byteLength(markdown) <= OUTLINE_BUDGET_BYTES) {
    variantsMemo?.merge(listed)
    return markdown
  }
  // round 2 answered 95 KB for a 7.5 KB page, and the agent never saw it whole
  return projectStateTreeOutline(statefulLayout.stateTree, statefulLayout, variantsMemo ?? new VariantsMemo(), screen)
}

/**
 * @param {import('../../state/index.js').StatefulLayout} statefulLayout
 * @param {string} query
 * @param {string} [path]
 * @returns {string}
 */
function queryMarkdown (statefulLayout, query, path) {
  let root = statefulLayout.stateTree.root
  if (path) {
    const node = resolveNodeForEdit(statefulLayout, path)
    if (!node) throw nodeNotFoundError(statefulLayout, path)
    root = node
  }
  const { lines, total } = projectQueryMatches(root, statefulLayout, query)
  const where = path ? ` under ${path}` : ''
  if (!total) return `no field matches "${query}"${where}. Try fewer or other words, or call describeState without a query${path ? ' (or without the path)' : ''} to see the form's sections.`
  const header = total > QUERY_MATCHES_MAX
    ? `${total} fields match "${query}"${where}, the first ${QUERY_MATCHES_MAX} are listed — add words to narrow:`
    : `${total} field${total > 1 ? 's' : ''} match${total > 1 ? '' : 'es'} "${query}"${where}:`
  return `${header}\n${lines.join('\n')}`
}
