import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { compile, StatefulLayout } from '../src/index.js'

describe('stateful layout validation state', () => {
  const defaultOptions = { debounceInputMs: 0 }

  it('should manage a section level validation error', async () => {
    const compiledLayout = await compile({
      type: 'object',
      required: ['missingProp'],
      properties: {
        str1: { type: 'string' }
      }
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions, { str2: 'test' })
    assert.equal(statefulLayout.stateTree.valid, false)
    assert.equal(statefulLayout.stateTree.root.error, 'must have required property missingProp')
  })

  it('should manage a validation error in a child', async () => {
    const compiledLayout = await compile({
      type: 'object',
      required: ['str1'],
      properties: {
        str1: { type: 'string' },
        str2: { type: 'string', pattern: '^[A-Z]+$' }
      }
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions, { str2: 'test' })
    assert.equal(statefulLayout.stateTree.valid, false)
    assert.equal(statefulLayout.stateTree.root.error, undefined)
    assert.equal(statefulLayout.stateTree.root.children?.[0].data, undefined)
    assert.equal(statefulLayout.stateTree.root.children?.[0].error, 'required information')
    assert.equal(statefulLayout.stateTree.root.children?.[1].data, 'test')
    assert.equal(statefulLayout.stateTree.root.children?.[1].error, 'must match pattern "^[A-Z]+$"')

    statefulLayout.input(statefulLayout.stateTree.root.children?.[0], 'ok')
    assert.equal(statefulLayout.stateTree.root.children?.[0].error, undefined)

    statefulLayout.input(statefulLayout.stateTree.root.children?.[1], 'TEST')
    assert.equal(statefulLayout.stateTree.root.children?.[1].error, undefined)

    assert.equal(statefulLayout.stateTree.valid, true)
  })

  it('should manage a validation error in a child of a composite layout', async () => {
    const compiledLayout = await compile({
      $id: 'https://test.com/entity',
      type: 'object',
      required: ['str1'],
      layout: [
        { text: 'header' },
        [
          'str1', 'str2'
        ],
        { text: 'footer' }
      ],
      properties: {
        str1: { type: 'string' },
        str2: { type: 'string', pattern: '^[A-Z]+$' }
      }
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions, { str2: 'test' })
    // console.log(statefulLayout.stateTree)
    assert.equal(statefulLayout.stateTree.valid, false)
    assert.equal(statefulLayout.stateTree.root.error, undefined)
    assert.deepEqual(statefulLayout.stateTree.root.children?.[0].data, { str2: 'test' })
    assert.equal(statefulLayout.stateTree.root.children?.[0].error, undefined)
    assert.equal(statefulLayout.stateTree.root.children?.[0].childError, undefined)
    assert.deepEqual(statefulLayout.stateTree.root.children?.[1].data, { str2: 'test' })
    assert.deepEqual(statefulLayout.stateTree.root.children?.[2].data, { str2: 'test' })

    assert.equal(statefulLayout.stateTree.root.children?.[1].error, undefined)
    assert.ok(statefulLayout.stateTree.root.children?.[1].childError)
    assert.equal(statefulLayout.stateTree.root.children?.[1].children?.[0].data, undefined)
    assert.equal(statefulLayout.stateTree.root.children?.[1].children?.[0].error, 'required information')
    assert.equal(statefulLayout.stateTree.root.children?.[1].children?.[1].data, 'test')
    assert.equal(statefulLayout.stateTree.root.children?.[1].children?.[1].error, 'must match pattern "^[A-Z]+$"')

    statefulLayout.input(statefulLayout.stateTree.root.children?.[1].children?.[0], 'ok')
    assert.equal(statefulLayout.stateTree.root.children?.[1].children?.[0].error, undefined)
    statefulLayout.input(statefulLayout.stateTree.root.children?.[1].children?.[1], 'TEST')
    assert.equal(statefulLayout.stateTree.root.children?.[1].children?.[1].error, undefined)
    assert.equal(statefulLayout.stateTree.valid, true)
  })

  it('should create required intermediate objects and manage nested validation rules', async () => {
    const compiledLayout = await compile({
      type: 'object',
      required: ['obj1', 'obj2'],
      properties: {
        obj1: {
          type: 'object',
          required: ['str1'],
          properties: {
            str1: { type: 'string', pattern: '^[A-Z]+$' }
          }
        },
        obj2: {
          type: 'object',
          required: ['str1'],
          properties: {
            str1: { type: 'string', pattern: '^[A-Z]+$' }
          }
        }
      }
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions, {})
    assert.equal(statefulLayout.stateTree.valid, false)
    assert.equal(statefulLayout.stateTree.root.error, undefined)
    assert.equal(statefulLayout.stateTree.root.children?.[0].error, undefined)
    assert.equal(statefulLayout.stateTree.root.children?.[0].childError, true)
    assert.equal(statefulLayout.stateTree.root.children?.[0].children?.[0].error, 'required information')
    assert.equal(statefulLayout.stateTree.root.children?.[1].error, undefined)
    assert.equal(statefulLayout.stateTree.root.children?.[1].childError, true)
    assert.equal(statefulLayout.stateTree.root.children?.[1].children?.[0].error, 'required information')

    statefulLayout.input(statefulLayout.stateTree.root.children?.[0].children?.[0], 'ko')
    assert.equal(statefulLayout.stateTree.root.children?.[0].children?.[0].error, 'must match pattern "^[A-Z]+$"')
    assert.equal(statefulLayout.stateTree.root.error, undefined)
    statefulLayout.input(statefulLayout.stateTree.root.children[0].children[0], 'koo')
    assert.equal(statefulLayout.stateTree.root.children?.[0].children?.[0].error, 'must match pattern "^[A-Z]+$"')
    assert.equal(statefulLayout.stateTree.root.error, undefined)

    statefulLayout.input(statefulLayout.stateTree.root.children?.[0].children?.[0], 'OK')
    assert.equal(statefulLayout.stateTree.root.children?.[0].children?.[0].error, undefined)

    statefulLayout.input(statefulLayout.stateTree.root.children?.[1].children?.[0], 'OK')
    assert.equal(statefulLayout.stateTree.root.children?.[1].children?.[0].error, undefined)

    assert.equal(statefulLayout.stateTree.valid, true)
  })

  it('should not create an intermediate object that would end up with an error', async () => {
    const compiledLayout = await compile({
      type: 'object',
      required: [],
      properties: {
        obj1: {
          type: 'object',
          required: ['str1'],
          properties: {
            str1: { type: 'string' }
          }
        }
      }
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions, {})
    assert.equal(statefulLayout.stateTree.valid, true)
  })

  it('should return a proper error for a simple oneOf', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        str1: { type: 'string', oneOf: [{ const: 'val1', title: 'title 1' }, { const: 'val2', title: 'title 1' }] }
      }
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions, { str1: 'test' })
    assert.equal(statefulLayout.stateTree.valid, false)
    assert.equal(statefulLayout.stateTree.root.children?.[0]?.error, 'chose one')
  })

  it('should return a error for a list item', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        arr1: {
          type: 'array',
          items: {
            type: 'object',
            required: ['str1'],
            properties: {
              str1: { type: 'string', pattern: '^[A-Z]+$' }
            }
          }
        }
      }
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], {
      updateOn: 'blur',
      validateOn: 'input'
    })
    assert.equal(statefulLayout.stateTree.valid, true)
    assert.ok(statefulLayout.stateTree.root.children?.[0])
    statefulLayout.input(statefulLayout.stateTree.root.children[0], [undefined])
    assert.equal(statefulLayout.stateTree.valid, false)
    // assert.equal(statefulLayout.stateTree.root.children?.[0]?.error, 'chose one')
  })
})
