import { type NormalizedLayout } from './types'
import validate from './validate'

export * from './types'

interface ValidateNormalizedLayout {
  errors: any
  (layoutKeyword: any): layoutKeyword is NormalizedLayout
}
export const validateNormalizedLayout = validate as ValidateNormalizedLayout
