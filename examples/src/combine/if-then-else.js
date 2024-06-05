/** @type {import("../types.js").JSONLayoutExample } */
const example = {
  title: 'If/then/else',
  id: 'if-then-else',
  description: 'The JSON schema if/then/else keywords are interpreted correctly to conditionnally render some content. Compared to the `layout.if` keyword this has the advantage of being purely based on JSON schemas semantics.',
  schema: {
    type: 'object',
    title: 'An object with if/then/else',
    properties: {
      str1: { type: 'string', enum: ['type1', 'type2', 'type3'] }
    },
    dependentSchemas: {
      str1: {
        if: {
          properties: { str1: { const: 'type1' } }
        },
        then: {
          properties: {
            str2: { type: 'string' }
          }
        },
        else: {
          properties: {
            str3: { type: 'string' }
          }
        }
      }
    }
  }
}

export default example
