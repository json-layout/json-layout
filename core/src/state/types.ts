import { type ErrorObject } from 'ajv/dist/2019.js'
import {
  type BaseCompObject,
  type Cols,
  type StateNodeOptionsBase,
  type TextField,
  type Textarea,
  type NumberField,
  type Slider,
  type Checkbox,
  type Switch,
  type DatePicker,
  type DateTimePicker,
  type TimePicker,
  type ColorPicker,
  type Section,
  type OneOfSelect,
  type Select,
  type Autocomplete,
  type Tabs,
  type VerticalTabs,
  type ExpansionPanels,
  type Stepper,
  type List,
  type Combobox,
  type FileInput,
  type Card,
  type Child,
  type StateNodePropsLib
} from '@json-layout/vocabulary'
import { type SkeletonTree, type SkeletonNode, type StatefulLayout, type CompiledLayout } from '../index.js'
import { type LocaleMessages } from '../i18n/types.js'

export interface StateNode {
  key: string | number
  fullKey: string
  parentFullKey: string | null
  dataPath: string
  parentDataPath: string | null
  skeleton: SkeletonNode
  layout: BaseCompObject
  cols: Cols
  data: unknown
  error: string | undefined
  childError: boolean | undefined
  validated: boolean
  width: number
  options: StateNodeOptions
  messages: LocaleMessages
  autofocus?: boolean
  autofocusChild?: string | number
  props?: StateNodePropsLib
  itemsCacheKey: any
  children?: StateNode[]
}

export interface StateTree {
  root: StateNode
  valid: boolean
}

export interface CreateStateTreeContext {
  allErrors?: ErrorObject[]
  errors?: ErrorObject[]
  additionalPropertiesErrors?: ErrorObject[]
  files: FileRef[]
  activatedItems: Record<string, string | number>
  autofocusTarget: string | null
  initial: boolean
  rehydrate: boolean
  cacheKeys: Record<string, StateNodeCacheKey>
  rootData: unknown
  nodes: StateNode[]
}

export interface FileRef {
  file: File
  dataPath: string
}

// [parentOptions, compiledLayout, fullKey, skeleton, childDefinition, parentWidth, validated, activatedItems, initial, data]
export type StateNodeCacheKey = [
  StateNodeOptions,
  CompiledLayout,
  string,
  SkeletonNode,
  Child | null,
  number,
  boolean,
  Record<string, string | number>,
  boolean,
  unknown
]

export interface ValidationState {
  initialized: boolean
  validatedForm: boolean
  validatedChildren: string[]
}

// StateNodeOptionsBase come from the vocabulary and should contain all node options that can be set in the layout
export type StateNodeOptions = Required<StateNodeOptionsBase & {
  context: Record<string, any>
  messages: LocaleMessages
  onData: (data: any) => void
  onUpdate: (statefulLayout: StatefulLayout) => void
  onAutofocus: (key: string) => void
}>

export type StatefulLayoutOptions = StateNodeOptions & {
  width: number
}

// TODO: compose types based on component attributes (composite, itemsBased, etc.) ?

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

export type OneOfSelectNode = StateNode & { layout: OneOfSelect, data: Record<string, unknown>, childrenTrees: SkeletonTree[] }

export type SelectNode = Omit<StateNode, 'children'> & { layout: Select, data: any }

export type AutocompleteNode = Omit<StateNode, 'children'> & { layout: Autocomplete, data: any }

export type RadioGroupNode = Omit<StateNode, 'children'> & { layout: Select, data: any }

export type CheckboxGroupNode = Omit<StateNode, 'children'> & { layout: Select, data: any }

export type SwitchGroupNode = Omit<StateNode, 'children'> & { layout: Select, data: any }

export type TabsNode = StateNode & { layout: Tabs, children: StateNode[] }

export type VerticalTabsNode = StateNode & { layout: VerticalTabs, children: StateNode[] }

export type ExpansionPanelsNode = StateNode & { layout: ExpansionPanels, children: StateNode[] }

export type StepperNode = StateNode & { layout: Stepper, children: StateNode[] }

export type ListNode = StateNode & { layout: List, data: any[], children: StateNode[], childrenTrees: SkeletonTree[] }

export type ComboboxNode = Omit<StateNode, 'children'> & { layout: Combobox, data: any[] }

export type FileInputNode = Omit<StateNode, 'children'> & { layout: FileInput, data: object | undefined | null }

export type CardNode = StateNode & { layout: Card, children: StateNode[] }
