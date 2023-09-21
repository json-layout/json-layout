import simpleProperties from './simple-properties/index.js'
import formats from './formats/index.js'
import selects from './selects/index.js'
import composite from './composite/index.js'
import combine from './combine/index.js'
import responsive from './responsive/index.js'
import density from './density/index.js'
import dev from './_dev/index.js'

/** @typedef {import('./types.js').JSONLayoutExamplesCategory} JSONLayoutExamplesCategory */

/** @type {JSONLayoutExamplesCategory[]} */
export const examples = [
  simpleProperties,
  formats,
  selects,
  composite,
  responsive,
  density,
  combine,
  dev
]
