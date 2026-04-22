import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { EditorState } from '@codemirror/state'
import { compile } from '@json-layout/core'
import { jsonLayoutExtensions } from '../../src/editor/extensions.js'
import { compiledLayoutField } from '../../src/editor/compiled-layout-field.js'

describe('jsonLayoutExtensions', () => {
  it('returns an array of extensions', async () => {
    const compiledLayout = await compile({ type: 'object', properties: { a: { type: 'string' } } })
    const extensions = jsonLayoutExtensions(compiledLayout)
    assert.ok(Array.isArray(extensions))
    assert.ok(extensions.length > 0)
  })

  it('EditorState.create reads the compiled layout back via the field', async () => {
    const compiledLayout = await compile({ type: 'object', properties: { a: { type: 'string' } } })
    const state = EditorState.create({
      doc: '{"a": "hi"}',
      extensions: jsonLayoutExtensions(compiledLayout)
    })
    assert.equal(state.field(compiledLayoutField), compiledLayout)
  })

  it('activates the JSON language (state.doc parses via the configured parser)', async () => {
    const compiledLayout = await compile({ type: 'object', properties: { a: { type: 'string' } } })
    const state = EditorState.create({
      doc: '{"a": 1}',
      extensions: jsonLayoutExtensions(compiledLayout)
    })
    const { syntaxTree } = await import('@codemirror/language')
    const tree = syntaxTree(state)
    assert.equal(tree.topNode.name, 'JsonText')
  })
})
