import basic from './basic'

export const examples: JSONLayoutExamplesCategory[] = [basic]

export interface JSONLayoutExamplesCategory {
  title: string
  examples: JSONLayoutExample[]
}

export interface JSONLayoutExample {
  title: string
  description: string
  schema: any
  devOnly?: boolean
}
