import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { compile, StatefulLayout } from '../src/index.js'

describe('Autofocus', () => {
  it('should not autofocus anything by default', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        str1: { type: 'string' },
        str2: { type: 'string' }
      }
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTree, {})
    assert.deepEqual(statefulLayout.stateTree.root.autofocus, undefined)
    assert.ok(statefulLayout.stateTree.root.children)
    assert.equal(statefulLayout.stateTree.root.children.length, 2)
    assert.equal(statefulLayout.stateTree.root.children[0].autofocus, undefined)
    assert.equal(statefulLayout.stateTree.root.children[1].autofocus, undefined)
  })

  it('should autofocus first field if option is activated', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        str1: { type: 'string' },
        str2: { type: 'string' }
      }
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTree, { autofocus: true })
    assert.deepEqual(statefulLayout.stateTree.root.autofocus, undefined)
    assert.ok(statefulLayout.stateTree.root.children)
    assert.equal(statefulLayout.stateTree.root.children.length, 2)
    assert.equal(statefulLayout.stateTree.root.children[0].autofocus, true)
    assert.equal(statefulLayout.stateTree.root.children[1].autofocus, undefined)
  })

  it('should ignore non focusable properties', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        str1: { type: 'string', layout: { options: { readOnly: true } } },
        str2: { type: 'string' }
      }
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTree, { autofocus: true })
    assert.deepEqual(statefulLayout.stateTree.root.autofocus, undefined)
    assert.ok(statefulLayout.stateTree.root.children)
    assert.equal(statefulLayout.stateTree.root.children.length, 2)
    assert.equal(statefulLayout.stateTree.root.children[0].autofocus, undefined)
    assert.equal(statefulLayout.stateTree.root.children[1].autofocus, true)
  })

  it('should accept explicit property autofocus', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        str1: { type: 'string' },
        str2: { type: 'string', layout: { autofocus: true } }
      }
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTree, {})
    assert.deepEqual(statefulLayout.stateTree.root.autofocus, undefined)
    assert.ok(statefulLayout.stateTree.root.children)
    assert.equal(statefulLayout.stateTree.root.children.length, 2)
    assert.equal(statefulLayout.stateTree.root.children[0].autofocus, undefined)
    assert.equal(statefulLayout.stateTree.root.children[1].autofocus, true)
  })

  it('should add autofocus to newly activated item', async () => {
    const compiledLayout = await compile({
      type: 'array',
      items: {
        type: 'object',
        properties: {
          str1: { type: 'string' }
        }
      }
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTree, {}, [{ str1: 'test1' }, { str1: 'test2' }, { str1: 'test3' }, { str1: 'test4' }])
    assert.equal(statefulLayout.stateTree.root.children?.[0].options.readOnly, true)
    assert.equal(statefulLayout.stateTree.root.children?.[0].options.summary, true)
    assert.equal(statefulLayout.stateTree.root.children?.[1].options.readOnly, true)
    assert.equal(statefulLayout.stateTree.root.children?.[1].options.summary, true)

    statefulLayout.activateItem(statefulLayout.stateTree.root, 2)
    assert.equal(statefulLayout.stateTree.root.children?.[2].options.readOnly, false)
    assert.equal(statefulLayout.stateTree.root.children?.[2].options.summary, false)
    assert.equal(statefulLayout.stateTree.root.children?.[2].children?.[0].autofocus, true)
  })
})
