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
 * @generator
 * @param {import('./types.js').StateNode} node
 * @yields {import('./types.js').StateNode}
 * @returns {Generator<import('./types.js').StateNode>}
 */
function * traverseNodes (node) {
  yield node
  if (node.children) {
    for (const child of node.children) {
      yield * traverseNodes(child)
    }
  }
}

/**
 * @param {import('./types.js').CreateStateTreeContext} context
 * @param {import('./types.js').StatefulLayoutOptions} options
 * @param {import('../index.js').CompiledLayout} compiledLayout
 * @param {import('../index.js').SkeletonTree} skeleton
 * @param {import('./utils/display.js').Display} display
 * @param {unknown} data
 * @param {import('./types.js').ValidationState} validationState
 * @param {import('./types.js').StateTree} [reusedStateTree]
 * @returns {import('./types.js').StateTree}
 */
export function createStateTree (
  context,
  options,
  compiledLayout,
  skeleton,
  display,
  data,
  validationState,
  reusedStateTree
) {
  const validate = compiledLayout.validates[skeleton.root]
  const valid = validate(data)
  if (validate.errors) {
    for (const error of validate.errors) {
      if (error.keyword !== 'errorMessage') compiledLayout.localizeErrors([error])
    }
    context.errors = validate.errors
    if (context.errors.length) {
      for (const error of context.errors) {
        const originalError = error.params?.errors?.[0] ?? error
        // work around this issue https://github.com/ajv-validator/ajv/issues/512
        if (originalError?.parentSchema.__pointer) {
          originalError.schemaPath = originalError?.parentSchema.__pointer
          if (originalError.keyword === 'oneOf') originalError.schemaPath += '/oneOf'
        }
      }
    }
    if ([true, 'error'].includes(options.removeAdditional)) {
      context.additionalPropertiesErrors = validate.errors.filter(error => error.keyword === 'additionalProperties' || error.keyword === 'unevaluatedProperties')
    }
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
    compiledLayout.skeletonNodes[skeleton.root],
    null,
    display,
    data,
    null,
    validationState,
    reusedStateTree?.root
  )

  context.nodes = []
  context.files = []
  for (const node of traverseNodes(root)) {
    context.nodes.push(node)
    if (node.data instanceof File) {
      context.files.push({ dataPath: node.dataPath, file: node.data })
    }
  }

  return produceStateTree(reusedStateTree ?? /** @type {import('./types.js').StateTree} */({}), root, valid)
}
