/** @type {import("../types.js").JSONLayoutExample } */
const example = {
  title: 'Lists with shared clipboard',
  id: 'clipboard',
  description: 'It is possible to handle copy-pasting items accross lists by using the clipboardKey attribute. In this case it is your responsibility to ensure that the lists that share a common clipboardKey value also share compatible items schemas.',
  schema: {
    type: 'object',
    properties: {
      objArray1: {
        type: 'array',
        title: 'An array of objects',
        layout: {
          clipboardKey: 'clipboard1'
        },
        items: {
          type: 'object',
          title: 'Object item',
          properties: {
            str1: { type: 'string', title: 'String 1' },
            str2: { type: 'string', title: 'String 2' }
          }
        }
      },
      objArray2: {
        type: 'array',
        title: 'An array of objects with same clipboard key',
        layout: {
          clipboardKey: 'clipboard1'
        },
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
  },
  data: {
    objArray1: [{ str1: 'a string', str2: 'another string' }],
    objArray2: []
  }
}

export default example
