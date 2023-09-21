/** @type {import("../types.js").JSONLayoutExample } */
const example = {
  title: 'Section',
  id: 'section',
  description: `The default component used to render an object is a section.
  
The title of the section can be derived from the \`title\` attribute of the object or from \`layout.title\`. An empty or null title will make the section into a simple container for its children.

The attribute \`layout.option.titleDepth\` can be used to configure the title tag (h1, h2, etc). Its default value is 2 and it is incremented automatically when nesting sections.`,
  schema: {
    type: 'object',
    title: 'Invisible container',
    layout: { title: null },
    properties: {
      section: {
        type: 'object',
        title: 'Section',
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
  }
}

export default example
