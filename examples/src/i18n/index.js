import errors from './errors.js'
import schemas from './schemas.js'
import messages from './messages.js'

/** @type {import('../types.js').JSONLayoutExamplesCategory} */
const category = {
  title: 'Internationalization',
  id: 'i18n',
  description: '',
  examples: [errors, schemas, messages]
}

export default category
