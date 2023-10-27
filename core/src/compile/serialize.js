// import Debug from 'debug'
import { ok } from 'assert/strict'
import standaloneCode from 'ajv/dist/standalone/index.js'
import { parseModule, generateCode, builders } from 'magicast'
import { parse, print } from 'recast'

/**
 * @param {import('./index.js').CompiledLayout} compiledLayout
 * @returns {string}
 */
export function serialize (compiledLayout) {
  ok(compiledLayout.schema)
  ok(compiledLayout.options)
  const ajv = compiledLayout.options.ajv

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

  // some internal imports to ajv are not translated to asm, we do it here
  // cf https://github.com/ajv-validator/ajv-formats/pull/73
  if (code.includes('require("ajv-formats/dist/formats")')) {
    code = 'import { fullFormats } from "ajv-formats/dist/formats.js";\n' + code
    code = code.replace(/require\("ajv-formats\/dist\/formats"\)\.fullFormats/g, 'fullFormats')
  }
  if (code.includes('require("ajv/dist/runtime/ucs2length")')) {
    code = 'import ucs2length from "ajv/dist/runtime/ucs2length.js";\n' + code
    code = code.replace(/require\("ajv\/dist\/runtime\/ucs2length"\)/g, 'ucs2length')
  }

  // importe only the current locale from ajv-i18n
  code = `import localizeErrors from "ajv-i18n/localize/${compiledLayout.locale}/index.js";
export const exportLocalizeErrors = localizeErrors;\n` + code

  i = 0
  const expressionsNodes = []
  for (const expression of compiledLayout.expressions) {
    const fn = parse(expression.toString()).program.body[0]
    fn.id = `expression${i++}`
    code += `\n${print(fn)}\n`
    expressionsNodes.push(builders.raw(fn.id))
  }

  const ast = parseModule(code)
  ast.exports.compiledLayout = {
    skeletonTree: compiledLayout.skeletonTree,
    normalizedLayouts: compiledLayout.normalizedLayouts,
    validates: {},
    validationErrors: compiledLayout.validationErrors,
    expressions: expressionsNodes,
    locale: compiledLayout.locale,
    messages: compiledLayout.messages,
    localizeErrors: ast.exports.exportLocalizeErrors
  }
  delete ast.exports.exportLocalizeErrors

  i = 0
  for (const pointer of Object.keys(compiledLayout.validates)) {
    const exportKey = `export${i++}`
    ast.exports.compiledLayout.validates[pointer] = ast.exports[exportKey]
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete ast.exports[exportKey]
  }

  const generatedCode = generateCode(ast).code.replace('export const compiledLayout = {', 'const compiledLayout = {')

  return generatedCode
}
