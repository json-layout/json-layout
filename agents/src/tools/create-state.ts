import { z } from 'zod'
import { tool } from 'ai'
import { StatefulLayout } from '@json-layout/core/state'
import type { Store, CreateStateInput, CreateStateResult } from '../types.ts'
import { projectStateTree } from '../projection.ts'
import { store } from '../store.ts'
import { stateTreeSchema } from './schemas.ts'

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
    validateOn: 'input' as const,
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

const description = 'Create a StatefulLayout from a compiled layout. Returns the initial state tree projected for agent consumption.'

const inputSchema = z.object({
  compiledId: z.string().describe('ID of a previously compiled layout'),
  data: z.unknown().optional().describe('Initial data to populate the form'),
  options: z.record(z.unknown()).optional().describe('StatefulLayout options (readOnly, validateOn, etc.)')
})

const outputSchema = z.object({
  stateId: z.string(),
  state: stateTreeSchema
})

const execute = async (params: z.infer<typeof inputSchema>) => {
  return createState(params, store)
}

const createTool = () => tool({ description, inputSchema, outputSchema, execute })

export { description, inputSchema, outputSchema, execute, createTool }

export default { description, inputSchema, outputSchema, execute, createTool }
