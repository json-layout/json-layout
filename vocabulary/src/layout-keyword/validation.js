import schema from './schema.js'
import { ajv } from '../validate.js'

export const /** @type {import('../types.js').ValidateLayoutKeyword} */ validateLayoutKeyword = /** @type {any} */ (ajv.getSchema(schema.$id))

export const layoutKeywordSchema = /** @type {any} */ (schema)
