#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-var-requires */

import Ajv2019 from 'ajv/dist/2019'
import * as fs from 'fs'
import camelcase from 'camelcase'
const { compile: compileTs } = require('json-schema-to-typescript')
const path = require('node:path')
const standaloneCode = require('ajv/dist/standalone').default

const ajv = new Ajv2019({
  code: {
    source: true,
    esm: true
    // optimize: true
  },
  discriminator: true,
  allowMatchingProperties: true
})

const main = async () => {
  const dir = path.resolve('./src')
  console.log(`look for schemas in subdirectories of ${dir}`)

  const keys = fs.readdirSync(dir)
    .filter(key => fs.existsSync(path.join(dir, key, 'schema.json')))

  for (const key of keys) {
    console.log(key)
    // const ts = await compile(schema, key, { $refOptions: { resolve: { 'data-fair-lib': dataFairLibResolver, local: localResolver } } })
    const schema = require(path.join(dir, key, 'schema'))
    let code = ''
    if (fs.existsSync(path.join(dir, key, 'validate.js'))) fs.unlinkSync(path.join(dir, key, 'validate.js'))
    if (fs.existsSync(path.join(dir, key, 'types.ts'))) fs.unlinkSync(path.join(dir, key, 'types.ts'))

    code += await compileTs(schema, schema.$id || key,
      { bannerComment: '', unreachableDefinitions: true }) as string

    // the raw schema
    code += `
// raw schema
export const ${camelcase(key)}Schema = ${JSON.stringify(schema, null, 2)}
`

    fs.writeFileSync(path.join(dir, key, 'types.ts'), code)

    // the validate pre-compiled function
    const validate = ajv.compile(schema)
    const validateCode = standaloneCode(ajv, validate)
    fs.writeFileSync(path.join(dir, key, 'validate.js'), validateCode)
  }
}
main()
