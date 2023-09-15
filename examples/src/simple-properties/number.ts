import { type JSONLayoutExample } from '..'

const example: JSONLayoutExample = {
  title: 'Numbers',
  id: 'number',
  description: `The default component used to render a property with type number or integer is an adapted text field.
  
If the minimum and maximum attributes are defined, you can use a slider by defining the \`layout\` keyword.`,
  schema: {
    type: 'object',
    properties: {
      num: {
        type: 'number',
        title: 'A simple number property'
      },
      int: {
        type: 'integer',
        title: 'A simple integer property'
      },
      slider: {
        type: 'integer',
        title: 'An integer in a slider',
        minimum: 0,
        maximum: 100,
        layout: 'slider'
      }
    }
  }
}

export default example
