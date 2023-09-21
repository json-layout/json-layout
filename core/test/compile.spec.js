import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { compile } from '../src/index.js'
import { serialize } from '../src/compile/serialize.js'
import { isCompObject, isTextFieldLayout } from '@json-layout/vocabulary'

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
    // dynamic loading of file in our context requires the commonjs syntax
    await writeFile(filePath, code + '\nexport default compiledLayout;')

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const serializedLayout = (await import(filePath)).default
    assert.deepEqual(serializedLayout.skeletonTree, compiledLayout.skeletonTree)
    assert.deepEqual(serializedLayout.normalizedLayouts, compiledLayout.normalizedLayouts)
    // console.log(serializedLayout)
  })

  it('should manage help as markdown content', async () => {
    const compiled = compile({ type: 'string', layout: { help: 'Please **help**!!' } })
    const layout = compiled.normalizedLayouts['_jl#']
    assert.ok(isCompObject(layout) && isTextFieldLayout(layout))
    assert.equal(layout.help, '<p>Please <strong>help</strong>!!</p>')
  })

  it('should resolve refs', async () => {
    const compiled = compile({ type: 'object', properties: { str1: { $ref: '#/$defs/str1' } }, $defs: { str1: { type: 'string', title: 'String 1' } } })
    assert.ok(isCompObject(compiled.normalizedLayouts['_jl#/properties/str1']))
    assert.ok(isTextFieldLayout(compiled.normalizedLayouts['_jl#/properties/str1']))
    assert.equal(compiled.normalizedLayouts['_jl#/properties/str1']?.label, 'String 1')
  })

  it('should resolve refs with injected locale variables', async () => {
    const compiled = compile({ type: 'object', properties: { str1: { type: 'string', title: { $ref: '#/i18n/~$locale~/str1' } } }, i18n: { en: { str1: 'String 1' } } })
    assert.ok(isCompObject(compiled.normalizedLayouts['_jl#/properties/str1']))
    assert.ok(isTextFieldLayout(compiled.normalizedLayouts['_jl#/properties/str1']))
    assert.equal(compiled.normalizedLayouts['_jl#/properties/str1']?.label, 'String 1')
  })
})
