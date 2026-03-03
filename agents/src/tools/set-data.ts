import type { Store, SetDataInput, SetDataResult } from '../types.ts'
import { projectStateTree, collectErrors } from '../projection.ts'

export function setData (input: SetDataInput, store: Store): SetDataResult {
  const statefulLayout = store.getState(input.stateId)
  if (!statefulLayout) {
    throw new Error(`stateful layout not found: ${input.stateId}`)
  }

  statefulLayout.data = input.data

  return {
    state: projectStateTree(statefulLayout.stateTree),
    valid: statefulLayout.valid,
    errors: collectErrors(statefulLayout.stateTree.root)
  }
}
