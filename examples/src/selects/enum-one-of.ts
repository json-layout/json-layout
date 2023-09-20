import { type JSONLayoutExample } from '..'

const example: JSONLayoutExample = {
  title: 'Enums and oneOfs',
  id: 'enums-one-ofs',
  description: 'Simple enums and oneOf expressions are rendered using a `select` components.',
  schema: {
    type: 'object',
    properties: {
      enum: {
        type: 'string',
        title: 'An enum',
        enum: ['value1', 'value2']
      },
      oneOf: {
        type: 'string',
        title: 'A oneOf',
        oneOf: [
          { const: 'value1', title: 'Value 1' },
          { const: 'value2', title: 'Value 2' }
        ]
      }
    }
  }
  // data: { enum: 'value1' }
}

export default example
