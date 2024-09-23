/** @type {import("../types.js").JSONLayoutExample } */
const example = {
  title: 'Opened selection',
  id: 'opened-selection',
  description: 'In the case of an opened selection (meaning that it is possible to define a value outside of the list of items) the `combobox` component is used.',
  schema: {
    type: 'object',
    properties: {
      examplesString: {
        type: 'string',
        title: 'A string with examples',
        examples: ['example1', 'example2']
      },
      examplesArray: {
        type: 'array',
        title: 'An array with examples',
        items: {
          type: 'string',
          examples: ['example1', 'example2']
        }
      },
      fromLayoutString: {
        type: 'string',
        title: 'A string with items defined in layout and explicit component',
        layout: {
          comp: 'combobox',
          items: ['example1', 'example2']
        }
      }
    }
  }
  // data: { enum: 'value1' }
}

export default example
