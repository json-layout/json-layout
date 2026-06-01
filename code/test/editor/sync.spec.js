import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { compile, StatefulLayout } from '@json-layout/core'
import { jsonFormatAdapter } from '../../src/json/adapter.js'
import { syncStatefulLayoutData } from '../../src/editor/sync.js'

const defaultOptions = { debounceInputMs: 0, initialValidation: 'always' }

/**
 * @param {unknown} schema
 * @param {unknown} data
 */
async function newSL (schema, data) {
  const compiled = await compile(/** @type {any} */(schema))
  return new StatefulLayout(
    compiled,
    compiled.skeletonTrees[compiled.mainTree],
    defaultOptions,
    data
  )
}

describe('syncStatefulLayoutData', () => {
  it('assigns parsed data on success and returns true', async () => {
    const sl = await newSL({ type: 'object', properties: { name: { type: 'string' } } }, { name: 'old' })
    const ok = syncStatefulLayoutData(sl, jsonFormatAdapter, '{"name": "new"}')
    assert.equal(ok, true)
    assert.deepEqual(sl.data, { name: 'new' })
  })

  it('returns false and leaves data unchanged on parse error', async () => {
    const sl = await newSL({ type: 'object', properties: { name: { type: 'string' } } }, { name: 'frozen' })
    const before = sl.data
    const ok = syncStatefulLayoutData(sl, jsonFormatAdapter, '{"name": frozen')
    assert.equal(ok, false)
    assert.deepEqual(sl.data, before)
  })
})
