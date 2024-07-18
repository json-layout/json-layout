/** @type {import("../types.js").JSONLayoutExample } */
const example = {
  title: 'Idented sections',
  id: 'sections-indented',
  description: `By default nested sections are rendered in a flat way, using the \`indent\` option you change that.
  
Only sections with a title are indented, other sections remain invisible.`,
  schema: {
    type: 'object',
    title: 'Root section',
    properties: {
      section: {
        type: 'object',
        title: 'Section',
        layout: {
          subtitle: 'This section has a subtitle.'
        },
        properties: {
          str1: {
            type: 'string',
            title: 'String 1'
          },
          str2: {
            type: 'string',
            title: 'String 2'
          },
          nestedSection: {
            type: 'object',
            layout: { title: 'Nested section' },
            properties: {
              str3: {
                type: 'string',
                title: 'String 3'
              }
            }
          }
        }
      }
    }
  },
  options: {
    indent: true
  }
}

export default example
