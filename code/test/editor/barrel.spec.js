import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import * as editorBarrel from '../../src/editor/index.js'
import * as rootBarrel from '../../src/index.js'

const expectedEditorSymbols = [
  'jsonLayoutExtensions',
  'compiledLayoutField',
  'setCompiledLayoutEffect',
  'statefulLayoutField',
  'setStatefulLayoutEffect',
  'statefulLayoutSyncPlugin',
  'syncStatefulLayoutData',
  'runCommittedSync',
  'computeCompletions',
  'jsonLayoutCompletion',
  'computeDynamicCompletions',
  'jsonLayoutDynamicCompletion',
  'computeHover',
  'jsonLayoutHover'
]

describe('editor barrel', () => {
  for (const name of expectedEditorSymbols) {
    it(`exports ${name}`, () => {
      assert.ok((/** @type {any} */(editorBarrel))[name] !== undefined)
    })
  }
})

describe('root barrel forwards editor symbols', () => {
  for (const name of expectedEditorSymbols) {
    it(`re-exports ${name}`, () => {
      assert.ok((/** @type {any} */(rootBarrel))[name] !== undefined)
    })
  }

  it('still exposes plan-2/plan-3 symbols alongside editor', () => {
    assert.equal(typeof (/** @type {any} */(rootBarrel)).jsonFormatAdapter, 'object')
    assert.equal(typeof (/** @type {any} */(rootBarrel)).getValueCandidates, 'function')
    assert.equal(typeof (/** @type {any} */(rootBarrel)).collectDiagnostics, 'function')
  })
})
