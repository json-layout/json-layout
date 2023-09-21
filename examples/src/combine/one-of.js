/** @type {import("../types.js").JSONLayoutExample } */
const example = {
  title: 'One of',
  id: 'one-of',
  description: 'A oneOf instructions is transformed into a select to chose the active subschema.',
  schema: {
    type: 'object',
    title: 'An object with a oneOf',
    oneOf: [
      { title: 'oneOf 1', properties: { key: { const: 'oneOf1' }, str1: { type: 'string' } } },
      { title: 'oneOf 2', properties: { key: { const: 'oneOf2' }, str2: { type: 'string' } } }
    ]
  }
}

export default example
