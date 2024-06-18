import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { compile, StatefulLayout } from '../src/index.js'

describe('Impure expressions', () => {
  const defaultOptions = { debounceInputMs: 0 }

  it('should access root data', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        str1: { type: 'string' },
        str2: { type: 'string', layout: { if: { expr: 'rootData?.str1', pure: false } } },
        str3: { type: 'string', layout: { if: { expr: 'rootData?.str2', pure: false } } }
      }
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions)
    assert.equal(statefulLayout.stateTree.root.children?.length, 3)
    assert.equal(statefulLayout.stateTree.root.children[0].key, 'str1')
    assert.equal(statefulLayout.stateTree.root.children[0].layout.comp, 'text-field')
    assert.equal(statefulLayout.stateTree.root.children[1].layout.comp, 'none')
    assert.equal(statefulLayout.stateTree.root.children[2].layout.comp, 'none')

    statefulLayout.input(statefulLayout.stateTree.root.children[0], 'String 1')
    assert.equal(statefulLayout.stateTree.root.children[1].layout.comp, 'text-field')
    assert.equal(statefulLayout.stateTree.root.children[2].layout.comp, 'none')

    statefulLayout.input(statefulLayout.stateTree.root.children[1], 'String 2')
    assert.equal(statefulLayout.stateTree.root.children[2].layout.comp, 'text-field')
  })

  it('should access parent data', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        str1: { type: 'string' },
        str2: { type: 'string', layout: { if: { expr: 'parent.data?.str1', pure: false } } },
        str3: { type: 'string', layout: { if: { expr: 'parent.data?.str2', pure: false } } },
        str4: { type: 'string', layout: { if: { expr: 'parent.data?.str5', pure: false } } },
        str5: { type: 'string' }
      }
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions)
    assert.equal(statefulLayout.stateTree.root.children?.length, 5)
    assert.equal(statefulLayout.stateTree.root.children[0].key, 'str1')
    assert.equal(statefulLayout.stateTree.root.children[0].layout.comp, 'text-field')
    assert.equal(statefulLayout.stateTree.root.children[1].layout.comp, 'none')
    assert.equal(statefulLayout.stateTree.root.children[2].layout.comp, 'none')
    assert.equal(statefulLayout.stateTree.root.children[3].layout.comp, 'none')

    statefulLayout.input(statefulLayout.stateTree.root.children[0], 'String 1')
    assert.equal(statefulLayout.stateTree.root.children[1].layout.comp, 'text-field')
    assert.equal(statefulLayout.stateTree.root.children[2].layout.comp, 'none')

    statefulLayout.input(statefulLayout.stateTree.root.children[1], 'String 2')
    assert.equal(statefulLayout.stateTree.root.children[2].layout.comp, 'text-field')

    statefulLayout.input(statefulLayout.stateTree.root.children[4], 'String 5')
    assert.equal(statefulLayout.stateTree.root.children[3].layout.comp, 'text-field')
  })

  it('should access parent.parent data', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        obj1: {
          type: 'object',
          properties: {
            str1: { type: 'string' }
          }
        },
        obj2: {
          type: 'object',
          properties: {
            str2: { type: 'string', layout: { if: { expr: 'parent.parent.data?.obj1?.str1', pure: false } } }
          }
        }
      }
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions)
    assert.equal(statefulLayout.stateTree.root.children?.length, 2)
    assert.equal(statefulLayout.stateTree.root.children[0].children?.length, 1)
    assert.equal(statefulLayout.stateTree.root.children[0].children[0].layout.comp, 'text-field')
    assert.equal(statefulLayout.stateTree.root.children[1].children?.length, 1)
    assert.equal(statefulLayout.stateTree.root.children[1].children[0].layout.comp, 'none')

    statefulLayout.input(statefulLayout.stateTree.root.children[0].children[0], 'String 1')
    assert.equal(statefulLayout.stateTree.root.children[1].children[0].layout.comp, 'text-field')
  })
})
