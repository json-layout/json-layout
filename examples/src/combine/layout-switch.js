/** @type {import("../types.js").JSONLayoutExample } */
const example = {
  title: 'Layout "if" keyword',
  id: 'layout-if',
  description: 'You can use a layout `switch` expression to apply a different layout based on some condition.',
  schema: {
    type: 'object',
    title: 'An object with a string that depends on another',
    properties: {
      str1: { type: 'string', enum: ['short', 'long'] },
      str2: {
        type: 'string',
        layout: [
          { if: 'data?.str1 === "short"', comp: 'text-field' },
          { if: 'data?.str1 === "long"', comp: 'textarea' }
        ]
      }
    }
  }
}

export default example
