import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import nock from 'nock'
import fetch from 'node-fetch'
import { compile, StatefulLayout } from '../src/index.js'
// import Debug from 'debug'

// const debug = Debug('test')

// @ts-ignore
global.fetch = fetch

const defaultOptions = { debounceInputMs: 0, removeAdditional: true }

describe('conditional schema support', () => {
  it('should display properties from a if/then/else', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        str1: { type: 'string' }
      },
      if: {
        required: ['str1'],
        properties: { str1: { const: 'test' } }
      },
      then: {
        properties: {
          str2: { type: 'string' }
        }
      },
      else: {
        properties: {
          str3: { type: 'string' }
        }
      }
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions)
    assert.equal(statefulLayout.stateTree.root.layout.comp, 'section')
    assert.equal(statefulLayout.stateTree.root.children?.length, 2)

    // input that satisfies the if condition
    statefulLayout.input(statefulLayout.stateTree.root.children[0], 'test')
    assert.equal(statefulLayout.stateTree.root.children[1].layout.comp, 'section')
    assert.equal(statefulLayout.stateTree.root.children[1].key, '$then')
    assert.equal(statefulLayout.stateTree.root.children[1].children?.length, 1)
    statefulLayout.input(statefulLayout.stateTree.root.children[1].children[0], 'hello')
    assert.deepEqual(statefulLayout.data, { str1: 'test', str2: 'hello' })

    // input that satisfies the else condition
    statefulLayout.input(statefulLayout.stateTree.root.children[0], 'not test')
    assert.equal(statefulLayout.stateTree.root.children[1].layout.comp, 'section')
    assert.equal(statefulLayout.stateTree.root.children[1].key, '$else')
    assert.deepEqual(statefulLayout.data, { str1: 'not test' })
    assert.equal(statefulLayout.stateTree.root.children[1].children?.length, 1)
    statefulLayout.input(statefulLayout.stateTree.root.children[1].children[0], 'hello')
    assert.deepEqual(statefulLayout.data, { str1: 'not test', str3: 'hello' })
  })

  it('should display properties from a dependentSchema', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        str1: { type: 'string' }
      },
      dependentSchemas: {
        str1: {
          properties: {
            str2: { type: 'string' }
          }
        }
      }
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions)
    assert.equal(statefulLayout.stateTree.root.layout.comp, 'section')
    assert.equal(statefulLayout.stateTree.root.children?.length, 1)
    assert.equal(statefulLayout.stateTree.root.children[0].layout.comp, 'text-field')

    // input that satisfies the dependency
    statefulLayout.input(statefulLayout.stateTree.root.children[0], 'test')
    assert.equal(statefulLayout.stateTree.root.children?.length, 2)
    assert.equal(statefulLayout.stateTree.root.children[1].layout.comp, 'section')
  })

  it('should mix depdendent schemas and expressions', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        obj1: { type: 'object', layout: { items: [{ value: 'val1', title: 'Val 1' }, { value: 'val2', title: 'Val 2' }] } }
      },
      dependentSchemas: {
        obj1: {
          properties: {
            // eslint-disable-next-line no-template-curly-in-string
            str1: { type: 'string', layout: { getItems: { url: { expr: 'http://test.com/${rootData.obj1.value}', pure: false } } } }
          }
        }
      }
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions)
    assert.equal(statefulLayout.stateTree.root.layout.comp, 'section')
    assert.equal(statefulLayout.stateTree.root.children?.length, 1)
    assert.equal(statefulLayout.stateTree.root.children[0].layout.comp, 'select')

    const obj1Items = await statefulLayout.getItems(statefulLayout.stateTree.root.children[0])

    // input that satisfies the dependency
    statefulLayout.input(statefulLayout.stateTree.root.children[0], obj1Items[0])
    assert.equal(statefulLayout.stateTree.root.children?.length, 2)
    assert.equal(statefulLayout.stateTree.root.children[1].layout.comp, 'section')
    assert.equal(statefulLayout.stateTree.root.children[1].children?.length, 1)
    assert.equal(statefulLayout.stateTree.root.children[1].children[0].layout.comp, 'select')
    assert.equal(statefulLayout.stateTree.root.children[1].children[0].itemsCacheKey, 'http://test.com/val1')
    const nockScope = nock('http://test.com')
      .get('/val1')
      .reply(200, ['val1', 'val2'])
    const items = await statefulLayout.getItems(statefulLayout.stateTree.root.children[1].children[0])
    assert.ok(nockScope.isDone())
    assert.deepEqual(items, [
      { title: 'val1', key: 'val1', value: 'val1' },
      { title: 'val2', key: 'val2', value: 'val2' }
    ])

    // empty the dependency
    statefulLayout.input(statefulLayout.stateTree.root.children[0], null)
    assert.equal(statefulLayout.stateTree.root.children?.length, 1)
  })

  it('should combine if/then/else and dependentSchema', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        str1: { type: 'string' }
      },
      dependentSchemas: {
        str1: {
          if: {
            properties: { str1: { const: 'test' } }
          },
          then: {
            properties: {
              str2: { type: 'string' }
            }
          },
          else: {
            properties: {
              str3: { type: 'string' }
            }
          }
        }
      }
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions)
    assert.equal(statefulLayout.stateTree.root.layout.comp, 'section')
    assert.equal(statefulLayout.stateTree.root.children?.length, 1)

    // input that satisfies the if condition
    statefulLayout.input(statefulLayout.stateTree.root.children[0], 'test')
    assert.equal(statefulLayout.stateTree.root.children?.length, 2)
    assert.equal(statefulLayout.stateTree.root.children[1].layout.comp, 'section')
    assert.equal(statefulLayout.stateTree.root.children[1].children?.length, 1) // the $then and $else children
    assert.equal(statefulLayout.stateTree.root.children[1].children[0].layout.comp, 'section')
    assert.equal(statefulLayout.stateTree.root.children[1].children[0].key, '$then')
    assert.equal(statefulLayout.stateTree.root.children[1].children[0].children?.length, 1)
    statefulLayout.input(statefulLayout.stateTree.root.children[1].children[0].children[0], 'hello')
    assert.deepEqual(statefulLayout.data, { str1: 'test', str2: 'hello' })

    // input that satisfies the else condition
    statefulLayout.input(statefulLayout.stateTree.root.children[0], 'not test')
    assert.equal(statefulLayout.stateTree.root.children[1].children[0].layout.comp, 'section')
    assert.equal(statefulLayout.stateTree.root.children[1].children[0].key, '$else')
    assert.equal(statefulLayout.stateTree.root.children[1].children[0].children?.length, 1)
    statefulLayout.input(statefulLayout.stateTree.root.children[1].children[0].children[0], 'hello')
    assert.deepEqual(statefulLayout.data, { str1: 'not test', str3: 'hello' })
  })

  it('should manage errors coming from dependentRequired', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        str1: { type: 'string' },
        str2: { type: 'string' }
      },
      dependentRequired: {
        str1: ['str2']
      }
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions)
    assert.equal(statefulLayout.stateTree.root.layout.comp, 'section')
    assert.equal(statefulLayout.stateTree.root.children?.length, 2)
    assert.equal(statefulLayout.stateTree.root.children[0].layout.comp, 'text-field')
    assert.equal(statefulLayout.stateTree.root.children[1].layout.comp, 'text-field')
    assert.ok(!statefulLayout.stateTree.root.children[1].error)

    // input that satisfies the dependency
    statefulLayout.input(statefulLayout.stateTree.root.children[0], 'test')
    assert.equal(statefulLayout.stateTree.root.children[1].error, 'required information')
  })

  // TODO: dependentRequired should be managed strictly by ajv, but add a test to be sure
  // TODO: dependentSchemas
})
