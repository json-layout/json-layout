/** @type {import("../types.js").JSONLayoutExample } */
const example = {
  title: 'Objects as items',
  id: 'object-items',
  description: 'The items can also be complex objects.',
  schema: {
    type: 'object',
    properties: {
      objArray1: {
        type: 'array',
        title: 'An array of objects',
        items: {
          type: 'object',
          title: 'Object item',
          properties: {
            str1: { type: 'string', title: 'String 1' },
            str2: { type: 'string', title: 'String 2' }
          }
        }
      }
    }
  }
}

export default example
