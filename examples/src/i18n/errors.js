/** @type {import("../types.js").JSONLayoutExample } */
const example = {
  title: 'Translated errors',
  id: 'errors',
  description: 'Error messages are written by json-layout in English, French, German, Dutch, Spanish, Italian and Portuguese. The other languages fallback to English, like the other messages of the form.',
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
