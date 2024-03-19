/** @type {import("../types.js").JSONLayoutExample } */
const example = {
  title: 'Strings with separator',
  id: 'string-separator',
  description: 'Any field can be displayed as items in a list.',
  schema: {
    type: 'object',
    properties: {
      strSep1: {
        type: 'string',
        title: 'A string with values separated by a comma',
        layout: {
          separator: ','
        }
      }
    }
  },
  data: {
    strSep1: 'one,two,three'
  }
}

export default example
