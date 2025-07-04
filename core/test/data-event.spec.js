import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { compile, StatefulLayout } from '../src/index.js'

describe('data update events', () => {
  it('should apply different debounce mode', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        str1: { type: 'string' },
        str2: { type: 'string', layout: { debounceInputMs: 0 } },
        bool1: { type: 'boolean' }
      }
    })
    /** @type {unknown[]} */
    let dataEvents = []
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], {
      onData: (value) => { dataEvents.push(value) }
    })

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
    await new Promise((resolve) => setTimeout(resolve, 10))
    statefulLayout.input(statefulLayout.stateTree.root.children[0], 'ab')
    await new Promise((resolve) => setTimeout(resolve, 300))
    assert.deepEqual(statefulLayout.stateTree.root.data, { str1: 'ab' })

    statefulLayout.input(statefulLayout.stateTree.root.children[0], 'abc')
    assert.deepEqual(statefulLayout.stateTree.root.data, { str1: 'ab' })
    await new Promise((resolve) => setTimeout(resolve, 300))
    assert.deepEqual(statefulLayout.stateTree.root.data, { str1: 'abc' })
    assert.deepEqual(dataEvents, [{}, { str1: 'ab' }, { str1: 'abc' }])
    dataEvents = []

    // input on str2 is not debounced
    statefulLayout.input(statefulLayout.stateTree.root.children[1], 'test')
    assert.deepEqual(statefulLayout.stateTree.root.data, { str1: 'abc', str2: 'test' })
    assert.equal(dataEvents.length, 1)
    dataEvents = []

    // input on a checkbox is not debounced
    statefulLayout.input(statefulLayout.stateTree.root.children[2], true)
    assert.deepEqual(statefulLayout.stateTree.root.data, { str1: 'abc', str2: 'test', bool1: true })
    assert.equal(dataEvents.length, 1)
    dataEvents = []
  })

  it('should apply updateOn option', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        str1: { type: 'string', layout: { debounceInputMs: 300 } }
      }
    })
    /** @type {unknown[]} */
    const dataEvents = []
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], {
      updateOn: 'blur',
      onData: (value) => { dataEvents.push(value) }
    })

    assert.deepEqual(statefulLayout.stateTree.root.layout.comp, 'section')
    assert.equal(statefulLayout.stateTree.root.children?.length, 1)

    // input on str1 is ignored until blur
    statefulLayout.input(statefulLayout.stateTree.root.children[0], 'a')
    await new Promise((resolve) => setTimeout(resolve, 10))
    statefulLayout.input(statefulLayout.stateTree.root.children[0], 'ab')
    await new Promise((resolve) => setTimeout(resolve, 300))
    statefulLayout.blur(statefulLayout.stateTree.root.children[0])
    assert.deepEqual(statefulLayout.data, { str1: 'ab' })
    assert.deepEqual(dataEvents, [{}, { str1: 'ab' }])

    // blur should also apply debounced data
    statefulLayout.input(statefulLayout.stateTree.root.children[0], 'abc')
    assert.deepEqual(statefulLayout.data, { str1: 'ab' })
    statefulLayout.blur(statefulLayout.stateTree.root.children[0])
    assert.deepEqual(statefulLayout.data, { str1: 'abc' })
  })

  it('should mix updateOn=blur and validateOn=input option', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        str1: { type: 'string', layout: { debounceInputMs: 300 }, pattern: '^[A-Z]+$' }
      }
    })
    /** @type {unknown[]} */
    const dataEvents = []
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], {
      updateOn: 'blur',
      validateOn: 'input',
      onData: (value) => { dataEvents.push(value) }
    })

    assert.deepEqual(statefulLayout.stateTree.root.layout.comp, 'section')
    assert.equal(statefulLayout.stateTree.root.children?.length, 1)

    // input on str1 is ignored until blur, we do a small back and forth that was known to trigger a data-binding bug
    statefulLayout.input(statefulLayout.stateTree.root.children[0], 'A')
    statefulLayout.input(statefulLayout.stateTree.root.children[0], 'Ab')
    statefulLayout.blur(statefulLayout.stateTree.root.children[0])
    assert.deepEqual(statefulLayout.data, { str1: 'Ab' })
    statefulLayout.input(statefulLayout.stateTree.root.children[0], 'A')
    assert.deepEqual(statefulLayout.data, { str1: 'Ab' })
    statefulLayout.blur(statefulLayout.stateTree.root.children[0])
    assert.deepEqual(statefulLayout.data, { str1: 'A' })
    statefulLayout.input(statefulLayout.stateTree.root.children[0], 'Ab')
    assert.deepEqual(statefulLayout.data, { str1: 'A' })
    statefulLayout.blur(statefulLayout.stateTree.root.children[0])
    assert.deepEqual(statefulLayout.data, { str1: 'Ab' })
  })
})
