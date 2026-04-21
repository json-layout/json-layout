import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import * as sharedBarrel from '../../src/shared/index.js'
import * as rootBarrel from '../../src/index.js'

const expectedSymbols = [
  'getValueCandidates',
  'getPropertyCandidates',
  'getVariantCandidates',
  'getDynamicCandidates',
  'getHelp',
  'getHelpFromState',
  'collectDiagnostics'
]

describe('shared barrel', () => {
  for (const name of expectedSymbols) {
    it(`exports ${name}`, () => {
      assert.equal(typeof (/** @type {any} */(sharedBarrel))[name], 'function')
    })
  }
})

describe('root barrel forwards shared symbols', () => {
  for (const name of expectedSymbols) {
    it(`re-exports ${name}`, () => {
      assert.equal(typeof (/** @type {any} */(rootBarrel))[name], 'function')
    })
  }

  it('still exposes the json adapter alongside shared symbols', () => {
    assert.equal(typeof (/** @type {any} */(rootBarrel)).jsonFormatAdapter, 'object')
  })
})
