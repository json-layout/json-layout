// import Debug from 'debug'
import { ok } from 'assert/strict'
import standaloneCode from 'ajv/dist/standalone'
import { parseModule, generateCode, builders } from 'magicast'
import { parse, print } from 'recast'
import { type CompiledLayout } from '.'

export function serialize (compiledLayout: CompiledLayout): string {
  ok(compiledLayout.ajv)
  ok(compiledLayout.schema)
  const ajv = compiledLayout.ajv

  const validatesExports: Record<string, string> = {}
  let i = 0
  for (const pointer of Object.keys(compiledLayout.validates)) {
    const fullPointer = ajv.opts.uriResolver.resolve(compiledLayout.schema.$id as string, pointer)
    const exportKey = `export${i++}`
    ajv.addSchema({ $id: exportKey, $ref: fullPointer })
    validatesExports[exportKey] = exportKey
  }
  let code = standaloneCode(ajv, validatesExports)

  i = 0
  const expressionsNodes = []
  for (const expression of compiledLayout.expressions) {
    const fn = parse(expression.toString()).program.body[0]
    fn.id = `expression${i++}`
    code += `\n${print(fn)}\n`
    expressionsNodes.push(builders.raw(fn.id))
  }

  const ast = parseModule(code)
  ast.exports.default = {
    skeletonTree: compiledLayout.skeletonTree,
    normalizedLayouts: compiledLayout.normalizedLayouts,
    validates: {},
    expressions: expressionsNodes
  }

  i = 0
  for (const pointer of Object.keys(compiledLayout.validates)) {
    const exportKey = `export${i++}`
    ast.exports.default.validates[pointer] = ast.exports[exportKey]
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete ast.exports[exportKey]
  }

  return generateCode(ast).code
}
