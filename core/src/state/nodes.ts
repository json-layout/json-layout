import { type TextField, type Textarea, type Section, type NumberField, type OneOfSelect, type Select, type Checkbox, type Switch, type Tabs, type VerticalTabs, type ExpansionPanels, type Slider, type DatePicker, type DateTimePicker, type TimePicker, type ColorPicker } from '@json-layout/vocabulary'
import { type StateNode } from './state-node'
import { type SkeletonTree } from '../compile'

export type TextFieldNode = Omit<StateNode, 'children'> & { layout: TextField, data: string | undefined | null }

export type TextareaNode = Omit<StateNode, 'children'> & { layout: Textarea, data: string | undefined | null }

export type NumberFieldNode = Omit<StateNode, 'children'> & { layout: NumberField, data: number | undefined | null }

export type SliderNode = Omit<StateNode, 'children'> & { layout: Slider, data: number | undefined | null }

export type CheckboxNode = Omit<StateNode, 'children'> & { layout: Checkbox, data: boolean | undefined | null }

export type SwitchNode = Omit<StateNode, 'children'> & { layout: Switch, data: boolean | undefined | null }

export type DatePickerNode = Omit<StateNode, 'children'> & { layout: DatePicker, data: string | undefined | null }

export type DateTimePickerNode = Omit<StateNode, 'children'> & { layout: DateTimePicker, data: string | undefined | null }

export type TimePickerNode = Omit<StateNode, 'children'> & { layout: TimePicker, data: string | undefined | null }

export type ColorPickerNode = Omit<StateNode, 'children'> & { layout: ColorPicker, data: string | undefined | null }

export type SectionNode = StateNode & { layout: Section, children: StateNode[] }
export const isSection = (node: StateNode | undefined): node is SectionNode => !!node && node.layout.comp === 'section'

export type OneOfSelectNode = StateNode & { layout: OneOfSelect, data: Record<string, unknown>, childrenTrees: SkeletonTree[] }

export type SelectNode = Omit<StateNode, 'children'> & { layout: Select, data: any }
export const isSelect = (node: StateNode | undefined): node is SelectNode => !!node && node.layout.comp === 'select'

export type TabsNode = StateNode & { layout: Tabs, children: StateNode[] }

export type VerticalTabsNode = StateNode & { layout: VerticalTabs, children: StateNode[] }

export type ExpansionPanelsNode = StateNode & { layout: ExpansionPanels, children: StateNode[] }
