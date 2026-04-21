/**
 * @file Assembles the JSON FormatAdapter export.
 */

import { parse, pathToRange, offsetToPath } from './parser.js'
import { scaffold } from './scaffold.js'
import { insertProperty } from './insert-property.js'

/** @typedef {import('./types.js').FormatAdapter} FormatAdapter */

/** @type {FormatAdapter} */
export const jsonFormatAdapter = {
  parse,
  pathToRange,
  offsetToPath,
  scaffold,
  insertProperty
}
