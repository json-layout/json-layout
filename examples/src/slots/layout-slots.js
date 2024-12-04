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
        { key: 'text', slots: { before: 'A **markdown** slot before the the text field.' }, cols: 6 },
        { text: 'A text slot to the right.', cols: 6 }
      ],
      { markdown: 'A **markdown** slot at the bottom with full width.' }
    ],
    properties: {
      text: {
        type: 'string',
        title: 'A text string'
      }
    }
  }
}

export default example
