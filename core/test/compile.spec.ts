import { strict as assert } from 'assert'

import { compile } from '../src/'
import { serialize } from '../src/compile/serialize'

describe('compile schema function', () => {
  it('should compile simple schemas', () => {
    const compiled = compile({ type: 'string' })
    assert.ok(compiled)
  })
  it('should support serializing/deserializing the compiled layout', () => {
    const compiledLayout = compile({ type: 'string', layout: { if: "mode == 'read'" } }, { code: true })
    const code = serialize(compiledLayout)
    assert.ok(code)
    console.log(code)
  })
})
