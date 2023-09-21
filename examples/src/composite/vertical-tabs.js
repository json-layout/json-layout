/** @type {import("../types.js").JSONLayoutExample } */
const example = {
  title: 'Vertical tabs',
  id: 'vertical-tabs',
  description: 'Children of an object can be rendered into vertical tabs using `layout: {comp: \'vertical-tabs\'}` or the shorter `layout: \'vertical-tabs\'`.',
  schema: {
    type: 'object',
    title: 'Tabs',
    layout: 'vertical-tabs',
    properties: {
      tab1: {
        type: 'object',
        title: 'Tab 1',
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
      tab2: {
        type: 'object',
        title: 'Tab 2',
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
