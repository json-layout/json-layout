import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { LanguageSupport } from '@codemirror/language'
import { jsonFormatAdapter } from '../../src/json/adapter.js'

describe('jsonFormatAdapter.language', () => {
  it('is a LanguageSupport instance', () => {
    assert.ok(jsonFormatAdapter.language instanceof LanguageSupport)
  })

  it('exposes the JSON parser via language.parser', () => {
    const parser = jsonFormatAdapter.language.language.parser
    assert.ok(parser, 'language.parser must exist')
    const tree = parser.parse('{"a": 1}')
    assert.ok(tree, 'parser must parse JSON text')
    // Sanity: the top node should have a name of "JsonText" (the @lezer/json top node).
    assert.equal(tree.topNode.name, 'JsonText')
  })
})
