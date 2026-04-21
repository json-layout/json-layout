import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { compile, StatefulLayout } from '@json-layout/core'
import { getHelp, getHelpFromState } from '../../src/shared/help.js'

const defaultOptions = { debounceInputMs: 0 }

describe('getHelp (fast path)', () => {
  it('returns title/description/help from a leaf', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        name: {
          type: 'string',
          title: 'Full name',
          description: 'Given name and family name',
          layout: { help: 'Up to 120 chars' }
        }
      }
    })
    const info = getHelp(compiledLayout, '/name')
    assert.ok(info)
    assert.equal(info?.title, 'Full name')
    assert.equal(info?.description, 'Given name and family name')
    assert.equal(info?.help, 'Up to 120 chars')
  })

  it('returns the object-level title at the root', async () => {
    const compiledLayout = await compile({
      type: 'object',
      title: 'Person',
      properties: { a: { type: 'string' } }
    })
    const info = getHelp(compiledLayout, '')
    assert.ok(info)
    assert.equal(info?.title, 'Person')
  })

  it('returns an empty info object (not null) for a path without text', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: { a: { type: 'string' } }
    })
    const info = getHelp(compiledLayout, '/a')
    assert.ok(info)
    assert.equal(info?.title, undefined)
    assert.equal(info?.description, undefined)
    assert.equal(info?.help, undefined)
  })

  it('returns null for an unknown path', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: { a: { type: 'string' } }
    })
    assert.equal(getHelp(compiledLayout, '/missing'), null)
  })
})

describe('getHelpFromState (committed path)', () => {
  it('returns the resolved layout title/description/help from a StateNode', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        name: {
          type: 'string',
          title: 'Full name',
          description: 'Given + family',
          layout: { help: 'Up to 120 chars' }
        }
      }
    })
    const statefulLayout = new StatefulLayout(
      compiledLayout,
      compiledLayout.skeletonTrees[compiledLayout.mainTree],
      defaultOptions,
      { name: 'Ada' }
    )
    const info = getHelpFromState(statefulLayout, '/name')
    assert.ok(info)
    assert.equal(info?.title, 'Full name')
    assert.equal(info?.description, 'Given + family')
    assert.equal(info?.help, 'Up to 120 chars')
  })

  it('returns null for an unknown path', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: { a: { type: 'string' } }
    })
    const statefulLayout = new StatefulLayout(
      compiledLayout,
      compiledLayout.skeletonTrees[compiledLayout.mainTree],
      defaultOptions,
      { a: 'x' }
    )
    assert.equal(getHelpFromState(statefulLayout, '/missing'), null)
  })
})
