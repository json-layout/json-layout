import { z } from 'zod'
import { tool } from 'ai'
import type { Store, SetDataInput, SetDataResult } from '../types.ts'
import { projectStateTree, collectErrors } from '../projection.ts'
import { store } from '../store.ts'
import { stateTreeSchema, errorsSchema } from './schemas.ts'

export function setData (input: SetDataInput, store: Store): SetDataResult {
  const statefulLayout = store.getState(input.stateId)
  if (!statefulLayout) {
    throw new Error(`stateful layout not found: ${input.stateId}`)
  }

  let data = input.data
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data)
    } catch (e) {}
  }
  statefulLayout.data = input.data

  return {
    state: projectStateTree(statefulLayout.stateTree),
    valid: statefulLayout.valid,
    errors: collectErrors(statefulLayout.stateTree.root)
  }
}

const description = 'Set the entire form data at once (bulk update). Returns the updated state tree and validation errors.'

const inputSchema = z.object({
  stateId: z.string().describe('ID of the stateful layout'),
  data: z.any().describe('The complete data object to set')
})

const outputSchema = z.object({
  state: stateTreeSchema,
  valid: z.boolean(),
  errors: errorsSchema
})

const execute = async (params: z.infer<typeof inputSchema>) => {
  return setData(params as SetDataInput, store)
}

const createTool = () => tool({ description, inputSchema, outputSchema, execute })

export { description, inputSchema, outputSchema, execute, createTool }

export default { description, inputSchema, outputSchema, execute, createTool }
