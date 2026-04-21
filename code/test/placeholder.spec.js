import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'

describe('@json-layout/code workspace', () => {
  it('loads the json barrel without errors', async () => {
    const mod = await import('../src/json/index.js')
    assert.equal(typeof mod, 'object')
  })
})
