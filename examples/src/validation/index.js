import simpleErrors from './simple-errors.js'
import errorMessages from './error-messages.js'
import sectionErrors from './section-errors.js'
import compositeErrors from './composite-errors.js'
import validateOn from './validate-on.js'

/** @type {import('../types.js').JSONLayoutExamplesCategory} */
const category = {
  title: 'Validation',
  id: 'validation',
  description: '',
  examples: [simpleErrors, errorMessages, sectionErrors, compositeErrors, validateOn]
}

export default category
