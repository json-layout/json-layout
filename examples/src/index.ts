import simpleFields from './simple-fields'
import composite from './composite'
import combine from './combine'
import responsive from './responsive'
import density from './density'
import dev from './_dev'

export const examples: JSONLayoutExamplesCategory[] = [simpleFields, composite, responsive, density, combine, dev]

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
  options?: any
  schema: any
  devOnly?: boolean
}
