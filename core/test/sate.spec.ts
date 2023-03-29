import { strict as assert } from 'assert'
import { compile, SectionNode, StatefulLayout, TextFieldNode } from '../src/'

describe('compile schema function', () => {
  it('should accept a schema and return everything needed to create stateful layouts', () => {
    const compiledLayout = compile({
      type: 'object',
      properties: {
        str1: { type: 'string' },
        str2: { type: 'string' }
      }
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.tree, 'write', 1000)
    console.log(statefulLayout.root)
    assert.ok(statefulLayout.root instanceof SectionNode)
    assert.ok(statefulLayout.root.children)
    assert.equal(statefulLayout.root.children.length, 2)
    assert.ok(statefulLayout.root.children[0] instanceof TextFieldNode)
    statefulLayout.root.children[0].input('test')
    assert.deepEqual(statefulLayout.root.value, { str1: 'test' })
    assert.equal(statefulLayout.root.children[0].value, 'test')
    statefulLayout.hydrate({ str1: 'test2', str2: 'test3' })
    console.log(statefulLayout.root)
  })
})
