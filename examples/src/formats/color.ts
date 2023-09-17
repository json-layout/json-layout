import { type JSONLayoutExample } from '..'

const example: JSONLayoutExample = {
  title: 'Colors',
  id: 'color',
  description: 'Use the component `color-picker` to input CSS colors (hex, rgb, etc).',
  schema: {
    type: 'object',
    properties: {
      date: {
        type: 'string',
        title: 'A color',
        layout: 'color-picker'
      }
    }
  }
}

export default example
