#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-var-requires */

import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs'
import { compile as compileTs } from 'json-schema-to-typescript'
import path from 'node:path'
import { getComponentSchema, standardComponents } from '../src/components/index.js'

const compileTsOptions = {
  bannerComment: '',
  unreachableDefinitions: true
}

const main = async () => {
  const dir = path.resolve('./src')
  console.log(`look for schemas in subdirectories of ${dir}`)

  const keys = readdirSync(dir)
    .filter(key => existsSync(path.join(dir, key, 'schema.json')))

  /** @type {Record<string, any>} */
  const schemas = {}

  for (const key of keys) {
    console.log(key)
    const schema = JSON.parse(readFileSync(path.join(dir, key, 'schema.json'), 'utf-8'))
    schemas[schema.$id] = schema

    const typesCode = await compileTs(schema, schema.$id || key, compileTsOptions)
    writeFileSync(path.join(dir, key, 'types.ts'), typesCode)

    const schemaCode = `
// raw schema
export default ${JSON.stringify(schema, null, 2)}
`
    writeFileSync(path.join(dir, key, 'schema.js'), schemaCode)
  }

  const { getComponentTypesCode, getComponentTypesCodeImport } = await import('../src/components/compile-types.js')
  let componentTypesCode = getComponentTypesCodeImport('../normalized-layout/types.js')
  for (const component of standardComponents) {
    const schema = getComponentSchema(component)
    componentTypesCode += await getComponentTypesCode(schema, component.name, false)
  }
  writeFileSync(path.join(dir, 'components', 'types.ts'), componentTypesCode)
}
main()
