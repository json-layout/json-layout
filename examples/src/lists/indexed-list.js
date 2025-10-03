/** @type {import("../types.js").JSONLayoutExample } */
const example = {
  title: 'Indexed lists (patternProperties)',
  id: 'indexed-lists',
  description: 'Dynamic properties expressed with patternProperties are displayed as a different kind of list.',
  schema: {
    type: 'object',
    properties: {
      obj1: {
        type: 'object',
        title: 'An object accepting any property key for string values',
        patternProperties: {
          '.*': {
            type: 'string'
          }
        }
      },
      obj2: {
        type: 'object',
        title: 'An object accepting any property key coming from a list',
        patternPropertiesLayout: {
          items: ['key1', 'key2', 'key3']
        },
        patternProperties: {
          '.*': {
            type: 'string'
          }
        }
      },
      obj3: {
        type: 'object',
        title: 'An object accepting str_* or nb_* properties',
        patternProperties: {
          'str_(.*)': {
            type: 'string'
          },
          'nb_(.*)': {
            type: 'number'
          }
        }
      }
    }
  },
  data: {
    obj1: {
      key: 'value'
    },
    obj2: {
      key1: 'value'
    },
    obj3: {
      str_1: 'String 1',
      nb_1: 1
    }
  }
}

export default example
