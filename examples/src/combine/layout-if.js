/** @type {import("../types.js").JSONLayoutExample } */
const example = {
  title: 'Layout "if" keyword',
  id: 'layout-if',
  description: 'You can use the `layout.if` expression to apply a condition for the rendering of a property. Please not that this is not a JSON schema semantic and is only used for the layout. If you need to apply a condition based on the JSON schema semantics, only a rendering tool.',
  schema: {
    type: 'object',
    title: 'An object with a string that depends on another',
    properties: {
      str1: { type: 'string' },
      str2: { type: 'string', layout: { if: 'data?.str1?.length > 3' } }
    }
  }
}

export default example
