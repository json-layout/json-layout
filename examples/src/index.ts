import simple from './simple'
import dev from './_dev'

export const examples: JSONLayoutExamplesCategory[] = [simple, dev]

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
