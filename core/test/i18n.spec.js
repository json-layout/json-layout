import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { resolve } from 'node:path'
import { writeFile } from 'node:fs/promises'
import { compile, StatefulLayout } from '../src/index.js'
import { serialize } from '../src/compile/serialize.js'
import { isCompObject, isTextFieldLayout } from '@json-layout/vocabulary'

describe('internationalization', () => {
  const defaultOptions = { debounceInputMs: 0 }

  it('should resolve refs with injected locale variables', async () => {
    const compiled = compile({ type: 'object', properties: { str1: { type: 'string', title: { $ref: '#/$defs/i18n/~$locale~/str1' } } }, $defs: { i18n: { en: { str1: 'String 1' } } } })
    assert.ok(isCompObject(compiled.normalizedLayouts['_jl#/properties/str1']))
    assert.ok(isTextFieldLayout(compiled.normalizedLayouts['_jl#/properties/str1']))
    assert.equal(compiled.normalizedLayouts['_jl#/properties/str1']?.label, 'String 1')
  })

  it('should return validation errors internationalized by ajv', async () => {
    const compiledLayout = compile({ type: 'integer', minimum: 0 }, { locale: 'fr' })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTree, defaultOptions, -10)
    assert.equal(statefulLayout.stateTree.root.error, 'doit être >= 0')
  })

  it('should return internationalized errors in compiled mode too', async () => {
    const compiledLayout = compile({ type: 'integer', minimum: 0 }, { locale: 'fr', code: true })
    const code = serialize(compiledLayout)
    const filePath = resolve('tmp/compiled-i18n.js')
    await writeFile(filePath, code + '\nexport default compiledLayout;')
    const serializedLayout = (await import(filePath)).default

    const statefulLayout = new StatefulLayout(serializedLayout, serializedLayout.skeletonTree, defaultOptions, -10)
    assert.equal(statefulLayout.stateTree.root.error, 'doit être >= 0')
  })

  it('should overwrite non-compilation time messages on a state node', async () => {
    const compiledLayout = compile({
      type: 'object',
      properties: {
        array1: { type: 'array', items: { type: 'string' }, layout: { comp: 'list', messages: { addItem: 'Add item to array 1' } } },
        array2: { type: 'array', items: { type: 'string' }, layout: { comp: 'list', messages: { addItem: 'Add item to array 2' } } }
      }
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTree, defaultOptions, -10)
    assert.equal(statefulLayout.stateTree.root.children?.[0].messages.addItem, 'Add item to array 1')
    assert.equal(statefulLayout.stateTree.root.children?.[1].messages.addItem, 'Add item to array 2')
  })
})
