import { z } from 'zod'
import { tool } from 'ai'
import type { Store, GetDataInput, GetDataResult } from '../types.ts'
import { store } from '../store.ts'

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

const description = 'Get the current form data and validity status.'

const inputSchema = z.object({
  stateId: z.string().describe('ID of the stateful layout')
})

const outputSchema = z.object({
  data: z.unknown(),
  valid: z.boolean()
})

const execute = async (params: z.infer<typeof inputSchema>) => {
  return getData(params, store)
}

const createTool = () => tool({ description, inputSchema, outputSchema, execute })

export { description, inputSchema, outputSchema, execute, createTool }

export default { description, inputSchema, outputSchema, execute, createTool }
