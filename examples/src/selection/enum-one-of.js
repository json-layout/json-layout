/** @type {import("../types.js").JSONLayoutExample } */
const example = {
  title: 'Enums and oneOfs',
  id: 'enums-one-ofs',
  description: 'Simple enums and oneOf expressions are rendered using a `select` components. If more than 20 items are returned the select will be replaced by a `autocomplete` component. If the data type is an array these components will be used in `multiple` mode.',
  schema: {
    type: 'object',
    properties: {
      enum: {
        type: 'string',
        title: 'An enum',
        enum: ['value1', 'value2']
      },
      largeEnum: {
        type: 'string',
        title: 'A large enum',
        enum: ['value1', 'value2', 'value3', 'value4', 'value5', 'value6', 'value7', 'value8', 'value9', 'value10', 'value11', 'value12', 'value13', 'value14', 'value15', 'value16', 'value17', 'value18', 'value19', 'value20', 'value21']
      },
      oneOf: {
        type: 'string',
        title: 'A oneOf',
        oneOf: [
          { const: 'value1', title: 'Value 1' },
          { const: 'value2', title: 'Value 2' }
        ]
      },
      oneOfArray: {
        type: 'array',
        title: 'An array of oneOf',
        items: {
          type: 'string',
          oneOf: [
            { const: 'value1', title: 'Value 1' },
            { const: 'value2', title: 'Value 2' }
          ]
        }
      }
    }
  }
  // data: { enum: 'value1' }
}

export default example
