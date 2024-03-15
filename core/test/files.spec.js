import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { compile, StatefulLayout } from '../src/index.js'

describe('files inputs', () => {
  const defaultOptions = { debounceInputMs: 0 }

  it('should manage a simple file input and store an object', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: { file1: { type: 'object', layout: 'file-input' } }
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTree, defaultOptions, {})
    assert.ok(statefulLayout.stateTree.valid)
    assert.ok(statefulLayout.stateTree.root.children?.[0])
    assert.equal(statefulLayout.stateTree.root.children?.[0].layout.comp, 'file-input')

    statefulLayout.input(statefulLayout.stateTree.root.children?.[0], new File([''], 'file1.txt'))
    // @ts-ignore
    assert.ok(statefulLayout.data.file1)
    // @ts-ignore
    assert.equal(statefulLayout.data.file1.name, 'file1.txt')
    assert.deepEqual(JSON.parse(JSON.stringify(statefulLayout.data, null, 2)), { file1: { name: 'file1.txt', size: 0, type: '' } })
  })

  it('should manage a multiple file input and store an array', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: { file1: { type: 'array', layout: 'file-input' } }
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTree, defaultOptions, {})
    assert.ok(statefulLayout.stateTree.valid)
    assert.ok(statefulLayout.stateTree.root.children?.[0])
    assert.equal(statefulLayout.stateTree.root.children?.[0].layout.comp, 'file-input')

    statefulLayout.input(statefulLayout.stateTree.root.children?.[0], [new File([''], 'file1.txt')])
    // @ts-ignore
    assert.ok(statefulLayout.data.file1)
    // @ts-ignore
    assert.equal(statefulLayout.data.file1[0].name, 'file1.txt')
    assert.deepEqual(JSON.parse(JSON.stringify(statefulLayout.data, null, 2)), { file1: [{ name: 'file1.txt', size: 0, type: '' }] })
  })
})
