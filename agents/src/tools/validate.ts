import { z } from 'zod'
import { tool } from 'ai'
import type { Store, ValidateStateInput, ValidateStateResult } from '../types.ts'
import { collectErrors } from '../projection.ts'
import { store } from '../store.ts'
import { errorsSchema } from './schemas.ts'

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

const description = 'Trigger full form validation and return all errors with their paths, plus the current data.'

const inputSchema = z.object({
  stateId: z.string().describe('ID of the stateful layout')
})

const outputSchema = z.object({
  valid: z.boolean(),
  errors: errorsSchema,
  data: z.unknown()
})

const execute = async (params: z.infer<typeof inputSchema>) => {
  return validateState(params, store)
}

const createTool = () => tool({ description, inputSchema, outputSchema, execute })

export { description, inputSchema, outputSchema, execute, createTool }

export default { description, inputSchema, outputSchema, execute, createTool }
