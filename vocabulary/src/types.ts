import { type LayoutKeyword } from './layout-keyword/types.js'

export interface SchemaFragment {
  layout?: LayoutKeyword
  oneOfLayout?: LayoutKeyword
  type: string
  format?: string
  title?: string
  properties?: Record<string, any>
  oneOf?: any[]
  anyOf?: any[]
  allOf?: any[]
  items?: any
  enum?: any[]
  minimum?: number
  maximum?: number
  formatMinimum?: string
  formatMaximum?: string
}
