/** @type {import("../types.js").JSONLayoutExample } */
const example = {
  title: 'Items from layout and context',
  id: 'context',
  description: 'It is possible to force rendering a `select` component and use data from outside the schema as a list of possible values. To do so you can use the `layout.items` property or write an expression in `layout.getItems`. For more complex cases it is possible to define `layout.getItems.itemsResuls`, `layout.getItems.itemTitle`, `layout.getItems.itemValue`, `layout.getItems.itemKey` and `layout.itemIcon` to transform the items. ',
  schema: {
    type: 'object',
    properties: {
      fromLayout: {
        type: 'string',
        title: 'A select from items in layout',
        layout: {
          items: ['value1', { title: 'Value 2', value: 'value2' }]
        }
      },
      fromContext: {
        type: 'string',
        title: 'A select from items in options.context',
        layout: {
          getItems: 'options.context.selectItems1'
        }
      },
      fromContextTransform: {
        type: 'string',
        title: 'Another select from context but with transformed items',
        layout: {
          getItems: {
            expr: 'options.context.selectItems2',
            itemsResults: 'data.results',
            itemTitle: 'data.label',
            itemValue: 'data.id',
            itemIcon: '"mdi-" + data.icon'
          }
        }
      }
    }
  },
  options: {
    context: {
      selectItems1: ['value1', 'value2'],
      selectItems2: {
        results: [
          { id: 'value1', label: 'Value 1', icon: 'numeric-1' },
          { id: 'value2', label: 'Value 2', icon: 'numeric-2' }
        ]
      }
    }
  }
  // data: { enum: 'value1' }
}

export default example
