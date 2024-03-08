/** @type {import("../types.js").JSONLayoutExample } */
const example = {
  title: 'Validate on event',
  id: 'validate-on',
  description: `Validation of the data is always calculated, but an additional information \`validated\` is used to determine if an error message should actually be displayed.
  
The \`validated\` property of a simple property is true if:
  - the whole form was validated
  - or \`options.initialValidation="always"\`
  - or \`options.initialValidation="withData"\` and the property is initialized with non-empty data
  - or \`options.validateOn="input"\` and the user inputed some data
  - or \`options.validateOn="blur"\` and the user focused on the property then left
  
The option \`initialValidation\` can have the values \`never\`, \`withData\` and \`always\` (default is \`withData\`).

The option \`validateOn\` can have the values \`input\`, \`blur\` and \`submit\` (default is \`input\`).`,
  schema: {
    type: 'object',
    required: ['str1'],
    properties: {
      str1: {
        type: 'string',
        title: 'A string property with erroneous initial data',
        pattern: '^[A-Z]+$'
      },
      str2: {
        type: 'string',
        layout: { initialValidation: 'never' },
        title: 'A string property with erroneous initial data and initialValidation=never',
        pattern: '^[A-Z]+$'
      },
      str3: {
        type: 'string',
        layout: { validateOn: 'blur' },
        title: 'A string property with validateOn=blur',
        pattern: '^[A-Z]+$'
      }
    }
  },
  data: {
    str1: 'err',
    str2: 'err',
    str3: ''
  }
}

export default example
