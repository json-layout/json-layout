import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { compile, StatefulLayout } from '../src/index.js'

describe('files inputs', () => {
  it('should manage a simple file input and store the file name', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: { file1: { type: 'string', layout: 'file-input' } }
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTree, {}, {})
    assert.ok(statefulLayout.stateTree.valid)
    assert.ok(statefulLayout.stateTree.root.children?.[0])

    statefulLayout.input(statefulLayout.stateTree.root.children?.[0], new File([''], 'file1.txt'))
    // @ts-ignore
    assert.ok(statefulLayout.data.file1)
    // @ts-ignore
    assert.equal(statefulLayout.data.file1.name, 'file1.txt')
    assert.deepEqual(JSON.parse(JSON.stringify(statefulLayout.data, null, 2)), { file1: { name: 'file1.txt', size: 0, type: '' } })
  })
})
