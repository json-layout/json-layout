import { type TextField, type Section, type NumberField, type OneOfSelect, type Select } from '@json-layout/vocabulary'
import { type StateNode } from './state-node'
import { type SkeletonTree } from '../compile'

export type TextFieldNode = Omit<StateNode, 'children'> & { layout: TextField, value: string }
export const isTextField = (node: StateNode | undefined): node is TextFieldNode => !!node && node.layout.comp === 'text-field'

export type NumberFieldNode = Omit<StateNode, 'children'> & { layout: NumberField, value: number }
export const isNumberField = (node: StateNode | undefined): node is NumberFieldNode => !!node && node.layout.comp === 'number-field'

export type SectionNode = StateNode & { layout: Section, value: Record<string, unknown>, children: StateNode[] }
export const isSection = (node: StateNode | undefined): node is SectionNode => !!node && node.layout.comp === 'section'

export type OneOfSelectNode = StateNode & { layout: OneOfSelect, value: Record<string, unknown>, childrenTrees: SkeletonTree[] }
export const isOneOfSelect = (node: StateNode | undefined): node is OneOfSelectNode => !!node && node.layout.comp === 'one-of-select'

export type SelectNode = Omit<StateNode, 'children'> & { layout: Select, value: any }
export const isSelect = (node: StateNode | undefined): node is SelectNode => !!node && node.layout.comp === 'select'
