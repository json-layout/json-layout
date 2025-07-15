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
        title: 'An array of objects with various customizations',
        layout: {
          messages: {
            addItem: 'custom add item message'
          },
          listActions: ['add', 'edit', 'delete', 'duplicate'],
          // eslint-disable-next-line no-template-curly-in-string
          itemTitle: 'item.str1 ? `A title based on String 1: "${item.str1}"` : "String 1 is not defined"',
          // eslint-disable-next-line no-template-curly-in-string
          itemSubtitle: { expr: 'A subtitle containing automatic UUID: ${item.uuid}', type: 'js-tpl' },
          itemCopy: '{...item, uuid: crypto.randomUUID()}',
        },
        items: {
          type: 'object',
          title: 'Object item',
          layout: {
            switch: [{ if: 'summary', children: [] }],
            getDefaultData: '{ uuid: crypto.randomUUID() }'
          },
          properties: {
            uuid: { type: 'string', title: 'UUID', description: 'random UUID created using itemCopy or getDefaultData expressions, used in itemSubtitle expression', readOnly: true },
            str1: { type: 'string', title: 'String 1', description: 'used in itemTitle expression' },
            str2: { type: 'string', title: 'String 2' }
          }
        }
      }
    }
  },
  data: {
    dateArray1: ['2024-11-19'],
    objArray1: [{ str1: 'a string', str2: 'another string' }],
    objArray2: [{ str1: 'a string', str2: 'another string', uuid: '612217b2-7796-45fd-9a3c-0ed2b99f11fe' }]
  }
}

export default example
