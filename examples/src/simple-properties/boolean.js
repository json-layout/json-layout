/** @type {import("../types.js").JSONLayoutExample } */
const example = {
  title: 'Booleans',
  id: 'boolean',
  description: `The default component used to render a boolean property is the checkbox.
  
  You can use a switch instead of a checkbox by defining the \`layout\` keyword.`,
  schema: {
    type: 'object',
    properties: {
      checkbox: { type: 'boolean', title: 'A simple boolean property' },
      switch: { type: 'boolean', title: 'A boolean in a switch', layout: 'switch' }
    }
  }
}

export default example
