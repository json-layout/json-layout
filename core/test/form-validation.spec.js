import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { compile, StatefulLayout } from '../src/index.js'

describe('stateful layout validation state', () => {
  const defaultOptions = { debounceInputMs: 0 }

  it('flag a node as validated based on input event', async () => {
    const compiledLayout = await compile({
      type: 'object',
      required: ['str1'],
      properties: {
        str1: { type: 'string', pattern: '^[A-Z]+$' },
        str2: { type: 'string', pattern: '^[A-Z]+$' }
      }
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], { ...defaultOptions, _debugCache: true }, {})
    assert.equal(statefulLayout.stateTree.root.validated, false)
    assert.equal(statefulLayout.stateTree.root.children?.[0].error, 'required information')
    assert.equal(statefulLayout.stateTree.root.children?.[0].validated, false)

    statefulLayout.input(statefulLayout.stateTree.root.children?.[0], 'test1')
    assert.deepEqual(statefulLayout._lastCreateStateTreeContext._debugCache['/str2'], ['miss', 'miss'])
    assert.equal(statefulLayout.stateTree.root.validated, true)
    assert.equal(statefulLayout.stateTree.root.children?.[0].error, 'must match pattern "^[A-Z]+$"')
    assert.equal(statefulLayout.stateTree.root.children?.[0].validated, true)
  })

  it('flag a node as validated based on blur event', async () => {
    const compiledLayout = await compile({
      type: 'object',
      required: ['str1'],
      properties: {
        str1: { type: 'string', pattern: '^[A-Z]+$' },
        str2: { type: 'string', pattern: '^[A-Z]+$' }
      }
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], { ...defaultOptions, validateOn: 'blur', _debugCache: true }, {})
    assert.equal(statefulLayout.stateTree.root.validated, false)
    assert.equal(statefulLayout.stateTree.root.children?.[0].error, 'required information')
    assert.equal(statefulLayout.stateTree.root.children?.[0].validated, false)

    statefulLayout.input(statefulLayout.stateTree.root.children?.[0], 'test1')
    assert.equal(statefulLayout.stateTree.root.validated, false)
    assert.equal(statefulLayout.stateTree.root.children?.[0].error, 'must match pattern "^[A-Z]+$"')
    assert.equal(statefulLayout.stateTree.root.children?.[0].validated, false)

    statefulLayout.blur(statefulLayout.stateTree.root.children?.[0])
    assert.deepEqual(statefulLayout._lastCreateStateTreeContext._debugCache['/str2'], ['miss', 'miss', 'hit'])
    assert.equal(statefulLayout.stateTree.root.children?.[0].error, 'must match pattern "^[A-Z]+$"')
    assert.equal(statefulLayout.stateTree.root.children?.[0].validated, true)
  })

  it('flag a node as validated based on submit event', async () => {
    const compiledLayout = await compile({
      type: 'object',
      required: ['str1'],
      properties: {
        str1: { type: 'string', pattern: '^[A-Z]+$' }
      }
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], { ...defaultOptions, validateOn: 'submit' }, {})
    assert.equal(statefulLayout.stateTree.root.validated, false)
    assert.equal(statefulLayout.stateTree.root.children?.[0].error, 'required information')
    assert.equal(statefulLayout.stateTree.root.children?.[0].validated, false)

    statefulLayout.input(statefulLayout.stateTree.root.children?.[0], 'test1')
    assert.equal(statefulLayout.stateTree.root.validated, false)
    assert.equal(statefulLayout.stateTree.root.children?.[0].error, 'must match pattern "^[A-Z]+$"')
    assert.equal(statefulLayout.stateTree.root.children?.[0].validated, false)

    statefulLayout.blur(statefulLayout.stateTree.root.children?.[0])
    assert.equal(statefulLayout.stateTree.root.children?.[0].error, 'must match pattern "^[A-Z]+$"')
    assert.equal(statefulLayout.stateTree.root.children?.[0].validated, false)

    statefulLayout.validate()
    assert.equal(statefulLayout.stateTree.root.children?.[0].error, 'must match pattern "^[A-Z]+$"')
    assert.equal(statefulLayout.stateTree.root.children?.[0].validated, true)

    statefulLayout.resetValidation()
    assert.equal(statefulLayout.stateTree.root.children?.[0].error, 'must match pattern "^[A-Z]+$"')
    assert.equal(statefulLayout.stateTree.root.children?.[0].validated, true)

    statefulLayout.input(statefulLayout.stateTree.root.children?.[0], '')
    statefulLayout.resetValidation()
    assert.equal(statefulLayout.stateTree.root.children?.[0].error, 'required information')
    assert.equal(statefulLayout.stateTree.root.children?.[0].validated, false)
  })

  it('flag a node as validated based on initial data and initialValidation=withData', async () => {
    const compiledLayout = await compile({
      type: 'object',
      required: ['str1'],
      properties: {
        str1: { type: 'string', pattern: '^[A-Z]+$' }
      }
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions, { str1: 'test1' })
    assert.equal(statefulLayout.stateTree.root.validated, true)
    assert.equal(statefulLayout.stateTree.root.children?.[0].error, 'must match pattern "^[A-Z]+$"')
    assert.equal(statefulLayout.stateTree.root.children?.[0].validated, true)
  })

  it('flag a node as validated based on initial initialValidation=always', async () => {
    const compiledLayout = await compile({
      type: 'object',
      required: ['str1'],
      properties: {
        str1: { type: 'string', pattern: '^[A-Z]+$' }
      }
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], { ...defaultOptions, initialValidation: 'always' }, {})
    assert.equal(statefulLayout.stateTree.root.validated, true)
    assert.equal(statefulLayout.stateTree.root.children?.[0].error, 'required information')
    assert.equal(statefulLayout.stateTree.root.children?.[0].validated, true)
  })

  it('not flag a node as validated based on initial initialValidation=never', async () => {
    const compiledLayout = await compile({
      type: 'object',
      required: ['str1'],
      properties: {
        str1: { type: 'string', pattern: '^[A-Z]+$' }
      }
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], { ...defaultOptions, initialValidation: 'never' }, { str1: 'test1' })
    assert.equal(statefulLayout.stateTree.root.validated, false)
    assert.equal(statefulLayout.stateTree.root.children?.[0].error, 'must match pattern "^[A-Z]+$"')
    assert.equal(statefulLayout.stateTree.root.children?.[0].validated, false)
  })

  it('should set childError=true on intermediate sections with errors in children', async () => {
    const compiledLayout = await compile({
      type: 'object',
      required: ['obj1'],
      properties: {
        obj1: {
          type: 'object',
          required: ['str1'],
          properties: {
            str1: { type: 'string', pattern: '^[A-Z]+$' }
          }
        }
      }
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], { ...defaultOptions, initialValidation: 'never' }, { obj1: { str1: 'test1' } })
    assert.equal(statefulLayout.stateTree.root.childError, true)
    assert.equal(statefulLayout.stateTree.root.children?.[0].childError, true)
    assert.equal(statefulLayout.stateTree.root.children?.[0].children?.[0].error, 'must match pattern "^[A-Z]+$"')
    assert.equal(statefulLayout.stateTree.root.children?.[0].children?.[0].childError, undefined)
  })
})
