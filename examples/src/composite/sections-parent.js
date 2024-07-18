/** @type {import("../types.js").JSONLayoutExample } */
const example = {
  title: 'Sections described in parent',
  id: 'sections-parent',
  description: `You might want to organize your properties into sections without adding actual object containers in your data.
  
  To do so you can define sections in the \`layout.children\` attribute of the parent node.`,
  schema: {
    type: 'object',
    layout: [
      { title: 'Section 1', children: ['str1', 'str2'] },
      { title: 'Section 2', children: ['str3'] }
    ],
    properties: {
      str1: {
        type: 'string',
        title: 'String 1'
      },
      str2: {
        type: 'string',
        title: 'String 2'
      },
      str3: {
        type: 'string',
        title: 'String 3'
      }
    }
  }

}

export default example
