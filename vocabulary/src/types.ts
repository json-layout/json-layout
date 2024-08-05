import { type LayoutKeyword } from './layout-keyword/types.js'

export interface SchemaFragment {
  layout?: LayoutKeyword
  oneOfLayout?: LayoutKeyword
  patternPropertiesLayout?: LayoutKeyword
  patternPropertiesKeyLayout?: LayoutKeyword
  type: string
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
  labelOptional?: boolean
}
