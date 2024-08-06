/** @type {import("../types.js").JSONLayoutExample } */
const example = {
  title: 'Indexed lists (patternProperties)',
  id: 'indexed-lists',
  description: 'Dynamic properties expressed with patternProperties are displayed as a spacial kind of list.',
  schema: {
    type: 'object',
    properties: {
      obj1: {
        type: 'object',
        title: 'An object accepting any property key for string values',
        patternProperties: {
          '.*': {
            type: 'number'
          }
        }
      }
    }
  },
  data: {
    obj1: {
      key1: 1
    }
  }
}

export default example
