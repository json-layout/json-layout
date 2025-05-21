import schema from './schema.js'
import { ajv } from '../validate.js'

export const /** @type {import('../types.js').ValidateNormalizedLayout} */ validateNormalizedLayout = /** @type {any} */ (ajv.getSchema(schema.$id))

export const normalizedLayoutSchema = /** @type {any} */ (schema)
