/** @type {import("../types.js").JSONLayoutExample } */
const example = {
  title: 'Complex children',
  id: 'complex-children',
  description: `You can organize your properties into multiple sorts of composite components without creating intermediate object levels in your schemas.
  
To do so you have to define objects inside the \`layout.children\` attribute.`,
  schema: {
    type: 'object',
    title: 'Complex children',
    layout: [
      { title: 'Section 1', children: ['str1'] },
      {
        comp: 'tabs',
        title: 'Tabs',
        children: [
          { title: 'Tab 1', children: ['str2'] },
          { title: 'Tab 2', children: ['str3'] }
        ]
      },
      {
        comp: 'expansion-panels',
        title: 'Expansion panels',
        children: [
          { title: 'Panel 1', children: ['str4'] },
          { title: 'Panel 2', children: ['str5'] }
        ]
      }
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
      },
      str4: {
        type: 'string',
        title: 'String 4'
      },
      str5: {
        type: 'string',
        title: 'String 5'
      }
    }
  }
}

export default example
