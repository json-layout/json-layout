import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { compile, StatefulLayout } from '../src/index.js'

describe('errors of hidden composite children', () => {
  it('a composite child hidden by its if does not capture the errors of its siblings', async () => {
    const compiledLayout = await compile({
      type: 'object',
      layout: {
        children: [
          { title: 'Section 1', children: [{ if: 'false', children: [{ name: 'warning' }] }, 'str1'] },
          { title: 'Section 2', children: ['str2'] }
        ]
      },
      properties: {
        str1: { type: 'string' },
        str2: { type: 'string', pattern: '^[A-Z]+$' }
      }
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], { initialValidation: 'always' }, { str2: 'abc' })
    const [section1, section2] = statefulLayout.stateTree.root.children ?? []
    assert.equal(section2.childError, true)
    assert.equal(section2.children?.[0].error, 'must match pattern "^[A-Z]+$"')
    assert.ok(!section1.childError, 'the section holding only a hidden composite and a valid field has no error')
    assert.ok(!section1.children?.[0].error)
  })

  it('a hidden composite child still reports the errors of the properties it contains', async () => {
    const compiledLayout = await compile({
      type: 'object',
      layout: {
        children: [
          { title: 'Section 1', children: [{ if: 'false', children: ['str1'] }] },
          { title: 'Section 2', children: ['str2'] }
        ]
      },
      properties: {
        str1: { type: 'string', pattern: '^[A-Z]+$' },
        str2: { type: 'string' }
      }
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], { initialValidation: 'always' }, { str1: 'abc' })
    const [section1, section2] = statefulLayout.stateTree.root.children ?? []
    assert.equal(section1.childError, true)
    assert.ok(!section2.childError)
  })
})
