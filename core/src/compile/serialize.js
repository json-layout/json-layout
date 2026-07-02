// import Debug from 'debug'
import ajvModule from 'ajv/dist/2019.js'
import addFormats from 'ajv-formats'
import ajvErrors from 'ajv-errors'
import { ok } from 'assert/strict'
import standaloneCode from 'ajv/dist/standalone/index.js'
import { parseModule, generateCode, builders } from 'magicast'
import { clone } from '../utils/clone.js'

// @ts-ignore
const Ajv = /** @type {typeof ajvModule.default} */ (ajvModule)

/**
 * @param {import('./index.js').CompiledLayout} compiledLayout
 * @returns {Promise<string>}
 */
export async function serialize (compiledLayout) {
  ok(compiledLayout.schema)
  ok(compiledLayout.options)

  // we get the schemas that were extended by makeSleletonNode
  /** @type {Record<string, any>} */
  const schemas = {}
  for (const [key, value] of Object.entries(compiledLayout.options.ajv.schemas)) {
    if (key.startsWith('https://json-schema.org/')) continue
    schemas[key] = value?.schema
  }

  /** @type {import('ajv').Options} */
  const ajvOpts = {
    allErrors: true,
    strict: false,
    verbose: true,
    ...compiledLayout.options.ajvOptions,
    code: { source: true, esm: true, lines: true },
    schemas
  }
  const ajv = new Ajv(ajvOpts)
  addFormats.default(ajv)
  ajvErrors.default(ajv)

  /** @type {Record<string, string>} */
  const validatesExports = {}
  let i = 0
  for (const pointer of Object.keys(compiledLayout.validates)) {
    const fullPointer = ajv.opts.uriResolver.resolve(/** @type {string} */(compiledLayout.schema.$id), pointer)
    const exportKey = `export${i++}`
    ajv.addSchema({ $id: exportKey, $ref: fullPointer })
    validatesExports[exportKey] = exportKey
  }
  let code = standaloneCode.default(ajv, validatesExports)

  code = code.replace('"use strict";', '')
  // make the exportN validates module-local so the object below can reference them
  code = code.replace(/export const (export\d+) =/g, 'const $1 =')

  // some internal imports to ajv are not translated to esm, we do it here
  // cf https://github.com/ajv-validator/ajv-formats/pull/73
  if (code.includes('require("ajv-formats/dist/formats")')) {
    code = 'import { fullFormats } from "ajv-formats/dist/formats.js";\n' + code
    code = code.replace(/require\("ajv-formats\/dist\/formats"\)\.fullFormats/g, 'fullFormats')
  }
  if (code.includes('require("ajv/dist/runtime/ucs2length")')) {
    code = 'import ucs2length from "ajv/dist/runtime/ucs2length.js";\n' + code
    code = code.replace(/require\("ajv\/dist\/runtime\/ucs2length"\)/g, 'ucs2length')
  }
  if (code.includes('require("ajv/dist/runtime/equal")')) {
    code = 'import equal from "ajv/dist/runtime/equal.js";\n' + code
    code = code.replace(/require\("ajv\/dist\/runtime\/equal"\)\.default/g, 'equal')
  }

  // import only the current locale from ajv-i18n
  let ajvI18nPath = `ajv-i18n/localize/${compiledLayout.locale}/index.js`
  try {
    await import(ajvI18nPath)
  } catch (er) {
    console.warn(`failed to load ${ajvI18nPath}, fallback to en`)
    ajvI18nPath = 'ajv-i18n/localize/en/index.js'
  }

  code = `import localizeErrors from "${ajvI18nPath}";\n` + code

  i = 0
  const expressionsNodes = []
  for (const expression of compiledLayout.expressions) {
    const id = `expression${i++}`
    code += expression.toString().replace('function anonymous', `function ${id}`)
    /* Previous code based on recast/esprima, suffered syntax limitations
    const fn = parse(expression.toString()).program.body[0]
    fn.id = id
    code += `\n${print(fn)}\n` */
    expressionsNodes.push(builders.raw(id))
  }

  // reference the validate functions by name, keyed by json-pointer
  /** @type {Record<string, any>} */
  const validatesNodes = {}
  i = 0
  for (const pointer of Object.keys(compiledLayout.validates)) {
    validatesNodes[pointer] = builders.raw(`export${i++}`)
  }

  // run magicast only on the small object literal; keep the large generated `code` as
  // a raw string prefix (parsing it was the serialization bottleneck)
  const ast = parseModule('export const compiledLayout = {}')
  ast.exports.compiledLayout = {
    mainTree: compiledLayout.mainTree,
    skeletonTrees: clone(compiledLayout.skeletonTrees),
    skeletonNodes: clone(compiledLayout.skeletonNodes),
    normalizedLayouts: clone(compiledLayout.normalizedLayouts),
    validates: validatesNodes,
    validationErrors: compiledLayout.validationErrors,
    expressions: expressionsNodes,
    locale: compiledLayout.locale,
    messages: compiledLayout.messages,
    components: compiledLayout.options.components,
    localizeErrors: builders.raw('localizeErrors')
  }

  const objectCode = generateCode(ast).code.replace('export const compiledLayout = {', 'const compiledLayout = {')

  return `${code}\n${objectCode}`
}
