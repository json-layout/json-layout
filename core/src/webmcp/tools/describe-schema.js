/**
 * @file describeSchema tool
 */

import { describeFormSchema } from '../form-schema.js'
import { resolveNode } from '../resolve.js'

export const inputSchema = {
  type: 'object',
  properties: {
    path: {
      type: 'string',
      description: 'Node path as returned by describeState (e.g. "/address/city"). Omit for the whole form. It may name what does not exist yet: an option not chosen ("/menu/0/$oneOf/2"), or an item of a list still empty ("/menu/0").'
    }
  }
}

/**
 * @param {string} dataTitle
 * @returns {string}
 */
export function getDescription (dataTitle) {
  return `Describe what the "${dataTitle}" form can hold, whatever its current state: its sections, every option of a choice with the fields that option brings, and the shape of a list item. describeState says what the form holds now; this says what it can hold, so that a choice can be named before it is made. Its paths only become writable once the option is chosen or the item added.`
}

/**
 * @param {string} path
 * @returns {string[]}
 */
const segmentsOf = (path) => path.split('/').filter(Boolean)

/**
 * The skeleton node a path designates, and its data path. The live state answers as far as it
 * exists; the rest of the path is followed in the compiled skeleton: a list index leads to the
 * item's shape, "$oneOf" to the choice between options, a number after it to one option.
 * @param {import('../../state/index.js').StatefulLayout} statefulLayout
 * @param {string} path
 * @returns {{ pointer: string, path: string, variant?: number }}
 */
export function resolveSchemaPath (statefulLayout, path) {
  const compiled = statefulLayout.compiledLayout
  const nodes = compiled.skeletonNodes
  const trees = compiled.skeletonTrees
  const segments = segmentsOf(path)
  // the longest prefix the live state knows
  let known = segments.length
  let stateNode
  for (; known > 0; known--) {
    stateNode = resolveNode(statefulLayout.stateTree.root, '/' + segments.slice(0, known).join('/'))
    if (stateNode) break
  }
  stateNode = stateNode ?? statefulLayout.stateTree.root
  let pointer = stateNode.skeleton.pointer
  let dataPath = stateNode.dataPath || '/'
  /** @type {number | undefined} */
  let variant
  const join = (/** @type {string} */ key) => (dataPath === '/' ? `/${key}` : `${dataPath}/${key}`)
  for (const segment of segments.slice(known)) {
    const node = nodes[pointer]
    const layout = /** @type {any} */(compiled.normalizedLayouts[pointer])
    const isSelector = !!(layout && (Array.isArray(layout.oneOfItems) || layout.comp === 'one-of-select'))
    if (variant !== undefined) {
      // inside one option: continue in its branch
      const branchRoot = trees[/** @type {string} */(node.childrenTrees?.[variant])]?.root
      if (!branchRoot) throw new Error(`no option ${variant} at this path`)
      pointer = branchRoot
      variant = undefined
    }
    if (isSelector && /^\d+$/.test(segment)) {
      if (!node.childrenTrees?.[Number(segment)]) throw new Error(`there is no option ${segment} at this path: describeSchema on the choice lists them`)
      variant = Number(segment)
      continue
    }
    const current = nodes[pointer]
    if (/^\d+$/.test(segment) && current.childrenTrees?.length && !isSelector) {
      // an item of a list, whether it exists or not: the shape of its items
      const itemRoot = trees[current.childrenTrees[0]]?.root
      if (!itemRoot) throw new Error(`no item shape at ${path}`)
      pointer = itemRoot
      dataPath = join(segment)
      continue
    }
    const child = (current.children ?? []).find(childPointer => String(nodes[childPointer]?.key) === segment)
    if (!child) throw new Error(`"${segment}" is not a part of the form at this path`)
    pointer = child
    if (!segment.startsWith('$')) dataPath = join(segment)
  }
  return { pointer, path: dataPath, variant }
}

/**
 * @param {import('../../state/index.js').StatefulLayout} statefulLayout
 * @param {{ path?: string }} args
 * @returns {string}
 */
export function execute (statefulLayout, args) {
  if (!args.path || args.path === '/') return describeFormSchema(statefulLayout.compiledLayout)
  const { pointer, path, variant } = resolveSchemaPath(statefulLayout, args.path)
  return describeFormSchema(statefulLayout.compiledLayout, { pointer, path, variant })
}
