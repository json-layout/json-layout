/** @type {import("../types.js").JSONLayoutExample } */
const example = {
  title: 'Switch',
  id: 'switch',
  description: `For more in depth customization of the responsive layout you can use the \`display\` parameter given to expressions.

This object can be used in a \`switch\` to change the component or any other layout option. For example the verticality of expansion panels might be better suited for smaller screens than the horizontality of tabs.`,
  schema: {
    type: 'object',
    layout: {
      switch: [{
        if: 'display.smAndDown',
        comp: 'expansion-panels',
        title: 'Expansion panels when small (try increasing width)'
      }, {
        comp: 'tabs',
        title: 'Tabs when large (try decreasing width)'
      }]
    },
    properties: {
      obj1: {
        type: 'object',
        title: 'Section 1',
        properties: {
          str1: {
            type: 'string',
            title: 'String'
          }
        }
      },
      obj2: {
        type: 'object',
        title: 'Section 2',
        properties: {
          str1: {
            type: 'string',
            title: 'String'
          }
        }
      }
    }
  }
}

export default example
