import { strict as assert } from 'assert'
import { compile, StatefulLayout } from '../src'

describe('stateful layout', () => {
  it('should manage a simple schema with bi-directional data-binding', () => {
    const compiledLayout = compile({
      type: 'object',
      properties: {
        str1: { type: 'string' },
        str2: { type: 'string' },
        int1: { type: 'integer' },
        nb1: { type: 'number' }
      }
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.tree, 'write', 1000)
    assert.deepEqual(statefulLayout.root.layout, { comp: 'section' })
    assert.deepEqual(statefulLayout.root.value, {})
    assert.ok(statefulLayout.root.children)
    assert.equal(statefulLayout.root.children.length, 4)
    assert.ok(statefulLayout.root.children[0].key, 'str1')
    assert.equal(statefulLayout.root.children[0].value, '')

    // input is meant to be triggered by a UI component on a leaf node
    // and it should bubble up to the root value
    statefulLayout.input(statefulLayout.root.children[0], 'test')
    assert.deepEqual(statefulLayout.root.value, { str1: 'test' })
    assert.equal(statefulLayout.root.children[0].value, 'test')

    // simply set the value to hydrate from the root to the leaves
    statefulLayout.value = { str1: 'test2', str2: 'test3', int1: 11, nb1: 11.11 }
    assert.deepEqual(statefulLayout.root.value, { str1: 'test2', str2: 'test3', int1: 11, nb1: 11.11 })
    assert.equal(statefulLayout.root.children[0].value, 'test2')
  })

  it('should manage simple validation of value', () => {
    const compiledLayout = compile({
      type: 'object',
      required: ['str1', 'missingProp'],
      properties: {
        str1: { type: 'string' },
        str2: { type: 'string', pattern: '^$[A-Z]+$' },
        obj1: {
          type: 'object',
          required: ['str1'],
          properties: {
            str1: { type: 'string' }
          }
        }
      }
      /* allOf: [{
        // required: ['str1'],
        properties: {
          str3: { type: 'string', pattern: '^$[A-Z]+$' }
        }
      }] */
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.tree, 'write', 1000, { str2: 'test' })
    assert.equal(statefulLayout.errors.length, 3)
    assert.equal(statefulLayout.root.error, 'must have required property \'missingProp\'')
    assert.equal(statefulLayout.root.children?.[0].error, 'required')
    assert.equal(statefulLayout.root.children?.[1].error, 'must match pattern "^$[A-Z]+$"')
  })
})
