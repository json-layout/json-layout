import { compileSchema, StatefulLayout } from '../src/stateful-layout'

describe('compile schema function', () => {
  it('should accept a schema and return everything needed to create stateful layouts', () => {
    const compiled = compileSchema({ type: 'string' })
    console.log(compiled)
    const statefulLayout = new StatefulLayout(compiled)
    console.log(statefulLayout.root.inspect())
  })
})
