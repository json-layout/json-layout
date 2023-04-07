import basic from './basic'

export const examples: JSONLayoutExamplesCategory[] = [basic]

export interface JSONLayoutExamplesCategory {
  title: string
  id: string
  examples: JSONLayoutExample[]
}

export interface JSONLayoutExample {
  title: string
  id: string
  description: string
  schema: any
  devOnly?: boolean
}
