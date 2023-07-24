import { type JSONLayoutExample } from '../'

const example: JSONLayoutExample = {
  title: 'Many properties',
  id: 'many-props',
  description: 'A very basic example mostly interesting because it contains many properties and can be used to check that performance is ok in this case.',
  schema: {
    type: 'object',
    properties: {
      str1: {
        type: 'string'
      }
    }
  }
}

for (let i = 0; i < 200; i++) {
  example.schema.properties[`obj_${i}`] = {
    type: 'object',
    properties: {
      str: {
        type: 'string',
        default: `value ${i}`
      }
    }
  }
}

export default example
