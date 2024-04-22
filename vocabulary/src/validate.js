import ajvModule from 'ajv/dist/2019.js'
import addFormats from 'ajv-formats'
import ajvErrors from 'ajv-errors'
import layoutKeyword from './layout-keyword/schema.js'
import normalizedLayout from './normalized-layout/schema.js'
import { getComponentSchema } from './components/index.js'

// fix some broken typing of ajv
// @ts-ignore
const Ajv = /** @type {typeof ajvModule.default} */ (ajvModule)

export const ajv = new Ajv({
  code: {
    source: true,
    esm: true
    // optimize: true
  },
  discriminator: true,
  allowMatchingProperties: true,
  allowUnionTypes: true,
  allErrors: true
})

addFormats.default(ajv)
ajvErrors.default(ajv)

ajv.addSchema(layoutKeyword)
ajv.addSchema(normalizedLayout)

/** @type {Record<string, import('ajv').ValidateFunction>} */
const componentsValidateCache = {}

/**
 * @param {import('./types.js').ComponentInfo} component
 * @returns {import('ajv').ValidateFunction}
 */
export function getComponentValidate (component) {
  if (componentsValidateCache[component.name]) return componentsValidateCache[component.name]
  const schema = getComponentSchema(component)
  componentsValidateCache[component.name] = ajv.compile(schema)
  return componentsValidateCache[component.name]
}
