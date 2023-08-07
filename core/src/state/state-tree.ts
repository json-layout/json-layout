import produce from 'immer'
import { type Mode } from '.'
import { createStateNode, type StateNode } from './state-node'
import { type CompiledLayout, type SkeletonTree } from '../compile'
import { type ErrorObject } from 'ajv'
import { type Display } from './utils/display'

export interface StateTree {
  root: StateNode
  mode: Mode
  valid: boolean
  title: string
}

export interface CreateStateTreeContext {
  errors?: ErrorObject[]
  nodes: StateNode[]
}

// use Immer for efficient updating with immutability and no-op detection
const produceStateTree = produce<StateTree, [StateNode, Mode, boolean]>(
  (draft, root, mode, valid) => {
    draft.root = root
    draft.mode = mode
    draft.valid = valid
  }
)

export function createStateTree (
  context: CreateStateTreeContext,
  compiledLayout: CompiledLayout,
  skeleton: SkeletonTree,
  mode: Mode,
  display: Display,
  value: unknown,
  reusedStateTree?: StateTree
) {
  const validate = compiledLayout.validates[skeleton.root.pointer]
  const valid = validate(value)
  if (validate.errors) context.errors = validate.errors
  const root = createStateNode(
    context,
    compiledLayout,
    '',
    '',
    null,
    '',
    null,
    skeleton.root,
    mode,
    display,
    value,
    reusedStateTree?.root
  )

  return produceStateTree(reusedStateTree ?? ({} as StateTree), root, mode, valid)
}
