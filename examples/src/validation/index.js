import simpleErrors from './simple-errors.js'
import errorMessages from './error-messages.js'
import sectionErrors from './section-errors.js'
import compositeErrors from './composite-errors.js'
import validateOn from './validate-on.js'

/** @type {import('../types.js').JSONLayoutExamplesCategory} */
const category = {
  title: 'Validation',
  id: 'validation',
  description: `
Validation is provided by [Ajv](https://ajv.js.org/).

If you encounter some behavior that you don't understand, you can activate some debug logs with \`localStorage.debug = 'jl:validation'\`.
  `,
  examples: [simpleErrors, errorMessages, sectionErrors, compositeErrors, validateOn]
}

export default category
