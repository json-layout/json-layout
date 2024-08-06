/** @type {import("../types.js").JSONLayoutExample } */
const example = {
  title: 'Editable lists',
  id: 'lists',
  description: 'A more complex list component is also available.',
  schema: {
    type: 'object',
    properties: {
      dateArray1: {
        type: 'array',
        title: 'An array of dates',
        items: {
          type: 'string',
          format: 'date'
        }
      },
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
