import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { compile, StatefulLayout } from '../src/index.js'

describe('Recursion in schema', () => {
  const defaultOptions = { debounceInputMs: 0 }

  it('should manage recursion in arrays', async () => {
    const compiledLayout = await compile(
      {
        $ref: '#/$defs/recursiveObject',
        $defs: {
          recursiveObject: {
            type: 'object',
            properties: {
              key: { type: 'string' },
              children: {
                type: 'array',
                items: {
                  $ref: '#/$defs/recursiveObject'
                }
              }
            }
          }
        }
      })
    const statefulLayout = new StatefulLayout(
      compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree],
      defaultOptions,
      {}
    )

    assert.equal(statefulLayout.stateTree.root.layout.comp, 'section')
    assert.equal(statefulLayout.stateTree.root.children?.length, 2)
    assert.equal(statefulLayout.stateTree.root.children[0].layout.comp, 'text-field')
    assert.equal(statefulLayout.stateTree.root.children[1].layout.comp, 'list')
    assert.equal(statefulLayout.stateTree.root.children[1].layout.listEditMode, 'inline-single')
    assert.equal(statefulLayout.stateTree.root.children[1].children?.length, 0)

    statefulLayout.input(statefulLayout.stateTree.root.children[1], [{}])
    assert.equal(statefulLayout.stateTree.root.children[1].children?.length, 1)
    assert.equal(statefulLayout.stateTree.root.children[1].children[0].layout.comp, 'section')
    assert.equal(statefulLayout.stateTree.root.children[1].children[0].children?.length, 2)
    assert.equal(statefulLayout.stateTree.root.children[1].children[0].children[0].layout.comp, 'text-field')
    assert.equal(statefulLayout.stateTree.root.children[1].children[0].children[1].layout.comp, 'list')
    
  })
})
