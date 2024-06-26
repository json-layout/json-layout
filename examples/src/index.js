import simpleProperties from './simple-properties/index.js'
import formats from './formats/index.js'
import selection from './selection/index.js'
import files from './files/index.js'
import arrays from './arrays/index.js'
import composite from './composite/index.js'
import responsive from './responsive/index.js'
import density from './density/index.js'
import slots from './slots/index.js'
import combine from './combine/index.js'
import validation from './validation/index.js'
import i18n from './i18n/index.js'
import dev from './_dev/index.js'

/** @typedef {import('./types.js').JSONLayoutExamplesCategory} JSONLayoutExamplesCategory */
/** @typedef {import('./types.js').JSONLayoutExample} JSONLayoutExample */

/** @type {JSONLayoutExamplesCategory[]} */
export const examples = [
  simpleProperties,
  formats,
  selection,
  files,
  arrays,
  composite,
  responsive,
  density,
  slots,
  combine,
  validation,
  i18n,
  dev
]
