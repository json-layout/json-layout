/** @type {import("../types.js").JSONLayoutExample } */
const example = {
  title: 'Simple errors',
  id: 'simple-errors',
  description: 'Errors on a simple property trigger a different rendering and the message is displayed.',
  schema: {
    type: 'object',
    required: ['str1'],
    properties: {
      str1: { type: 'string', title: 'A string property that only accepts uppercase letters', pattern: '^[A-Z]+$' }
    }
  },
  options: {
    initialValidation: 'always'
  }
}

export default example
