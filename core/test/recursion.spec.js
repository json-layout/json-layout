import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { compile, StatefulLayout } from '../src/index.js'
import { getNodeBuilder } from './utils/state-tree.js'

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

  it('should manage recursion in arrays combined with oneOf', async () => {
    const compiledLayout = await compile(
      {
        $ref: '#/$defs/recursiveObject',
        $defs: {
          recursiveObject: {
            type: 'object',
            oneOf: [{
              properties: {
                type: {
                  const: 'leaf'
                },
                key: { type: 'string' }
              }
            }, {
              properties: {
                type: {
                  const: 'node'
                },
                key: { type: 'string' },
                children: {
                  type: 'array',
                  items: {
                    $ref: '#/$defs/recursiveObject'
                  }
                }
              }
            }]

          }
        }
      })
    const statefulLayout = new StatefulLayout(
      compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree],
      defaultOptions,
      {}
    )
    const getNode = getNodeBuilder(statefulLayout)

    assert.equal(getNode('').layout.comp, 'section')
    assert.equal(getNode('$oneOf').layout.comp, 'one-of-select')
    assert.deepEqual(getNode('$oneOf').skeleton.propertyKeys, ['type', 'key', 'children'])
  })

  it('should manage recursion in conditional children', async () => {
    const compiledLayout = await compile(
      {
        $ref: '#/$defs/recursiveObject',
        $defs: {
          recursiveObject: {
            type: 'object',
            required: ['key'],
            properties: {
              key: { type: 'string', pattern: '^[A-Z]+$' },
              activeChild: { type: 'boolean' },
              child: {
                $ref: '#/$defs/recursiveObject',
                layout: {
                  if: { pure: false, expr: 'parent.data.activeChild' }
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
    assert.equal(statefulLayout.valid, false)
    assert.ok(!statefulLayout.stateTree.root.error)

    assert.equal(statefulLayout.stateTree.root.layout.comp, 'section')
    assert.equal(statefulLayout.stateTree.root.children?.length, 3)
    assert.equal(statefulLayout.stateTree.root.children[0].key, 'key')
    assert.ok(!statefulLayout.stateTree.root.error)
    assert.equal(statefulLayout.stateTree.root.childError, true)
    assert.ok(!!statefulLayout.stateTree.root.children[0].error)
    assert.equal(statefulLayout.stateTree.root.children[0].layout.comp, 'text-field')
    assert.equal(statefulLayout.stateTree.root.children[1].key, 'activeChild')
    assert.equal(statefulLayout.stateTree.root.children[1].layout.comp, 'checkbox')
    assert.equal(statefulLayout.stateTree.root.children[2].key, 'child')
    assert.equal(statefulLayout.stateTree.root.children[2].layout.comp, 'none')

    statefulLayout.input(statefulLayout.stateTree.root.children[0], 'VALUE')
    assert.equal(statefulLayout.valid, true)

    statefulLayout.input(statefulLayout.stateTree.root.children[1], true)
    assert.equal(statefulLayout.stateTree.root.children[2].layout.comp, 'section')
    assert.equal(statefulLayout.stateTree.root.children[2].children?.length, 3)
    statefulLayout.input(statefulLayout.stateTree.root.children[2].children[0], 'value')
    assert.equal(statefulLayout.valid, false)
    assert.ok(!statefulLayout.stateTree.root.error)
    assert.equal(statefulLayout.stateTree.root.childError, true)
    assert.ok(!statefulLayout.stateTree.root.children[0].error)
    assert.ok(!!statefulLayout.stateTree.root.children[2].children?.[0]?.error)
  })
})
