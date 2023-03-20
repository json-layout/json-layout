import { compileAndSerialize } from '../src/stateful-layout/serialize'

describe('compile schema function', () => {
  it('should support serializing/deserializing the compiled layout', () => {
    const serialized = compileAndSerialize({ type: 'string' })
    console.log(serialized)
  })
})
