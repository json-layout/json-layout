import { type LayoutKeyword } from './layout-keyword/types.js'

export interface SchemaFragment {
  layout?: LayoutKeyword
  oneOfLayout?: LayoutKeyword
  type: string
  format?: string
  title?: string
  description?: string
  properties?: Record<string, any>
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
}
