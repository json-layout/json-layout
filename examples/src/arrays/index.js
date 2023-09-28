import singleProperty from './single-property.js'
import objectItems from './object-items.js'

/** @type {import('../types.js').JSONLayoutExamplesCategory} */
const category = {
  title: 'Arrays',
  id: 'arrays',
  description: 'Editable arrays are rendered as dynamic lists with actions like add, delete, sort, copy, etc',
  examples: [singleProperty, objectItems]
}

export default category
