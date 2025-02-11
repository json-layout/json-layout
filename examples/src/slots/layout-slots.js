/** @type {import("../types.js").JSONLayoutExample } */
const example = {
  title: 'Layout children slots',
  id: 'layout',
  description: `
Slots can also be defined in the children definitions of a composite layout.
`,
  schema: {
    type: 'object',
    layout: [
      [
        { key: 'text', slots: { before: 'A **markdown** slot before the text field on the left.' }, cols: 6 },
        { name: 'custom-message', cols: 6, props: { prop1: 'A prop given to the code slot' } }
      ],
      { markdown: 'A **markdown** slot at the bottom with full width. A **markdown** slot at the bottom with full width. A **markdown** slot at the bottom with full width. A **markdown** slot at the bottom with full width. A **markdown** slot at the bottom with full width.' }
    ],
    properties: {
      text: {
        type: 'string',
        title: 'A text string'
      }
    }
  },
  codeSlots: ['custom-message']
}

export default example
