import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { compile } from '../src/index.js'
import { serialize } from '../src/compile/serialize.js'
import { isCompObject } from '@json-layout/vocabulary'

describe('compile schema function', () => {
  it('should compile simple schemas', () => {
    const compiled = compile({ type: 'string' })
    assert.ok(compiled)
  })

  it('should support serializing the compiled layout', async () => {
    const compiledLayout = compile({ type: 'string', layout: { if: "mode == 'read'" }, format: 'date-time' }, { code: true })
    const code = serialize(compiledLayout)
    assert.ok(code)
    const filePath = resolve('tmp/compiled.js')
    await writeFile(filePath, code + '\nexport default compiledLayout;')
    const serializedLayout = (await import(filePath)).default
    assert.deepEqual(serializedLayout.skeletonTrees[serializedLayout.mainTree], compiledLayout.skeletonTrees[compiledLayout.mainTree])
    assert.deepEqual(serializedLayout.normalizedLayouts, compiledLayout.normalizedLayouts)
    // console.log(serializedLayout)
  })

  it('should manage help as markdown content', async () => {
    const compiled = compile({ type: 'string', layout: { help: 'Please **help**!!' } })
    const layout = compiled.normalizedLayouts['_jl#']
    assert.ok(isCompObject(layout) && layout.comp === 'text-field')
    assert.equal(layout.help, '<p>Please <strong>help</strong>!!</p>')
  })

  it('should resolve refs', async () => {
    const compiled = compile({ type: 'object', properties: { str1: { $ref: '#/$defs/str1' } }, $defs: { str1: { type: 'string', title: 'String 1' } } })
    assert.ok(isCompObject(compiled.normalizedLayouts['_jl#/properties/str1']))
    assert.equal(compiled.normalizedLayouts['_jl#/properties/str1'].comp, 'text-field')
    assert.equal(compiled.normalizedLayouts['_jl#/properties/str1'].label, 'String 1')
  })
})
