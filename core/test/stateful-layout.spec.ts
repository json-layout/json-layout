import { compileSchema, StatefulLayout } from '../src/stateful-layout'

describe('compile schema function', () => {
  it('should accept a schema and return everything needed to create stateful layouts', () => {
    const statefulLayout = new StatefulLayout(compileSchema({
      type: 'object',
      properties: {
        str1: { type: 'string' },
        str2: { type: 'string' }
      }
    }))
    console.log(statefulLayout.root.inspect())
  })
})
