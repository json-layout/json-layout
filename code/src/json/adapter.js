/**
 * @file Assembles the JSON FormatAdapter export.
 */

import { json } from '@codemirror/lang-json'
import { parse, pathToRange, offsetToPath, valueTokenAt } from './parser.js'
import { scaffold } from './scaffold.js'
import { insertProperty } from './insert-property.js'

/** @typedef {import('./types.js').FormatAdapter} FormatAdapter */

/** @type {FormatAdapter} */
export const jsonFormatAdapter = {
  language: json(),
  parse,
  pathToRange,
  offsetToPath,
  valueTokenAt,
  scaffold,
  insertProperty
}
