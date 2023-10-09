/** @type {import("../types.js").JSONLayoutExample } */
const example = {
  title: 'Messages',
  id: 'messages',
  description: 'JSON layout uses a few messages by itself. These messages are internationalized and can be overwritten through `options.localeMessages`.',
  schema: {
    type: 'object',
    title: 'A oneOf',
    oneOf: [{
      properties: {
        str1: {
          type: 'string',
          const: 'key1'
        }
      }
    }, {
      properties: {
        str1: {
          type: 'string',
          const: 'key2'
        }
      }
    }]
  },
  options: {
    initialValidation: 'always',
    locale: 'fr',
    localeMessages: {
      errorOneOf: 'Choisissez une valeur une fois'
    }
  }
}

export default example
