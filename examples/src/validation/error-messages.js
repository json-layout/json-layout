/** @type {import("../types.js").JSONLayoutExample } */
const example = {
  title: 'Custom error messages',
  id: 'error-messages',
  description: 'It is possible to overwrite standard error messages thanks to [ajv-errors](https://ajv.js.org/packages/ajv-errors.html).',
  schema: {
    type: 'object',
    required: ['str1'],
    properties: {
      str1: {
        type: 'string',
        title: 'A string property that only accepts uppercase letters',
        pattern: '^[A-Z]+$',
        errorMessage: 'use uppercase letters only'
      }
    }
  },
  options: {
    initialValidation: 'always'
  }
}

export default example
