import { z } from 'zod'
import { tool } from 'ai'
import type { Store, DescribeStateInput, DescribeStateResult } from '../types.ts'
import { projectStateTree, projectNode, collectErrors } from '../projection.ts'
import { resolveNode } from '../node-resolution.ts'
import { store } from '../store.ts'
import { errorsSchema } from './schemas.ts'

export function describeState (input: DescribeStateInput, store: Store): DescribeStateResult {
  const statefulLayout = store.getState(input.stateId)
  if (!statefulLayout) {
    throw new Error(`stateful layout not found: ${input.stateId}`)
  }

  const errors = collectErrors(statefulLayout.stateTree.root)

  if (input.path) {
    const node = resolveNode(statefulLayout.stateTree.root, input.path)
    if (!node) {
      throw new Error(`node not found at path: ${input.path}`)
    }
    return {
      state: projectNode(node),
      valid: statefulLayout.valid,
      errors
    }
  }

  return {
    state: projectStateTree(statefulLayout.stateTree),
    valid: statefulLayout.valid,
    errors
  }
}

const description = 'Describe the current state tree. Optionally focus on a subtree by path to reduce output size.'

const inputSchema = z.object({
  stateId: z.string().describe('ID of the stateful layout'),
  path: z.string().optional().describe('Path to a specific node (e.g. "/address/city"). Omit for full tree.')
})

const outputSchema = z.object({
  state: z.any().describe('Projected state tree or single node'),
  valid: z.boolean(),
  errors: errorsSchema
})

const execute = async (params: z.infer<typeof inputSchema>) => {
  return describeState(params, store)
}

const createTool = () => tool({ description, inputSchema, outputSchema, execute })

export { description, inputSchema, outputSchema, execute, createTool }

export default { description, inputSchema, outputSchema, execute, createTool }
