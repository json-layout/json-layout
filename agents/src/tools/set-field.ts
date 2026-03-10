import { z } from 'zod'
import { tool } from 'ai'
import type { Store, SetFieldValueInput, SetFieldValueResult } from '../types.ts'
import { projectStateTree, collectErrors } from '../projection.ts'
import { resolveNode } from '../node-resolution.ts'
import { store } from '../store.ts'
import { stateTreeSchema, errorsSchema } from './schemas.ts'

export function setFieldValue (input: SetFieldValueInput, store: Store): SetFieldValueResult {
  const statefulLayout = store.getState(input.stateId)
  if (!statefulLayout) {
    throw new Error(`stateful layout not found: ${input.stateId}`)
  }

  const node = resolveNode(statefulLayout.stateTree.root, input.path)
  if (!node) {
    throw new Error(`node not found at path: ${input.path}`)
  }

  if (node.key === '$oneOf' && typeof input.value === 'number') {
    statefulLayout.activateItem(node, input.value)
  } else {
    statefulLayout.input(node, input.value)
  }

  return {
    state: projectStateTree(statefulLayout.stateTree),
    valid: statefulLayout.valid,
    errors: collectErrors(statefulLayout.stateTree.root)
  }
}

const description = 'Set the value of a specific field by path. For oneOf nodes, pass the variant index as value to switch variants.'

const inputSchema = z.object({
  stateId: z.string().describe('ID of the stateful layout'),
  path: z.string().describe('Path to the field (e.g. "/name", "/items/0/quantity")'),
  value: z.any().describe('The value to set')
})

const outputSchema = z.object({
  state: stateTreeSchema,
  valid: z.boolean(),
  errors: errorsSchema
})

const execute = async (params: z.infer<typeof inputSchema>) => {
  return setFieldValue(params as SetFieldValueInput, store)
}

const createTool = () => tool({ description, inputSchema, outputSchema, execute })

export { description, inputSchema, outputSchema, execute, createTool }

export default { description, inputSchema, outputSchema, execute, createTool }
