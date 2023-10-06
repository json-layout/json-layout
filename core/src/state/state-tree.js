import { produce } from 'immer'
import { createStateNode } from './state-node.js'

/** @type {(draft: import('./types.js').StateTree, root: import('./types.js').StateNode, valid: boolean) => any} */
const produceStateTree = produce(
  (draft, root, valid) => {
    draft.root = root
    draft.valid = valid
  }
)

/**
 * @param {import('./types.js').CreateStateTreeContext} context
 * @param {import('./types.js').StatefulLayoutOptions} options
 * @param {import('../index.js').CompiledLayout} compiledLayout
 * @param {import('../index.js').SkeletonTree} skeleton
 * @param {import('./utils/display.js').Display} display
 * @param {unknown} value
 * @param {import('./types.js').StateTree} [reusedStateTree]
 * @returns {import('./types.js').StateTree}
 */
export function createStateTree (
  context,
  options,
  compiledLayout,
  skeleton,
  display,
  value,
  reusedStateTree
) {
  const validate = compiledLayout.validates[skeleton.root.pointer]
  const valid = validate(value)
  if (validate.errors) {
    for (const error of validate.errors) {
      if (error.keyword !== 'errorMessage') compiledLayout.localizeErrors([error])
    }
    context.errors = validate.errors
  }
  const root = createStateNode(
    context,
    options,
    compiledLayout,
    '',
    '',
    null,
    '',
    null,
    skeleton.root,
    null,
    display,
    value,
    reusedStateTree?.root
  )

  return produceStateTree(reusedStateTree ?? /** @type {import('./types.js').StateTree} */({}), root, valid)
}
