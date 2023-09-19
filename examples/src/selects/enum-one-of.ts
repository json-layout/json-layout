import { type JSONLayoutExample } from '..'

const example: JSONLayoutExample = {
  title: 'Enums and oneOfs',
  id: 'enums-one-ofs',
  description: '',
  schema: {
    type: 'object',
    properties: {
      enum: {
        type: 'string',
        title: 'An enum',
        enum: ['value1', 'value2']
      }
    }
  }
}

export default example
