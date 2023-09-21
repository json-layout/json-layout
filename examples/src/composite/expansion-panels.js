/** @type {import("../types.js").JSONLayoutExample } */
const example = {
  title: 'Expansion panels',
  id: 'expansion-panels',
  description: 'Children of an object can be rendered into expansion panels using `layout: {comp: \'expansion-panels\'}` or the shorter `layout: \'expansion-panels\'.',
  schema: {
    type: 'object',
    title: 'Expansion panels',
    layout: 'expansion-panels',
    properties: {
      panel1: {
        type: 'object',
        title: 'Panel 1',
        properties: {
          str1: {
            type: 'string',
            title: 'String 1'
          },
          str2: {
            type: 'string',
            title: 'String 2'
          }
        }
      },
      panel2: {
        type: 'object',
        title: 'Panel 2',
        properties: {
          str3: {
            type: 'string',
            title: 'String 1'
          }
        }
      }
    }
  }
}

export default example
