import { type TextField, type Textarea, type Section, type NumberField, type OneOfSelect, type Select, type Checkbox, type Switch } from '@json-layout/vocabulary'
import { type StateNode } from './state-node'
import { type SkeletonTree } from '../compile'

export type TextFieldNode = Omit<StateNode, 'children'> & { layout: TextField, data: string }

export type TextareaNode = Omit<StateNode, 'children'> & { layout: Textarea, data: string }

export type NumberFieldNode = Omit<StateNode, 'children'> & { layout: NumberField, data: number }

export type CheckboxNode = Omit<StateNode, 'children'> & { layout: Checkbox, data: boolean }

export type SwitchNode = Omit<StateNode, 'children'> & { layout: Switch, data: boolean }

export type SectionNode = StateNode & { layout: Section, data: Record<string, unknown>, children: StateNode[] }

export type OneOfSelectNode = StateNode & { layout: OneOfSelect, data: Record<string, unknown>, childrenTrees: SkeletonTree[] }

export type SelectNode = Omit<StateNode, 'children'> & { layout: Select, data: any }
export const isSelect = (node: StateNode | undefined): node is SelectNode => !!node && node.layout.comp === 'select'
