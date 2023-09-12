import { type TextField, type Textarea, type Section, type NumberField, type OneOfSelect, type Select, type Checkbox, type Switch, type Tabs, type VerticalTabs, type ExpansionPanels } from '@json-layout/vocabulary'
import { type StateNode } from './state-node'
import { type SkeletonTree } from '../compile'

export type TextFieldNode = Omit<StateNode, 'children'> & { layout: TextField, data: string }

export type TextareaNode = Omit<StateNode, 'children'> & { layout: Textarea, data: string }

export type NumberFieldNode = Omit<StateNode, 'children'> & { layout: NumberField, data: number }

export type CheckboxNode = Omit<StateNode, 'children'> & { layout: Checkbox, data: boolean }

export type SwitchNode = Omit<StateNode, 'children'> & { layout: Switch, data: boolean }

export type SectionNode = StateNode & { layout: Section, children: StateNode[] }
export const isSection = (node: StateNode | undefined): node is SectionNode => !!node && node.layout.comp === 'section'

export type OneOfSelectNode = StateNode & { layout: OneOfSelect, data: Record<string, unknown>, childrenTrees: SkeletonTree[] }

export type SelectNode = Omit<StateNode, 'children'> & { layout: Select, data: any }
export const isSelect = (node: StateNode | undefined): node is SelectNode => !!node && node.layout.comp === 'select'

export type TabsNode = StateNode & { layout: Tabs, children: StateNode[] }

export type VerticalTabsNode = StateNode & { layout: VerticalTabs, children: StateNode[] }

export type ExpansionPanelsNode = StateNode & { layout: ExpansionPanels, children: StateNode[] }
