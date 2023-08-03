import produce from 'immer'
import { type Mode } from '.'
import { type StateNode } from './state-node'

export interface StateTree {
  root: StateNode
  mode: Mode
  valid: boolean
  title: string
}

// use Immer for efficient updating with immutability and no-op detection
export const produceStateTree = produce<StateTree, [StateNode, Mode, boolean, string]>(
  (draft, root, mode, valid, title) => {
    draft.root = root
    draft.mode = mode
    draft.valid = valid
    draft.title = title
  }
)
