import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { compile, StatefulLayout } from '../src/index.js'
// import Debug from 'debug'

// const debug = Debug('test')

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
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTree, defaultOptions)
    assert.deepEqual(statefulLayout.stateTree.root.layout.comp, 'section')
    assert.equal(statefulLayout.stateTree.root.children?.length, 3)
    assert.equal(statefulLayout.stateTree.root.children[1].layout.comp, 'none')
    assert.equal(statefulLayout.stateTree.root.children[2].layout.comp, 'section')
    statefulLayout.input(statefulLayout.stateTree.root.children[0], 'test')
    assert.equal(statefulLayout.stateTree.root.children[1].layout.comp, 'section')
    assert.equal(statefulLayout.stateTree.root.children[2].layout.comp, 'none')
  })
  // TODO: dependentRequired should be managed strictly by ajv, but add a test to be sure
  // TODO: dependentSchemas
})
