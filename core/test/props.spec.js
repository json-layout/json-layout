import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { compile, StatefulLayout } from '../src/index.js'

describe('Management of props from layout', () => {
  it('should assign layout props', async () => {
    const compiledLayout = await compile({
      type: 'string',
      layout: { props: { appendIcon: 'mdi-heart' } }
    })
    const statefulLayout = new StatefulLayout(
      compiledLayout, compiledLayout.skeletonTree,
      {},
      ''
    )
    assert.ok(statefulLayout.valid)
    assert.deepEqual(statefulLayout.stateTree.root.props, { appendIcon: 'mdi-heart' })
  })

  it('should use getProps for dynamic props', async () => {
    const compiledLayout = await compile({
      type: 'string',
      layout: { getProps: 'data === "vjsf" ? {appendIcon: "mdi-heart"} : {}' }
    })
    const statefulLayout = new StatefulLayout(
      compiledLayout, compiledLayout.skeletonTree,
      {},
      ''
    )
    assert.ok(statefulLayout.valid)
    assert.deepEqual(statefulLayout.stateTree.root.props, {})
    statefulLayout.input(statefulLayout.stateTree.root, 'vjsf')
    assert.deepEqual(statefulLayout.stateTree.root.props, { appendIcon: 'mdi-heart' })
  })
})
