import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { resolve } from 'node:path'
import { writeFile } from 'node:fs/promises'
import { compile, StatefulLayout } from '../src/index.js'
import { serialize } from '../src/compile/serialize.js'
import { isCompObject } from '@json-layout/vocabulary'

describe('internationalization', () => {
  const defaultOptions = { debounceInputMs: 0 }

  it('should resolve refs with injected locale variables', async () => {
    const compiled = compile({ type: 'object', properties: { str1: { type: 'string', title: { $ref: '#/$defs/i18n/~$locale~/str1' } } }, $defs: { i18n: { en: { str1: 'String 1' } } } })
    assert.ok(isCompObject(compiled.normalizedLayouts['_jl#/properties/str1']))
    assert.ok(compiled.normalizedLayouts['_jl#/properties/str1'].comp === 'text-field')
    assert.equal(compiled.normalizedLayouts['_jl#/properties/str1']?.label, 'String 1')
  })

  it('should resolve x-i18n-* annotations', async () => {
    const schema = {
      type: 'object',
      layout: {
        title: null,
        children: [
          {
            title: 'Section 1',
            'x-i18n-title': {
              fr: 'Partie 1'
            },
            children: ['str1']
          },
          { key: 'tuple1' },
          { key: 'str4' }
        ]
      },
      properties: {
        str1: { type: 'string', title: 'String 1', 'x-i18n-title': { fr: 'Texte 1' }, enum: ['str1', null] },
        tuple1: {
          type: 'array',
          items: [
            { type: 'string', title: 'String 2', 'x-i18n-title': { fr: 'Texte 2' } },
            { type: 'string', title: 'String 3', 'x-i18n-title': { fr: 'Texte 3' } }
          ]
        },
        str4: { type: 'string', layout: { label: 'String 4', 'x-i18n-label': { fr: 'Texte 4' } } },
      }
    }
    const compiled = compile(schema, { xI18n: true })
    assert.ok(isCompObject(compiled.normalizedLayouts['_jl#/properties/str1']))
    assert.ok(compiled.normalizedLayouts['_jl#/properties/str1'].comp === 'select')
    assert.equal(compiled.normalizedLayouts['_jl#/properties/str1']?.label, 'String 1')
    assert.ok(isCompObject(compiled.normalizedLayouts['_jl#/properties/tuple1']))
    assert.equal(compiled.normalizedLayouts['_jl#/properties/tuple1'].comp, 'section')
    assert.ok(isCompObject(compiled.normalizedLayouts['_jl#/properties/tuple1/items/0']))
    assert.equal(compiled.normalizedLayouts['_jl#/properties/tuple1/items/0']?.label, 'String 2')
    assert.ok(isCompObject(compiled.normalizedLayouts['_jl#/properties/tuple1/items/1']))
    assert.equal(compiled.normalizedLayouts['_jl#/properties/tuple1/items/1']?.label, 'String 3')
    assert.ok(isCompObject(compiled.normalizedLayouts['_jl#/properties/str4']))
    assert.equal(compiled.normalizedLayouts['_jl#/properties/str4']?.label, 'String 4')

    const compiledFr = compile(schema, { xI18n: true, locale: 'fr' })
    assert.ok(isCompObject(compiledFr.normalizedLayouts['_jl#/properties/str1']))
    assert.ok(compiledFr.normalizedLayouts['_jl#/properties/str1'].comp === 'select')
    assert.equal(compiledFr.normalizedLayouts['_jl#/properties/str1']?.label, 'Texte 1')
    assert.ok(isCompObject(compiledFr.normalizedLayouts['_jl#/properties/tuple1']))
    assert.ok(isCompObject(compiledFr.normalizedLayouts['_jl#/properties/tuple1/items/0']))
    assert.equal(compiledFr.normalizedLayouts['_jl#/properties/tuple1/items/0']?.label, 'Texte 2')
    assert.ok(isCompObject(compiledFr.normalizedLayouts['_jl#/properties/tuple1/items/1']))
    assert.equal(compiledFr.normalizedLayouts['_jl#/properties/tuple1/items/1']?.label, 'Texte 3')
    assert.ok(isCompObject(compiledFr.normalizedLayouts['_jl#/properties/str4']))
    assert.equal(compiledFr.normalizedLayouts['_jl#/properties/str4']?.label, 'Texte 4')
  })

  it('should return validation errors internationalized by ajv', async () => {
    const compiledLayout = compile({ type: 'integer', minimum: 0 }, { locale: 'fr' })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions, -10)
    assert.equal(statefulLayout.stateTree.root.error, 'Doit être >= 0')
  })

  it('should write its own validation messages for fr and keep ajv-i18n for other locales', async () => {
    /** @type {(schema: any, data: unknown, locale: string) => string | undefined} */
    const errorOf = (schema, data, locale) => {
      const compiledLayout = compile(schema, { locale })
      return new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions, data).stateTree.root.error
    }
    assert.equal(errorOf({ type: 'string', minLength: 3 }, 'a', 'fr'), 'Doit faire au moins 3 caractères')
    assert.equal(errorOf({ type: 'string', maxLength: 1 }, 'ab', 'fr'), 'Doit faire au plus 1 caractère')
    assert.equal(errorOf({ type: 'string', format: 'email' }, 'x', 'fr'), 'Doit être au format email')
    assert.equal(errorOf({ type: 'string', pattern: '^[0-9]{5}$' }, 'x', 'fr'), 'Doit être au format ^[0-9]{5}$')
    assert.equal(errorOf({ type: 'integer', maximum: 100 }, 101, 'fr'), 'Doit être <= 100')
    assert.equal(errorOf({ type: 'number' }, 'x', 'fr'), 'Doit être un nombre')
    assert.equal(errorOf({ type: 'string', enum: ['a', 'b'] }, 'c', 'fr'), 'Doit être une des valeurs proposées')
    assert.equal(errorOf({ type: 'array', items: { type: 'string' }, uniqueItems: true }, ['a', 'a'], 'fr'), 'Doit contenir des valeurs distinctes')
    assert.equal(errorOf({ type: 'array', items: { type: 'string' }, maxItems: 2 }, ['a', 'b', 'c'], 'fr'), 'Doit contenir au plus 2 éléments')
    assert.equal(errorOf({ type: 'string', minLength: 3 }, 'a', 'de'), 'Darf nicht kürzer als 3 Zeichen sein')
  })

  it('should capitalize custom error messages and survive an invalid locale', async () => {
    const custom = compile({ type: 'integer', minimum: 0, errorMessage: { minimum: 'au moins zéro' } }, { locale: 'fr' })
    const customLayout = new StatefulLayout(custom, custom.skeletonTrees[custom.mainTree], defaultOptions, -10)
    assert.equal(customLayout.stateTree.root.error, 'Au moins zéro')

    // an invalid language tag must not break validation
    const invalidLocale = compile({ type: 'integer', minimum: 0 }, { locale: 'not a locale' })
    const invalidLayout = new StatefulLayout(invalidLocale, invalidLocale.skeletonTrees[invalidLocale.mainTree], defaultOptions, -10)
    assert.equal(invalidLayout.stateTree.root.error, 'Must be >= 0')
  })

  it('should return internationalized errors in compiled mode too', async () => {
    const compiledLayout = compile({ type: 'integer', minimum: 0 }, { locale: 'fr' })
    const code = await serialize(compiledLayout)
    const filePath = resolve('tmp/compiled-i18n.js')
    await writeFile(filePath, code + '\nexport default compiledLayout;')
    const serializedLayout = (await import(filePath)).default

    const statefulLayout = new StatefulLayout(serializedLayout, serializedLayout.skeletonTrees[serializedLayout.mainTree], defaultOptions, -10)
    assert.equal(statefulLayout.stateTree.root.error, 'Doit être >= 0')
  })

  it('should let ajv-i18n fallback to en in compiled mode', async () => {
    const compiledLayout = compile({ type: 'integer', minimum: 0 }, { locale: 'pt' })
    const code = await serialize(compiledLayout)
    const filePath = resolve('tmp/compiled-i18n2.js')
    await writeFile(filePath, code + '\nexport default compiledLayout;')
    const serializedLayout = (await import(filePath)).default

    const statefulLayout = new StatefulLayout(serializedLayout, serializedLayout.skeletonTrees[serializedLayout.mainTree], defaultOptions, -10)
    assert.equal(statefulLayout.stateTree.root.error, 'Must be >= 0')
  })

  it('names the menu of a list item\'s actions in every locale', () => {
    // the button opening a row's actions (edit, duplicate, delete…) is an icon: without a
    // name, neither a screen reader nor an assistant guiding the person can point to it
    for (const [locale, expected] of [['fr', 'Actions'], ['en', 'Actions'], ['de', 'Aktionen'], ['nl', 'Acties']]) {
      const compiledLayout = compile({ type: 'array', items: { type: 'string' }, layout: { comp: 'list' } }, { locale })
      const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions, [])
      assert.equal(statefulLayout.stateTree.root.messages.actions, expected, locale)
    }
  })

  it('should overwrite non-compilation time messages on a state node', async () => {
    const compiledLayout = compile({
      type: 'object',
      properties: {
        array1: { type: 'array', items: { type: 'string' }, layout: { comp: 'list', messages: { addItem: 'Add item to array 1' } } },
        array2: { type: 'array', items: { type: 'string' }, layout: { comp: 'list', messages: { addItem: 'Add item to array 2' } } }
      }
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions, -10)
    assert.equal(statefulLayout.stateTree.root.children?.[0].messages.addItem, 'Add item to array 1')
    assert.equal(statefulLayout.stateTree.root.children?.[1].messages.addItem, 'Add item to array 2')
  })
})

describe('x-i18n annotations when xI18n is off', () => {
  // x-i18n-* keys are part of the vocabulary's own i18n feature; the option says whether
  // to APPLY them, not whether they are legal. Left in place they hit the component
  // schemas' unevaluatedProperties: false, normalization falls back to comp "none", and a
  // one-of-select that is no longer a variant selector stops merging its branch into the
  // parent — the data then never stabilises and updateState throws after 100 iterations.
  const branch = (/** @type {string} */ title, /** @type {object} */ extra) => ({
    title,
    required: ['type'],
    properties: { type: { const: title.toLowerCase() }, ...extra }
  })
  const schema = {
    type: 'object',
    properties: { elements: { type: 'array', items: { $ref: '#/$defs/element' } } },
    $defs: {
      element: {
        type: 'object',
        oneOfLayout: { label: 'Type', 'x-i18n-label': { fr: 'Type' } },
        discriminator: { propertyName: 'type' },
        oneOf: [branch('Text', { content: { type: 'string' } }), branch('Image', { url: { type: 'string' } })]
      }
    }
  }
  const data = { elements: [{ type: 'text', content: 'hi' }] }

  it('should normalize a oneOfLayout carrying x-i18n keys with xI18n off', () => {
    const compiled = compile(schema, { ajvOptions: { discriminator: true } })
    assert.deepEqual(compiled.validationErrors, {}, 'an x-i18n key must not make a layout unnormalizable')
    const oneOf = Object.entries(compiled.normalizedLayouts).find(([k]) => k.endsWith('/$defs/element/oneOf'))?.[1]
    assert.equal(/** @type {any} */(oneOf).comp, 'one-of-select', 'the variant selector must survive')
  })

  it('should keep the data stable with xI18n off', () => {
    const compiled = compile(schema, { ajvOptions: { discriminator: true } })
    const layout = new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree], { validateOn: 'input' }, structuredClone(data))
    assert.deepEqual(layout.data, data, 'the branch must merge into its parent, not be keyed under its index')
  })

  it('should still translate when xI18n is on', () => {
    const compiled = compile(schema, { xI18n: true, locale: 'fr', ajvOptions: { discriminator: true } })
    const oneOf = Object.entries(compiled.normalizedLayouts).find(([k]) => k.endsWith('/$defs/element/oneOf'))?.[1]
    assert.equal(/** @type {any} */(oneOf).label, 'Type')
  })
})
