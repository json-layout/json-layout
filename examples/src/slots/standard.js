/** @type {import("../types.js").JSONLayoutExample } */
const example = {
  title: 'Standard slots',
  id: 'standard',
  description: `Standard slots shared accross all node types are \`before\`, \`after\` and \`component\`.
  
The \`before\`, \`after\` slots are by default interpreted as containing some markdown code.`,
  schema: {
    type: 'object',
    properties: {
      text: {
        type: 'string',
        title: 'A string property',
        layout: {
          slots: {
            before: { text: 'This is a simple text slot' },
            after: 'This is a **markdown** slot'
          }
        }
      }
    }
  }
}

export default example
