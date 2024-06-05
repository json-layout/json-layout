/** @type {import("../types.js").JSONLayoutExample } */
const example = {
  title: 'All of',
  id: 'all-of',
  description: 'A allOf keyword on an object property is transformed into an array of sections.',
  schema: {
    type: 'object',
    title: 'An object with a allOf',
    allOf: [
      {
        title: 'allOf 1',
        required: ['str1'],
        properties: { str1: { type: 'string' } }
      },
      {
        title: 'allOf 2',
        required: ['str2'],
        properties: { str2: { type: 'string' } }
      }
    ]
  }
}

export default example
