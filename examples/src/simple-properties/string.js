/** @type {import("../types.js").JSONLayoutExample } */
const example = {
  title: 'Strings',
  id: 'string',
  description: `The default component used to render a string property is the text field.
  
You can use a textarea by defining the \`layout\` keyword.`,
  schema: {
    type: 'object',
    properties: {
      text: { type: 'string', title: 'A simple string property', description: 'A description displayed in a help message' },
      textarea: { type: 'string', title: 'A string in a textarea', layout: 'textarea' }
    }
  }
}

export default example
