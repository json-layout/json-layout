/** @type {import("../types.js").JSONLayoutExample } */
const example = {
  title: 'Read-only children',
  id: 'readonly-children',
  description: 'The standard JSON Schema attribute `readOnly` can have multiple effect on children of a section depending on the `readOnlyPropertiesMode` option.',
  schema: {
    type: 'object',
    properties: {
      section1: {
        type: 'object',
        title: 'Section with visible read-only children',
        layout: {
          readOnlyPropertiesMode: 'show'
        },
        properties: {
          str1: {
            type: 'string',
            title: 'String 1'
          },
          str2: {
            type: 'string',
            title: 'String 2',
            readOnly: true
          }
        }
      },
      section2: {
        type: 'object',
        title: 'Section with hidden read-only children',
        layout: {
          readOnlyPropertiesMode: 'hide'
        },
        properties: {
          str1: {
            type: 'string',
            title: 'String 1'
          },
          str2: {
            type: 'string',
            title: 'String 2',
            readOnly: true
          }
        }
      },
      section3: {
        type: 'object',
        title: 'Section with read-only children removed from the data',
        layout: {
          readOnlyPropertiesMode: 'remove'
        },
        properties: {
          str1: {
            type: 'string',
            title: 'String 1'
          },
          str2: {
            type: 'string',
            title: 'String 2',
            readOnly: true
          }
        }
      }
    }
  },
  data: {
    section1: {
      str1: 'String 1 value',
      str2: 'String 2 value'
    },
    section2: {
      str1: 'String 1 value',
      str2: 'String 2 value'
    },
    section3: {
      str1: 'String 1 value',
      str2: 'String 2 value'
    }
  }
}

export default example
