import type { Store, SetFieldValueInput, SetFieldValueResult } from '../types.ts'
import { projectStateTree, collectErrors } from '../projection.ts'
import { resolveNode } from '../node-resolution.ts'

export function setFieldValue (input: SetFieldValueInput, store: Store): SetFieldValueResult {
  const statefulLayout = store.getState(input.stateId)
  if (!statefulLayout) {
    throw new Error(`stateful layout not found: ${input.stateId}`)
  }

  const node = resolveNode(statefulLayout.stateTree.root, input.path)
  if (!node) {
    throw new Error(`node not found at path: ${input.path}`)
  }

  // for oneOf nodes, use activateItem instead of input
  if (node.key === '$oneOf' && typeof input.value === 'number') {
    statefulLayout.activateItem(node, input.value)
  } else {
    statefulLayout.input(node, input.value)
  }

  return {
    state: projectStateTree(statefulLayout.stateTree),
    valid: statefulLayout.valid,
    errors: collectErrors(statefulLayout.stateTree.root)
  }
}
