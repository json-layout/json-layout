import type { JSONLayoutExample } from '..'

const category: JSONLayoutExample = {
  title: 'Switch',
  id: 'switch',
  description: `For more in depth customization of the responsive layout the expressions are given a \`display\` object with this contract:

\`\`\`js
{
  width: number // the width of the parent container
  xs: boolean,
  sm: boolean,
  smAndDown: boolean,
  smAndUp: boolean,
  md: boolean,
  mdAndDown: boolean,
  mobile: boolean, // alias for mdAndDown
  mdAndUp: boolean,
  lg: boolean,
  lgAndDown: boolean,
  lgAndUp: boolean,
  xl: boolean,
  xlAndDown: boolean,
  xlAndUp: boolean,
  xxl: boolean
}
\`\`\`

This object can be used in a \`switch\` to change the component or any other layout option. For example the verticality of expansion panels might be better suited for smaller screens than the horizontality of tabs.`,
  schema: {
    type: 'object',
    layout: {
      switch: [{
        if: 'display.mobile',
        comp: 'expansion-panels',
        title: 'Expansion panels in small containers'
      }, {
        comp: 'tabs',
        title: 'Tabs in large containers'
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

export default category
