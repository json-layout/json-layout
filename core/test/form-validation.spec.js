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
    assert.equal(statefulLayout.stateTree.root.children?.[0].error, 'Required information')
    assert.equal(statefulLayout.stateTree.root.children?.[0].validated, false)

    statefulLayout.input(statefulLayout.stateTree.root.children?.[0], 'test1')
    assert.deepEqual(statefulLayout._lastCreateStateTreeContext._debugCache['/str2'], ['miss', 'miss'])
    assert.equal(statefulLayout.stateTree.root.validated, true)
    assert.equal(statefulLayout.stateTree.root.children?.[0].error, 'Must match ^[A-Z]+$')
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
    assert.equal(statefulLayout.stateTree.root.children?.[0].error, 'Required information')
    assert.equal(statefulLayout.stateTree.root.children?.[0].validated, false)

    statefulLayout.input(statefulLayout.stateTree.root.children?.[0], 'test1')
    assert.equal(statefulLayout.stateTree.root.validated, false)
    assert.equal(statefulLayout.stateTree.root.children?.[0].error, 'Must match ^[A-Z]+$')
    assert.equal(statefulLayout.stateTree.root.children?.[0].validated, false)

    statefulLayout.blur(statefulLayout.stateTree.root.children?.[0])
    assert.deepEqual(statefulLayout._lastCreateStateTreeContext._debugCache['/str2'], ['miss', 'miss', 'hit'])
    assert.equal(statefulLayout.stateTree.root.children?.[0].error, 'Must match ^[A-Z]+$')
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
    assert.equal(statefulLayout.stateTree.root.children?.[0].error, 'Required information')
    assert.equal(statefulLayout.stateTree.root.children?.[0].validated, false)

    statefulLayout.input(statefulLayout.stateTree.root.children?.[0], 'test1')
    assert.equal(statefulLayout.stateTree.root.validated, false)
    assert.equal(statefulLayout.stateTree.root.children?.[0].error, 'Must match ^[A-Z]+$')
    assert.equal(statefulLayout.stateTree.root.children?.[0].validated, false)

    statefulLayout.blur(statefulLayout.stateTree.root.children?.[0])
    assert.equal(statefulLayout.stateTree.root.children?.[0].error, 'Must match ^[A-Z]+$')
    assert.equal(statefulLayout.stateTree.root.children?.[0].validated, false)

    statefulLayout.validate()
    assert.equal(statefulLayout.stateTree.root.children?.[0].error, 'Must match ^[A-Z]+$')
    assert.equal(statefulLayout.stateTree.root.children?.[0].validated, true)

    statefulLayout.resetValidation()
    assert.equal(statefulLayout.stateTree.root.children?.[0].error, 'Must match ^[A-Z]+$')
    assert.equal(statefulLayout.stateTree.root.children?.[0].validated, true)

    statefulLayout.input(statefulLayout.stateTree.root.children?.[0], '')
    statefulLayout.resetValidation()
    assert.equal(statefulLayout.stateTree.root.children?.[0].error, 'Required information')
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
    assert.equal(statefulLayout.stateTree.root.children?.[0].error, 'Must match ^[A-Z]+$')
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
    assert.equal(statefulLayout.stateTree.root.children?.[0].error, 'Required information')
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
    assert.equal(statefulLayout.stateTree.root.children?.[0].error, 'Must match ^[A-Z]+$')
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
    assert.equal(statefulLayout.stateTree.root.children?.[0].children?.[0].error, 'Must match ^[A-Z]+$')
    assert.equal(statefulLayout.stateTree.root.children?.[0].children?.[0].childError, undefined)
  })

  it('should use the required message for a property declared in an allOf section', async () => {
    // fields grouped in sections while the required list stays on the object, as a dataset form builds them
    const compiledLayout = await compile({
      type: 'object',
      required: ['str1', 'str2'],
      allOf: [
        { title: 'Section 1', properties: { str1: { type: 'string' } } },
        { title: 'Section 2', properties: { str2: { type: 'string' } } }
      ]
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], { ...defaultOptions, initialValidation: 'always' }, {})
    assert.equal(statefulLayout.stateTree.root.children?.[0].children?.[0].key, 'str1')
    assert.equal(statefulLayout.stateTree.root.children?.[0].children?.[0].error, 'Required information')
    assert.equal(statefulLayout.stateTree.root.children?.[1].children?.[0].error, 'Required information')
  })

  it('should name a required field that is not rendered in the error of its section', async () => {
    const compiledLayout = await compile({
      type: 'object',
      title: 'Billing',
      required: ['vat'],
      properties: {
        pro: { type: 'boolean' },
        vat: { type: 'string', title: 'VAT number', layout: { if: 'parent.data?.pro' } }
      }
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], { ...defaultOptions, initialValidation: 'always' }, {})
    assert.equal(statefulLayout.stateTree.root.error, 'Required information: VAT number')

    // the field shown again carries the error itself, without its name
    statefulLayout.input(statefulLayout.stateTree.root.children[0], true)
    assert.equal(statefulLayout.stateTree.root.error, undefined)
    assert.equal(statefulLayout.stateTree.root.children[1].error, 'Required information')
  })

  it('should name the field with the separator of the locale', async () => {
    const compiledLayout = await compile({
      type: 'object',
      required: ['vat'],
      layout: { children: ['pro'] },
      properties: { pro: { type: 'boolean' }, vat: { type: 'string', title: 'N° de TVA' } }
    }, { locale: 'fr' })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], { ...defaultOptions, initialValidation: 'always' }, {})
    assert.equal(statefulLayout.stateTree.root.error, 'Information obligatoire : N° de TVA')
  })

  it('should name the field with a title containing $ as written', async () => {
    const compiledLayout = await compile({
      type: 'object',
      required: ['price'],
      layout: { children: [] },
      properties: { price: { type: 'string', title: "Price ($') $&" } }
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], { ...defaultOptions, initialValidation: 'always' }, {})
    assert.equal(statefulLayout.stateTree.root.error, "Required information: Price ($') $&")
  })

  it('should name a required field declared in a oneOf branch by its title', async () => {
    const compiledLayout = await compile({
      type: 'object',
      required: ['vat'],
      properties: { kind: { type: 'string' } },
      oneOf: [
        { title: 'Pro', properties: { vat: { type: 'string', title: 'VAT number', layout: { if: 'false' } } } },
        { title: 'Private', properties: { other: { type: 'string' } } }
      ]
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], { ...defaultOptions, initialValidation: 'always' }, {})
    assert.equal(statefulLayout.stateTree.root.error, 'Required information: VAT number')
  })
})
