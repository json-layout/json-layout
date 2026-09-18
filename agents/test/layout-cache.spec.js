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

describe('layout cache keys', () => {
  it('should compile once per set of compile options', async () => {
    const schema = async () => simpleSchema
    const en = await resolveCompiledLayout({ schema, compileOptions: { locale: 'en' } })
    const fr = await resolveCompiledLayout({ schema, compileOptions: { locale: 'fr' } })

    assert.notEqual(en, fr)
    assert.equal(en.locale, 'en')
    assert.equal(fr.locale, 'fr')
    // equal options, written as two distinct literals, still share one compilation
    assert.equal(fr, await resolveCompiledLayout({ schema, compileOptions: { locale: 'fr' } }))
    assert.equal(en, await resolveCompiledLayout({ schema, compileOptions: { locale: 'en' } }))
  })

  it('should separate compile options that differ only deep down', async () => {
    const schema = async () => simpleSchema
    const first = await resolveCompiledLayout({ schema, compileOptions: { messages: { errorRequired: 'needed' } } })
    const second = await resolveCompiledLayout({ schema, compileOptions: { messages: { errorRequired: 'mandatory' } } })

    assert.notEqual(first, second)
    assert.equal(first.messages.errorRequired, 'needed')
    assert.equal(second.messages.errorRequired, 'mandatory')
  })
})
