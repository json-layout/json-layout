/** @type {import("../types.js").JSONLayoutExample } */
const example = {
  title: 'Groups of checkboxes and radios',
  id: 'groups',
  description: 'The components `checkbox-group`, `switch-group` and `radio-group` offer alternative renderings.',
  schema: {
    type: 'object',
    required: ['radioOneOfs'],
    properties: {
      checkboxOneOfs: {
        type: 'string',
        title: 'Items rendered as checkboxes',
        oneOf: [
          { const: 'value1', title: 'Value 1' },
          { const: 'value2', title: 'Value 2' }
        ],
        layout: 'checkbox-group'
      },
      switchOneOfs: {
        type: 'string',
        title: 'Items rendered as switches',
        oneOf: [
          { const: 'value1', title: 'Value 1' },
          { const: 'value2', title: 'Value 2' }
        ],
        layout: 'switch-group'
      },
      radioOneOfs: {
        type: 'string',
        title: 'Items rendered as radio buttons',
        oneOf: [
          { const: 'value1', title: 'Value 1' },
          { const: 'value2', title: 'Value 2' }
        ],
        layout: 'radio-group'
      },
      checkboxOneOfsArray: {
        type: 'array',
        title: 'Array rendered as checkboxes',
        items: {
          type: 'string',
          oneOf: [
            { const: 'value1', title: 'Value 1' },
            { const: 'value2', title: 'Value 2' }
          ]
        },
        layout: 'checkbox-group'
      }
    }
  }
  // data: { enum: 'value1' }
}

export default example
