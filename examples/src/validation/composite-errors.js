/** @type {import("../types.js").JSONLayoutExample } */
const example = {
  title: 'Composite errors',
  id: 'composite-errors',
  description: 'Composite components like tabs and expansion panels will signal errors inside one child using color and other accenting methods.',
  schema: {
    type: 'object',
    layout: 'tabs',
    required: ['tab1', 'tab2'],
    properties: {
      tab1: {
        type: 'object',
        required: ['str1'],
        title: 'Tab 1',
        properties: {
          str1: { type: 'string', title: 'A string property that only accepts uppercase letters', pattern: '^[A-Z]+$' }
        }
      },
      tab2: {
        type: 'object',
        required: ['str2'],
        title: 'Tab 2',
        properties: {
          str2: { type: 'string', title: 'A string property that only accepts uppercase letters', pattern: '^[A-Z]+$' }
        }
      }
    }
  },
  options: {
    initialValidation: 'always'
  }
}

export default example
