import singleProperty from './comboboxes.js'
import objectItems from './list.js'
import indexedList from './indexed-list.js'
import clipboard from './clipboard.js'

/** @type {import('../types.js').JSONLayoutExamplesCategory} */
const category = {
  title: 'Lists',
  id: 'lists',
  description: 'Arrays of strings or numbers are rendered with a combobox component. Editable arrays of other types or object with patternProperties are rendered as dynamic lists with actions like add, delete, sort, copy, etc',
  examples: [singleProperty, objectItems, indexedList, clipboard]
}

export default category
