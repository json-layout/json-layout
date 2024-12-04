import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { compile, StatefulLayout } from '../src/index.js'

describe('Managing slots', () => {
  const defaultOptions = { debounceInputMs: 0 }

  it('should manage before/after slots', async () => {
    const compiledLayout = await compile(
      {
        type: 'string',
        layout: {
          slots: {
            before: 'Markdown **slot**',
            after: { text: 'Text **slot**' }
            // component: 'named-slot'
          }
        }
      })
    const statefulLayout = new StatefulLayout(
      compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree],
      defaultOptions,
      'test'
    )
    assert.ok(statefulLayout.stateTree.valid)
    assert.equal(statefulLayout.stateTree.root.layout.comp, 'text-field')
    assert.deepEqual(statefulLayout.stateTree.root.slots?.before, { markdown: '<p>Markdown <strong>slot</strong></p>' })
    assert.deepEqual(statefulLayout.stateTree.root.slots?.after, { text: 'Text **slot**' })
  })

  it('should manage component slot', async () => {
    const compiledLayout = await compile(
      {
        type: 'string',
        layout: {
          slots: {
            component: 'named-slot'
          }
        }
      })
    const statefulLayout = new StatefulLayout(
      compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree],
      defaultOptions,
      'test'
    )
    assert.ok(statefulLayout.stateTree.valid)
    assert.equal(statefulLayout.stateTree.root.layout.comp, 'slot')
    assert.deepEqual(statefulLayout.stateTree.root.slots?.component, { name: 'named-slot' })
  })

  it('should manage a pure slot child in a section', async () => {
    const compiledLayout = await compile({
      type: 'object',
      layout: [
        { markdown: 'A child markdown **slot**' },
        { key: 'str1', slots: { before: 'Markdown **slot**' } },
        { text: 'A child text **slot**' }
      ],
      properties: {
        str1: { type: 'string' }
      }
    })
    const statefulLayout = new StatefulLayout(
      compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree],
      defaultOptions,
      {}
    )
    assert.ok(statefulLayout.stateTree.valid)
    assert.equal(statefulLayout.stateTree.root.layout.comp, 'section')
    assert.equal(statefulLayout.stateTree.root.children?.length, 3)
    assert.equal(statefulLayout.stateTree.root.children[0].layout.comp, 'slot')
    assert.deepEqual(statefulLayout.stateTree.root.children[0].slots?.component, { markdown: '<p>A child markdown <strong>slot</strong></p>' })
    assert.equal(statefulLayout.stateTree.root.children[1].layout.comp, 'text-field')
    assert.deepEqual(statefulLayout.stateTree.root.children[1].slots?.before, { markdown: '<p>Markdown <strong>slot</strong></p>' })
    assert.equal(statefulLayout.stateTree.root.children[2].layout.comp, 'slot')
    assert.deepEqual(statefulLayout.stateTree.root.children[2].slots?.component, { text: 'A child text **slot**' })
  })
})
