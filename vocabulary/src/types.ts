import { type LayoutKeyword } from './layout-keyword/types.js'
import { type NormalizedLayout } from './normalized-layout/types.js'

export interface NormalizeMessages {
  default: string
  name: string
  examples: string
  deprecated: string
}

export interface NormalizeOptions {
  messages: NormalizeMessages,
  optionsKeys?: string[]
  components: Record<string, ComponentInfo>
  markdown: (text: string) => string
  useDescription: Array<'help' | 'hint' | 'subtitle'>
  useTitle?: boolean | 'label' | 'hint' | 'placeholder' | 'help'
  useName: boolean | 'hint' | 'placeholder' | 'help'
  useExamples: boolean | 'items' | 'help'
  useDeprecated: boolean
  useDefault: boolean | 'data' | 'placeholder' | 'hint'
}

export interface SchemaFragment {
  layout?: LayoutKeyword
  oneOfLayout?: LayoutKeyword
  patternPropertiesLayout?: LayoutKeyword
  type?: string | string[]
  format?: string
  title?: string
  description?: string
  properties?: Record<string, any>
  patternProperties?: Record<string, any>
  oneOf?: any[]
  anyOf?: any[]
  allOf?: any[]
  items?: any
  enum?: any[]
  examples?: any[]
  minimum?: number
  maximum?: number
  formatMinimum?: string
  formatMaximum?: string
  readOnly?: boolean
  if?: any
  then?: any
  else?: any
  dependencies?: Record<string, any>
  dependentSchemas?: Record<string, any>
  default?: any
  deprecated?: boolean
}

export interface ComponentInfo {
  name: string
  composite?: boolean
  shouldDebounce?: boolean
  emitsBlur?: boolean
  focusable?: boolean
  itemsBased?: boolean
  multipleCompat?: boolean
  schema?: any
  isFileInput?: boolean
  hintable?: boolean
}

export interface ValidateLayoutKeyword {
  (layoutKeyword: any): layoutKeyword is LayoutKeyword
  errors: any
}

export interface ValidateNormalizedLayout {
  (layout: any): layout is NormalizedLayout
  errors: any
}