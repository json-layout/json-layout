/** @type {import("../types.js").JSONLayoutExample } */
const example = {
  title: 'Editable lists',
  id: 'lists',
  description: 'A more complex list component is also available. You can use the `summary` expression parameter to customize the layout of list items when they are not edited.',
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
      },
      objArray2: {
        type: 'array',
        title: 'An array of objects with customized messages, layout and actions',
        layout: {
          messages: {
            addItem: 'custom add item message'
          },
          listActions: ['add', 'edit', 'delete', 'duplicate']
        },
        items: {
          type: 'object',
          title: 'Object item',
          properties: {
            str1: { type: 'string', title: 'String 1' },
            str2: { type: 'string', title: 'String 2 is hidden except on the edited item', layout: { if: '!summary' } }
          }
        }
      }
    }
  },
  data: {
    dateArray1: ['2024-11-19'],
    objArray1: [{ str1: 'a string', str2: 'another string' }],
    objArray2: [{ str1: 'a string', str2: 'another string' }]
  }
}

export default example
