/** @type {import("../types.js").JSONLayoutExample } */
const example = {
  title: 'Columns layout',
  id: 'columns-layout',
  description: 'By combining cols and sections you can create simple columns layouts.',
  schema: {
    type: 'object',
    title: 'A section with columns children',
    layout: [
      { title: 'Column 1', children: ['str1', 'str2'], cols: 6 },
      { title: 'Column 2', children: ['str3', 'str4'], cols: 6 }
    ],
    properties: {
      str1: { type: 'string' },
      str2: { type: 'string' },
      str3: { type: 'string' },
      str4: { type: 'string' }
    }
  }
}

export default example
