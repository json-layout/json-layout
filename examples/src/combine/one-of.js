/** @type {import("../types.js").JSONLayoutExample } */
const example = {
  title: 'One of',
  id: 'one-of',
  description: 'A oneOf keyword on an object property is transformed into a select to chose the active subschema.',
  schema: {
    type: 'object',
    title: 'An object with a oneOf',
    oneOfLayout: {
      label: 'Select a subschema',
      oneOfItems: ['Sub schema 1', { header: true, title: 'A select header' }, 'Sub schema 2']
    },
    oneOf: [
      {
        title: 'oneOf 1',
        required: ['str1'],
        properties: { key: { const: 'oneOf1' }, str1: { type: 'string' } }
      },
      {
        title: 'oneOf 2',
        required: ['str2'],
        properties: { key: { const: 'oneOf2' }, str2: { type: 'string' } }
      }
    ]
  }
}

export default example
