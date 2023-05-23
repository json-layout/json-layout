import standaloneCode from 'ajv/dist/standalone'
import Ajv from 'ajv'
import addFormats from 'ajv-formats'

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface SerializeCompiledLayoutOptions {}

export function compileAndSerialize (schema: object, options: SerializeCompiledLayoutOptions = {}): string {
  const ajv = new Ajv({ strict: false, allErrors: true, code: { source: true, optimize: true, lines: true } })
  addFormats(ajv)
  // const compiledRaw = compile(schema, { ajv })

  // TODO: follow the doc to serialize multiple functions at once: https://ajv.js.org/standalone.html
  const validatesCode = standaloneCode(ajv)

  return validatesCode
}
