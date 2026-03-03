import type { Store, DescribeStateInput, DescribeStateResult } from '../types.ts'
import { projectStateTree, projectNode, collectErrors } from '../projection.ts'
import { resolveNode } from '../node-resolution.ts'

export function describeState (input: DescribeStateInput, store: Store): DescribeStateResult {
  const statefulLayout = store.getState(input.stateId)
  if (!statefulLayout) {
    throw new Error(`stateful layout not found: ${input.stateId}`)
  }

  const errors = collectErrors(statefulLayout.stateTree.root)

  if (input.path) {
    const node = resolveNode(statefulLayout.stateTree.root, input.path)
    if (!node) {
      throw new Error(`node not found at path: ${input.path}`)
    }
    return {
      state: projectNode(node),
      valid: statefulLayout.valid,
      errors
    }
  }

  return {
    state: projectStateTree(statefulLayout.stateTree),
    valid: statefulLayout.valid,
    errors
  }
}
