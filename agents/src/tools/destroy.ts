import { z } from 'zod'
import { tool } from 'ai'
import type { Store, DestroyInput, DestroyResult } from '../types.ts'
import { store } from '../store.ts'

export function destroy (input: DestroyInput, store: Store): DestroyResult {
  if (!input.compiledId && !input.stateId) {
    throw new Error('at least one of compiledId or stateId must be provided')
  }

  const deletedCompiled = input.compiledId ? store.deleteCompiled(input.compiledId) : false
  const deletedState = input.stateId ? store.deleteState(input.stateId) : false

  return { deletedCompiled, deletedState }
}

const description = 'Destroy a stored compiled layout and/or stateful layout by ID to free resources. Provide at least one of compiledId or stateId.'

const inputSchema = z.object({
  compiledId: z.string().optional().describe('ID of a compiled layout to destroy'),
  stateId: z.string().optional().describe('ID of a stateful layout to destroy')
})

const outputSchema = z.object({
  deletedCompiled: z.boolean(),
  deletedState: z.boolean()
})

const execute = async (params: z.infer<typeof inputSchema>) => {
  return destroy(params, store)
}

const createTool = () => tool({ description, inputSchema, outputSchema, execute })

export { description, inputSchema, outputSchema, execute, createTool }

export default { description, inputSchema, outputSchema, execute, createTool }
