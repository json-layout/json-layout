import { strict as assert } from 'assert'
import { writeFile } from 'fs/promises'
import { resolve } from 'path'

import { compile } from '../src/'
import { serialize } from '../src/compile/serialize'

describe('compile schema function', () => {
  it('should compile simple schemas', () => {
    const compiled = compile({ type: 'string' })
    assert.ok(compiled)
  })
  it('should support serializing the compiled layout', async () => {
    const compiledLayout = compile({ type: 'string', layout: { if: "mode == 'read'" } }, { code: true })
    const code = serialize(compiledLayout)
    assert.ok(code)

    const filePath = resolve(__dirname, '../tmp/compiled.js')
    // dynamic loading of file in our context requires the commonjs syntax
    await writeFile(filePath, code.replace('export default {', 'module.exports = {'))

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const serializedLayout = require(filePath)
    assert.deepEqual(serializedLayout.skeletonTree, compiledLayout.skeletonTree)
    assert.deepEqual(serializedLayout.normalizedLayouts, compiledLayout.normalizedLayouts)
  })
})
