/** @type {import("../types.js").JSONLayoutExample } */
const example = {
  title: 'Comboboxes (lists of chips)',
  id: 'comboboxes',
  description: 'Simple strings and numbers can be displayed as comboboxes.',
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
      },
      strSep1: {
        type: 'string',
        title: 'A string with values separated by a comma',
        layout: {
          separator: ','
        }
      }
    }
  },
  data: {
    strArray1: ['one', 'two', 'three'],
    nbArray1: [1, 2, 3],
    strSep1: 'one,two,three'
  }
}

export default example
