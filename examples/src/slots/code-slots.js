/** @type {import("../types.js").JSONLayoutExample } */
const example = {
  title: 'Code slots',
  id: 'code',
  description: `
The \`component\` slot should provide the name of a slot given to Vjsf using the Vue.js slot mechanism.

The \`component\` slot is by default interpreted as containing a named code slot.
Meaning that \`{"component": "named-code-slot"}\` is equivalent to \`{"component": {"name": "named-code-slot"}}\`.
`,
  schema: {
    type: 'object',
    properties: {
      text: {
        type: 'string',
        title: 'A text string',
        layout: {
          slots: {
            component: 'custom-textarea'
          }
        }
      }
    }
  },
  codeSlots: ['custom-textarea']
}

export default example
