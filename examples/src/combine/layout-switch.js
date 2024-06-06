/** @type {import("../types.js").JSONLayoutExample } */
const example = {
  title: 'Layout switch',
  id: 'layout-switch',
  description: 'You can use a layout `switch` expression to apply a different layout based on some condition.',
  schema: {
    type: 'object',
    title: 'An object with a string whose layout depends on another string',
    properties: {
      str1: { type: 'string', enum: ['short', 'long'] },
      str2: {
        type: 'string',
        layout: {
          switch: [
            { if: { expr: 'parent.data?.str1 === "short"', pure: false }, comp: 'text-field' },
            { if: { expr: 'parent.data?.str1 === "long"', pure: false }, comp: 'textarea' },
            { comp: 'none' }
          ]
        }
      }
    }
  }
}

export default example
