import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { compile, StatefulLayout } from '../src/index.js'

describe('debounce input events', () => {
  it('should apply different debounce mode based on component and options', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        str1: { type: 'string' },
        str2: { type: 'string', layout: { debounceInputMs: 0 } },
        bool1: { type: 'boolean' }
      }
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTree, {})

    /** @type {unknown[]} */
    let inputEvents = []
    statefulLayout.events.on('input', (value) => { inputEvents.push(value) })

    assert.deepEqual(statefulLayout.stateTree.root.layout.comp, 'section')
    assert.equal(statefulLayout.stateTree.root.children?.length, 3)
    assert.equal(statefulLayout.stateTree.root.children[0].options.debounceInputMs, 300)

    // input on str1 is debounced
    statefulLayout.input(statefulLayout.stateTree.root.children[0], 'a')
    assert.deepEqual(statefulLayout.stateTree.root.data, {})
    await new Promise((resolve) => setTimeout(resolve, 10))
    statefulLayout.input(statefulLayout.stateTree.root.children[0], 'ab')
    assert.deepEqual(statefulLayout.stateTree.root.data, {})
    await new Promise((resolve) => setTimeout(resolve, 300))
    assert.deepEqual(statefulLayout.stateTree.root.data, { str1: 'ab' })
    statefulLayout.input(statefulLayout.stateTree.root.children[0], 'abc')
    assert.deepEqual(statefulLayout.stateTree.root.data, { str1: 'ab' })
    await new Promise((resolve) => setTimeout(resolve, 300))
    assert.deepEqual(statefulLayout.stateTree.root.data, { str1: 'abc' })
    assert.deepEqual(inputEvents, [{ str1: 'ab' }, { str1: 'abc' }])
    inputEvents = []

    // input on str2 is not debounced
    statefulLayout.input(statefulLayout.stateTree.root.children[1], 'test')
    assert.deepEqual(statefulLayout.stateTree.root.data, { str1: 'abc', str2: 'test' })
    assert.equal(inputEvents.length, 1)
    inputEvents = []

    // input on a checkbox is not debounced
    statefulLayout.input(statefulLayout.stateTree.root.children[2], true)
    assert.deepEqual(statefulLayout.stateTree.root.data, { str1: 'abc', str2: 'test', bool1: true })
    assert.equal(inputEvents.length, 1)
    inputEvents = []
  })
})
