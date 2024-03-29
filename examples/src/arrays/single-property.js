/** @type {import("../types.js").JSONLayoutExample } */
const example = {
  title: 'Simple property as items',
  id: 'single-property',
  description: 'Any field can be displayed as items in a list.',
  schema: {
    type: 'object',
    properties: {
      strArray1: {
        type: 'array',
        title: 'An array of strings',
        items: { type: 'string', title: 'String item' }
      },
      nbArray1: {
        type: 'array',
        title: 'An array of numbers',
        items: { type: 'number', title: 'Number item' }
      }
    }
  }
}

export default example
