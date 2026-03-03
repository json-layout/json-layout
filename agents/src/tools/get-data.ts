import type { Store, GetDataInput, GetDataResult } from '../types.ts'

export function getData (input: GetDataInput, store: Store): GetDataResult {
  const statefulLayout = store.getState(input.stateId)
  if (!statefulLayout) {
    throw new Error(`stateful layout not found: ${input.stateId}`)
  }

  return {
    data: statefulLayout.data,
    valid: statefulLayout.valid
  }
}
