/** @type {import("../types.js").JSONLayoutExample } */
const example = {
  title: 'Section errors',
  id: 'section-errors',
  description: 'If an error is related to a section but cannot be rendered on a child simple property it is displayed as part of the header of the section.',
  schema: {
    type: 'object',
    title: 'A section with an error in a missing child',
    required: ['missingChild'],
    properties: {
      str1: { type: 'string', title: 'A string property' }
    }
  },
  options: {
    initialValidation: 'always'
  }
}

export default example
