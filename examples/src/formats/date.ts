import { type JSONLayoutExample } from '..'

const example: JSONLayoutExample = {
  title: 'Dates',
  id: 'date',
  description: 'The default component used to render a property with the `date` format is a date picker.',
  schema: {
    type: 'object',
    properties: {
      date: {
        type: 'string',
        format: 'date',
        title: 'A simple date'
      }
    }
  }
}

export default example
