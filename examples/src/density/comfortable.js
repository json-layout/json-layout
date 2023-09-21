/** @type {import("../types.js").JSONLayoutExample } */
const example = {
  title: 'Comfortable',
  id: 'comfortable',
  description: 'The comfortable density is a well balanced middleground.',
  options: { density: 'comfortable' },
  schema: {
    type: 'object',
    title: 'A section',
    properties: {
      str1: { type: 'string', title: 'String 1' },
      str2: { type: 'string', title: 'String 2', layout: 'textarea' }
    }
  }
}

export default example
