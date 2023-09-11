import type { JSONLayoutExample } from '../'

const category: JSONLayoutExample = {
  title: 'Grid defined from parent',
  id: 'grid-parent',
  description: 'The size of the children in the grid can also be expressed from the parent layout.',
  schema: {
    type: 'object',
    title: 'A section disposing children in a grid',
    layout: [
      { key: 'str1' },
      { key: 'str2', cols: { md: 6 } },
      { key: 'str3', cols: { md: 6 } },
      { key: 'str4', cols: 4 },
      { key: 'str5', cols: 8 }
    ],
    properties: {
      str1: { type: 'string', title: '12 cols default' },
      str2: { type: 'string', title: '12 or 6 cols' },
      str3: { type: 'string', title: '12 or 6 cols' },
      str4: { type: 'string', title: '4 cols' },
      str5: { type: 'string', title: '8 cols' }
    }
  }
}

export default category
