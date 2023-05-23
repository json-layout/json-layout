import { compile, compileAndSerialize } from '../src/'

describe('compile schema function', () => {
  it('should compile simple schemas', () => {
    const compiled = compile({ type: 'string' })
    console.log(compiled)
  })
  it('should support serializing/deserializing the compiled layout', () => {
    const serialized = compileAndSerialize({ type: 'string' })
    console.log(serialized)
  })
})
