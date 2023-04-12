import { strict as assert } from 'assert'
import { compile, StatefulLayout } from '../src'

describe('stateful layout', () => {
  it('should manage a simple schema with bi-directional data-binding', () => {
    const compiledLayout = compile({
      type: 'object',
      properties: {
        str1: { type: 'string' },
        str2: { type: 'string' }
      }
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.tree, 'write', 1000)
    assert.deepEqual(statefulLayout.root.layout, { comp: 'section' })
    assert.deepEqual(statefulLayout.root.value, {})
    assert.ok(statefulLayout.root.children)
    assert.equal(statefulLayout.root.children.length, 2)
    assert.ok(statefulLayout.root.children[0].key, 'str1')
    assert.equal(statefulLayout.root.children[0].value, '')

    // input is meant to be triggered by a UI component on a leaf node
    // and it should bubble up to the root value
    statefulLayout.input(statefulLayout.root.children[0], 'test')
    assert.deepEqual(statefulLayout.root.value, { str1: 'test' })
    assert.equal(statefulLayout.root.children[0].value, 'test')

    // simply set the value to hydrate the from the root to the leaves
    statefulLayout.value = { str1: 'test2', str2: 'test3' }
    assert.deepEqual(statefulLayout.root.value, { str1: 'test2', str2: 'test3' })
    assert.equal(statefulLayout.root.children[0].value, 'test2')
  })
})
