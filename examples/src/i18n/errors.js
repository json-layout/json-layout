/** @type {import("../types.js").JSONLayoutExample } */
const example = {
  title: 'Translated errors',
  id: 'errors',
  description: 'Error messages are written by json-layout in English and French, and translated by [ajv-i18n](https://github.com/ajv-validator/ajv-i18n) in the other languages.',
  schema: {
    type: 'object',
    required: ['str1'],
    properties: {
      str1: {
        type: 'string',
        title: 'A string property that only accepts uppercase letters',
        pattern: '^[A-Z]+$'
      }
    }
  },
  options: {
    initialValidation: 'always',
    locale: 'fr'
  }
}

export default example
