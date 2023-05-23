import { type JSONLayoutExample } from '../'

const example: JSONLayoutExample = {
  title: 'Basic',
  id: 'basic',
  description: 'some basic example',
  schema: {
    type: 'object',
    properties: {
      str1: {
        type: 'string'
      }
    }
  }
}

for (let i = 0; i < 1000; i++) {
  example.schema.properties[`str_${i}`] = {
    type: 'string',
    default: `value ${i}`
  }
}

export default example
