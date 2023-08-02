import { strict as assert } from 'assert'

import { compile, compileAndSerialize } from '../src/'

describe('compile schema function', () => {
  it('should compile simple schemas', () => {
    const compiled = compile({ type: 'string' })
    assert.ok(compiled)
  })
  it('should support serializing/deserializing the compiled layout', () => {
    const serialized = compileAndSerialize({ type: 'string' })
    assert.ok(serialized)
  })
})
