import simple from './simple'
import combine from './combine'
import dev from './_dev'

export const examples: JSONLayoutExamplesCategory[] = [simple, combine, dev]

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
