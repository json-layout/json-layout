import { StatefulLayout } from '@json-layout/core/state'
import type { Store, CreateStateInput, CreateStateResult } from '../types.ts'
import { projectStateTree } from '../projection.ts'

export function createState (input: CreateStateInput, store: Store): CreateStateResult {
  const compiledLayout = store.getCompiled(input.compiledId)
  if (!compiledLayout) {
    throw new Error(`compiled layout not found: ${input.compiledId}`)
  }

  const mainTree = compiledLayout.skeletonTrees[compiledLayout.mainTree]
  if (!mainTree) {
    throw new Error(`main skeleton tree not found: ${compiledLayout.mainTree}`)
  }

  const options = {
    ...input.options,
    // override options for agent use: immediate validation feedback
    validateOn: 'input' as const,
    // no debouncing in programmatic mode
    debounceInputMs: 0
  }

  const statefulLayout = new StatefulLayout(
    compiledLayout,
    mainTree,
    options,
    input.data
  )

  const stateId = store.generateId()
  store.setState(stateId, statefulLayout)

  return {
    stateId,
    state: projectStateTree(statefulLayout.stateTree)
  }
}
