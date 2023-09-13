import type { JSONLayoutExample } from '..'

const category: JSONLayoutExample = {
  title: 'Compact',
  id: 'compact',
  description: 'The compact density is very high, titles and margins are small.',
  options: { density: 'compact' },
  schema: {
    type: 'object',
    title: 'A section',
    properties: {
      str1: { type: 'string', title: 'String 1' },
      str2: { type: 'string', title: 'String 2', layout: 'textarea' }
    }
  }
}

export default category
