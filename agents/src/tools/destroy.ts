import type { Store, DestroyInput, DestroyResult } from '../types.ts'

export function destroy (input: DestroyInput, store: Store): DestroyResult {
  if (!input.compiledId && !input.stateId) {
    throw new Error('at least one of compiledId or stateId must be provided')
  }

  const deletedCompiled = input.compiledId ? store.deleteCompiled(input.compiledId) : false
  const deletedState = input.stateId ? store.deleteState(input.stateId) : false

  return { deletedCompiled, deletedState }
}
