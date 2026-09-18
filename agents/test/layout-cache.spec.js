import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'

import { compile } from '@json-layout/core'

import { resolveCompiledLayout, clearLayoutCache } from '../src/index.js'

const simpleSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', title: 'Name' }
  }
}

describe('layout cache', () => {
  it('should return a passed layout untouched', async () => {
    const layout = compile(simpleSchema)
    assert.equal(await resolveCompiledLayout({ layout }), layout)
  })

  it('should share one compilation per schema function and version', async () => {
    const schema = async () => simpleSchema
    assert.equal(await resolveCompiledLayout({ schema }), await resolveCompiledLayout({ schema }))

    let version = 1
    const versioned = async () => ({ schema: simpleSchema, version })
    const first = await resolveCompiledLayout({ schema: versioned })
    version = 2
    const second = await resolveCompiledLayout({ schema: versioned })
    assert.notEqual(first, second)
  })

  it('should refuse a spec with neither a layout nor a schema', async () => {
    await assert.rejects(resolveCompiledLayout({}), /compiled layout or a schema function/)
  })

  it('should forget every compilation when cleared', async () => {
    const schema = async () => simpleSchema
    const first = await resolveCompiledLayout({ schema })
    clearLayoutCache()
    const second = await resolveCompiledLayout({ schema })
    assert.notEqual(first, second)
  })
})
