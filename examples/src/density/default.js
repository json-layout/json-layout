/** @type {import("../types.js").JSONLayoutExample } */
const example = {
  title: 'Default',
  id: 'default',
  description: 'The default density is very low, titles are big and there are large white spaces.',
  options: { density: 'default' },
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
