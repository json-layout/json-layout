import type { Store, ValidateStateInput, ValidateStateResult } from '../types.ts'
import { collectErrors } from '../projection.ts'

export function validateState (input: ValidateStateInput, store: Store): ValidateStateResult {
  const statefulLayout = store.getState(input.stateId)
  if (!statefulLayout) {
    throw new Error(`stateful layout not found: ${input.stateId}`)
  }

  statefulLayout.validate()

  return {
    valid: statefulLayout.valid,
    errors: collectErrors(statefulLayout.stateTree.root),
    data: statefulLayout.data
  }
}
