import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { EditorState } from '@codemirror/state'
import { compile, StatefulLayout } from '@json-layout/core'
import { jsonLayoutExtensions } from '../../src/editor/extensions.js'
import { compiledLayoutField } from '../../src/editor/compiled-layout-field.js'
import { statefulLayoutField } from '../../src/editor/stateful-layout-field.js'

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

const defaultSLOptions = { debounceInputMs: 0, initialValidation: 'always' }

describe('jsonLayoutExtensions with { statefulLayout }', () => {
  it('installs the statefulLayoutField when statefulLayout is provided', async () => {
    const compiled = await compile({ type: 'object', properties: { a: { type: 'string' } } })
    const sl = new StatefulLayout(
      compiled,
      compiled.skeletonTrees[compiled.mainTree],
      defaultSLOptions,
      { a: 'x' }
    )
    const state = EditorState.create({
      doc: '{"a": "x"}',
      extensions: jsonLayoutExtensions(compiled, { statefulLayout: sl })
    })
    assert.equal(state.field(statefulLayoutField), sl)
  })

  it('leaves statefulLayoutField null when options are omitted (Plan 4 back-compat)', async () => {
    const compiled = await compile({ type: 'object', properties: { a: { type: 'string' } } })
    const state = EditorState.create({
      doc: '{"a": "x"}',
      extensions: [
        ...jsonLayoutExtensions(compiled),
        statefulLayoutField
      ]
    })
    assert.equal(state.field(statefulLayoutField), null)
  })
})
