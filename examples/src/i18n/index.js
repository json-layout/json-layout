import errors from './errors.js'
import localeRefs from './locale-refs.js'
import xI18n from './x-i18n.js'
import messages from './messages.js'

/** @type {import('../types.js').JSONLayoutExamplesCategory} */
const category = {
  title: 'Internationalization',
  id: 'i18n',
  description: '',
  examples: [errors, localeRefs, xI18n, messages]
}

export default category
