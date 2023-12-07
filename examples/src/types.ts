export interface JSONLayoutExamplesCategory {
  title: string
  id: string
  description: string
  examples: JSONLayoutExample[]
}

export interface JSONLayoutExample {
  title: string
  id: string
  description: string
  warning?: string
  options?: any
  schema: any
  codeSlots?: string[]
  data?: any
  devOnly?: boolean
}
