#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-var-requires */

// @ts-ignore
import Ajv2019 from 'ajv/dist/2019.js'
import addFormats from 'ajv-formats'
import ajvErrors from 'ajv-errors'
import { readFileSync, readdirSync, existsSync, writeFileSync, unlinkSync } from 'node:fs'
import { compile as compileTs } from 'json-schema-to-typescript'
import path from 'node:path'
import standaloneCode from 'ajv/dist/standalone/index.js'

// @ts-ignore
const ajv = new Ajv2019({
  code: {
    source: true,
    esm: true
    // optimize: true
  },
  discriminator: true,
  allowMatchingProperties: true,
  allowUnionTypes: true,
  allErrors: true
})
// @ts-ignore
addFormats(ajv)
// @ts-ignore
ajvErrors(ajv)

const main = async () => {
  const dir = path.resolve('./src')
  console.log(`look for schemas in subdirectories of ${dir}`)

  const keys = readdirSync(dir)
    .filter(key => existsSync(path.join(dir, key, 'schema.json')))

  for (const key of keys) {
    console.log(key)
    // const ts = await compile(schema, key, { $refOptions: { resolve: { 'data-fair-lib': dataFairLibResolver, local: localResolver } } })
    const schema = JSON.parse(readFileSync(path.join(dir, key, 'schema.json'), 'utf-8'))
    let typesCode = ''
    if (existsSync(path.join(dir, key, 'validate.js'))) unlinkSync(path.join(dir, key, 'validate.js'))
    if (existsSync(path.join(dir, key, 'types.ts'))) unlinkSync(path.join(dir, key, 'types.ts'))

    typesCode += await compileTs(schema, schema.$id || key,
      { bannerComment: '', unreachableDefinitions: true })

    writeFileSync(path.join(dir, key, 'types.ts'), typesCode)

    // the raw schema
    const schemaCode = `
// raw schema
export default ${JSON.stringify(schema, null, 2)}
`

    writeFileSync(path.join(dir, key, 'schema.js'), schemaCode)

    // the validate pre-compiled function
    const validate = ajv.compile(schema)
    // @ts-ignore
    let validateCode = standaloneCode(ajv, validate)

    validateCode = validateCode.replace('"use strict";', '')
    validateCode = '// @ts-ignore\n' + validateCode

    // some internal imports to ajv are not translated to esm, we do it here
    // cf https://github.com/ajv-validator/ajv-formats/pull/73
    if (validateCode.includes('require("ajv-formats/dist/formats")')) {
      validateCode = 'import { fullFormats } from "ajv-formats/dist/formats.js";\n' + validateCode
      validateCode = validateCode.replace(/require\("ajv-formats\/dist\/formats"\)\.fullFormats/g, 'fullFormats')
    }
    if (validateCode.includes('require("ajv/dist/runtime/ucs2length")')) {
      validateCode = 'import ucs2length from "ajv/dist/runtime/ucs2length.js";\n' + validateCode
      validateCode = validateCode.replace(/require\("ajv\/dist\/runtime\/ucs2length"\)/g, 'ucs2length')
    }

    writeFileSync(path.join(dir, key, 'validate.js'), validateCode)
  }
}
main()
