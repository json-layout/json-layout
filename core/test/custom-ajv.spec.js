import { describe, it } from 'node:test'
import { compile } from '../src/index.js'
import ajvModule from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import ajvErrors from 'ajv-errors'

// @ts-ignore
const Ajv = /** @type {typeof ajvModule.default} */ (ajvModule)

describe('custom ajv in options', () => {
  it('makes it possible to accept different schema version', async () => {
    const ajv = new Ajv({ allErrors: true, verbose: true })
    addFormats.default(ajv)
    ajvErrors.default(ajv)
    await compile({ $schema: 'https://json-schema.org/draft/2020-12/schema', type: 'object', properties: {} }, { ajv })
    await compile({ $schema: 'https://json-schema.org/draft/2020-12/schema', type: 'object', properties: {} }, { ajv })
  })
})
