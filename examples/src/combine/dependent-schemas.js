/** @type {import("../types.js").JSONLayoutExample } */
const example = {
  title: 'Dependent schemas',
  id: 'dependent-schemas',
  description: 'The JSON schema dependentSchemas keyword is interpreted.',
  schema: {
    type: 'object',
    title: 'An object with a string that depends on another',
    properties: {
      str1: { type: 'string' }
    },
    dependentSchemas: {
      str1: {
        properties: {
          str2: { type: 'string' }
        }
      }
    }
  }
}

export default example
