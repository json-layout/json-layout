/** @type {import("../types.js").JSONLayoutExample } */
const example = {
  title: 'Items from layout and context',
  id: 'context',
  description: 'It is possible to force rendering a `select` component and use data from outside the schema as a list of possible values.',
  schema: {
    type: 'object',
    properties: {
      fromLayout: {
        type: 'string',
        title: 'A select from items in layout',
        layout: {
          comp: 'select',
          items: ['value1', { title: 'Value 2', value: 'value2' }]
        }
      },
      fromContext: {
        type: 'string',
        title: 'A select from items in options.context',
        layout: {
          comp: 'select',
          getItems: 'options.context.selectItems1'
        }
      }
    }
  },
  options: {
    context: { selectItems1: ['value1', 'value2'] }
  }
  // data: { enum: 'value1' }
}

export default example
