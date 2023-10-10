/** @type {import("../types.js").JSONLayoutExample } */
const example = {
  title: 'Messages',
  id: 'messages',
  description: 'JSON layout uses a few messages by itself. These messages are internationalized and can be overwritten through the global options `messages` or locally on a node with `layout.messages`.',
  schema: {
    type: 'array',
    title: 'An array',
    layout: {
      messages: {
        addItem: 'A custom addItem message'
      }
    },
    items: {
      properties: {
        str1: {
          type: 'string',
          const: 'key1'
        }
      }
    }
  }
}

export default example
