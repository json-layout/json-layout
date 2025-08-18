import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'

import { compile, StatefulLayout } from '../src/index.js'

import { isCompObject } from '@json-layout/vocabulary'

describe('Management of pattern properties', () => {
  const defaultOptions = { debounceInputMs: 0 }

  it('should manage a nullable type from a types array', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        str1: { type: ['string', 'null'] }
      }
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions)
    assert.deepEqual(statefulLayout.stateTree.root.layout.comp, 'section')
    assert.deepEqual(statefulLayout.stateTree.root.data, { str1: null })
    assert.ok(statefulLayout.stateTree.root.children)
    assert.equal(statefulLayout.stateTree.root.children.length, 1)
    assert.ok(statefulLayout.stateTree.root.children[0].skeleton.key, 'str1')
    assert.equal(statefulLayout.stateTree.root.children[0].data, null)

    // input is meant to be triggered by a UI component on a leaf node
    // and it should bubble up to the root value
    statefulLayout.input(statefulLayout.stateTree.root.children[0], 'test')
    assert.deepEqual(statefulLayout.stateTree.root.data, { str1: 'test' })
    assert.equal(statefulLayout.stateTree.root.children[0].data, 'test')

    // simply set the value to hydrate from the root to the leaves
    statefulLayout.data = { str1: 'test2', str2: 'test3', int1: 11, nb1: 11.11 }
    assert.deepEqual(statefulLayout.stateTree.root.data, { str1: 'test2', str2: 'test3', int1: 11, nb1: 11.11 })
    assert.equal(statefulLayout.stateTree.root.children[0].data, 'test2')
  })

  it('should manage a nullable part of a anyOf/oneOf', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        str1: {
          anyOf: [
            { type: 'string', pattern: '^[A-Z]+$' },
            { type: 'null' }
          ]
        },
        str2: {
          type: 'string'
        }
      }
    })
    assert.ok(isCompObject(compiledLayout.normalizedLayouts['_jl#/properties/str1/anyOf/0']))
    assert.equal(compiledLayout.normalizedLayouts['_jl#/properties/str1/anyOf/0'].comp, 'text-field')
    assert.equal(compiledLayout.normalizedLayouts['_jl#/properties/str1/anyOf/0'].nullable, true)
    assert.ok(isCompObject(compiledLayout.normalizedLayouts['_jl#/properties/str2']))
    assert.equal(compiledLayout.normalizedLayouts['_jl#/properties/str2'].comp, 'text-field')
    assert.equal(compiledLayout.normalizedLayouts['_jl#/properties/str2'].nullable, undefined)

    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions)
    assert.deepEqual(statefulLayout.stateTree.root.layout.comp, 'section')
    assert.equal(statefulLayout.stateTree.root.children?.length, 2)
    assert.ok(statefulLayout.stateTree.root.children[0].layout.comp, 'text-field')
    assert.ok(statefulLayout.stateTree.root.children[1].layout.comp, 'text-field')
    assert.deepEqual(statefulLayout.stateTree.root.data, { str1: null })

    statefulLayout.input(statefulLayout.stateTree.root.children[0], 'test')
    assert.deepEqual(statefulLayout.stateTree.root.data, { str1: 'test' })
    assert.equal(statefulLayout.stateTree.valid, false)
    assert.equal(statefulLayout.stateTree.root.children[0].error, 'must match pattern "^[A-Z]+$"')
  })

  it('should manage a nullable array', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        arr1: {
          anyOf: [
            { type: 'array', items: { type: 'string' } },
            { type: 'null' }
          ]
        }
      }
    })
    assert.ok(isCompObject(compiledLayout.normalizedLayouts['_jl#/properties/arr1/anyOf/0']))
    assert.equal(compiledLayout.normalizedLayouts['_jl#/properties/arr1/anyOf/0'].comp, 'combobox')
    assert.equal(compiledLayout.normalizedLayouts['_jl#/properties/arr1/anyOf/0'].nullable, true)

    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions)
    assert.deepEqual(statefulLayout.stateTree.root.layout.comp, 'section')
    assert.equal(statefulLayout.stateTree.root.children?.length, 1)
    assert.ok(statefulLayout.stateTree.root.children[0].layout.comp, 'combobox')
    assert.deepEqual(statefulLayout.stateTree.root.data, { arr1: null })
    assert.equal(statefulLayout.stateTree.valid, true)

    statefulLayout.input(statefulLayout.stateTree.root.children[0], ['test'])
    assert.deepEqual(statefulLayout.stateTree.root.data, { arr1: ['test'] })
    assert.equal(statefulLayout.stateTree.valid, true)

    statefulLayout.input(statefulLayout.stateTree.root.children[0], [])
    assert.deepEqual(statefulLayout.stateTree.root.data, { arr1: null })
    assert.equal(statefulLayout.stateTree.valid, true)
  })

  it('should manage error capture of a nullable object', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        obj1: {
          anyOf: [{
            type: 'object',
            required: ['str1'],
            properties: {
              str1: { type: 'string', enum: ['val1', 'val2'] },
            }
          }, { type: 'null' }]
        }
      }
    })

    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions, { obj1: { str1: 'test' } })
    assert.equal(statefulLayout.valid, false)
    assert.equal(statefulLayout.stateTree.root.error, undefined)
    assert.equal(statefulLayout.stateTree.root.childError, true)
    assert.equal(statefulLayout.stateTree.root.children?.[0]?.error, undefined)
    assert.equal(statefulLayout.stateTree.root.children?.[0]?.childError, true)
    assert.equal(statefulLayout.stateTree.root.children?.[0]?.children?.[0]?.error, 'must be equal to one of the allowed values')
  })
})
