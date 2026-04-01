/** @type {import("../types.js").JSONLayoutExample } */
const example = {
  title: 'One of (autocomplete)',
  id: 'one-of-autocomplete',
  description: 'A oneOf with autocomplete mode and custom props on the select component.',
  schema: {
    type: 'object',
    title: 'An object with a oneOf autocomplete',
    oneOfLayout: {
      label: 'Select a subschema',
      autocomplete: true,
      props: { clearable: true }
    },
    oneOf: [
      {
        title: 'Text input',
        properties: { type: { const: 'text' }, text: { type: 'string', title: 'Text value' } }
      },
      {
        title: 'Number input',
        properties: { type: { const: 'number' }, number: { type: 'number', title: 'Number value' } }
      },
      {
        title: 'Boolean input',
        properties: { type: { const: 'boolean' }, flag: { type: 'boolean', title: 'Boolean value' } }
      },
      {
        title: 'Date input',
        properties: { type: { const: 'date' }, date: { type: 'string', format: 'date', title: 'Date value' } }
      },
      {
        title: 'Email input',
        properties: { type: { const: 'email' }, email: { type: 'string', format: 'email', title: 'Email value' } }
      }
    ]
  }
}

export default example
