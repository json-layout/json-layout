import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { compile, StatefulLayout } from '../src/index.js'
import ajvModule from 'ajv/dist/2019.js'
import addFormats from 'ajv-formats'
import ajvErrors from 'ajv-errors'

// @ts-ignore
const Ajv = /** @type {typeof ajvModule.default} */ (ajvModule)

const makeAjv = () => {
  const ajv = new Ajv({ allErrors: true, strict: false, verbose: true })
  addFormats.default(ajv)
  ajvErrors.default(ajv)
  return ajv
}

describe('Fast-path rewrite of discriminated oneOfs', () => {
  const defaultOptions = { debounceInputMs: 0 }

  /** @returns {any} */
  const makeElementSchema = () => ({
    type: 'object',
    unevaluatedProperties: false,
    discriminator: { propertyName: 'key' },
    oneOf: [{ $ref: '#/$defs/oneOf1' }, { $ref: '#/$defs/oneOf2' }],
    $defs: {
      oneOf1: {
        required: ['key', 'str1'],
        properties: {
          key: { type: 'string', const: 'key1' },
          str1: { type: 'string' }
        }
      },
      oneOf2: {
        required: ['key', 'str2'],
        properties: {
          key: { type: 'string', const: 'key2' },
          str2: { type: 'string' }
        }
      }
    }
  })

  it('should rewrite an eligible oneOf and preserve validation behavior', async () => {
    const compiledLayout = await compile(makeElementSchema())
    // the oneOf was replaced by cheap tag-only branches and the deep validation moved to if/then guards
    assert.equal(compiledLayout.schema?.allOf?.length, 2)
    assert.ok(compiledLayout.schema?.allOf?.[0].then.$ref)
    assert.ok(!compiledLayout.schema?.oneOf?.[0].$ref)

    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions, { key: 'key1', str1: 'ok' })
    assert.equal(statefulLayout.valid, true)
    statefulLayout.data = { key: 'key1' }
    assert.equal(statefulLayout.valid, false)
    const statefulLayout2 = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions, {})
    assert.equal(statefulLayout2.valid, false)
    assert.equal(statefulLayout2.stateTree.root.children?.find(c => c.key === '$oneOf')?.error, 'chose one')
  })

  it('should not mutate the schemas registered on a user-supplied ajv instance', async () => {
    const ajv = makeAjv()
    const { $defs, ...element } = makeElementSchema()
    const elementsSchema = {
      $id: 'https://test.com/elements',
      $defs: { element, ...$defs }
    }
    ajv.addSchema(elementsSchema)
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        element: { $ref: 'https://test.com/elements#/$defs/element' }
      }
    }, { ajv })

    // the caller's schema object is left untouched
    assert.ok(elementsSchema.$defs.element.discriminator)
    assert.ok(elementsSchema.$defs.element.oneOf[0].$ref)
    assert.ok(!(/** @type {any} */(elementsSchema.$defs.element).allOf))
    // but the fast path was applied to the version known to ajv
    const registered = /** @type {any} */(ajv.getSchema('https://test.com/elements')?.schema)
    assert.equal(registered?.$defs.element.allOf?.length, 2)

    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions, { element: { key: 'key1', str1: 'ok' } })
    assert.equal(statefulLayout.valid, true)
    statefulLayout.data = { element: { key: 'key1' } }
    assert.equal(statefulLayout.valid, false)
  })

  it('should keep applying the rewrite when recompiling with the same ajv instance', async () => {
    const ajv = makeAjv()
    const { $defs, ...element } = makeElementSchema()
    const schema = {
      type: 'object',
      properties: {
        element: { $ref: '#/$defs/element' }
      },
      $defs: { element, ...$defs }
    }
    const compiledLayout1 = await compile(schema, { ajv })
    assert.equal(/** @type {any} */(compiledLayout1.schema)?.$defs.element.allOf?.length, 2)
    const compiledLayout2 = await compile(schema, { ajv })
    assert.equal(/** @type {any} */(compiledLayout2.schema)?.$defs.element.allOf?.length, 2)
  })

  it('should leave the oneOf untouched when a branch does not require the discriminator', async () => {
    const schema = makeElementSchema()
    schema.$defs.oneOf1.required = ['str1']
    delete schema.unevaluatedProperties
    const compiledLayout = await compile(schema)
    assert.ok(!compiledLayout.schema?.allOf)
    assert.ok(compiledLayout.schema?.oneOf?.[0].$ref)

    // data without the discriminator that matches exactly one branch is valid, as before the rewrite
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions, { str1: 'ok' })
    assert.equal(statefulLayout.valid, true)
  })

  it('should leave the oneOf untouched when two branches share the same discriminator const', async () => {
    const schema = makeElementSchema()
    schema.$defs.oneOf2.properties.key.const = 'key1'
    delete schema.unevaluatedProperties
    const compiledLayout = await compile(schema)
    assert.ok(!compiledLayout.schema?.allOf)
    assert.ok(compiledLayout.schema?.oneOf?.[0].$ref)

    // data that fully matches only the first branch is valid, as before the rewrite
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions, { key: 'key1', str1: 'ok' })
    assert.equal(statefulLayout.valid, true)
  })

  it('should not rewrite schema-lookalike values stored in data keywords', async () => {
    const schema = makeElementSchema()
    /** @type {any} */
    const lookalike = {
      discriminator: { propertyName: 'key' },
      oneOf: [{ $ref: '#/$defs/oneOf1' }]
    }
    schema.$defs.oneOf1.properties.data = { type: 'object', default: structuredClone(lookalike) }
    const compiledLayout = await compile(schema)
    assert.deepEqual(/** @type {any} */(compiledLayout.schema)?.$defs.oneOf1.properties.data.default, lookalike)
  })

  it('should resolve relative refs to other registered schemas', async () => {
    const ajv = makeAjv()
    ajv.addSchema({
      $id: 'https://test.com/branches',
      $defs: {
        oneOf1: {
          required: ['key', 'str1'],
          properties: {
            key: { type: 'string', const: 'key1' },
            str1: { type: 'string' }
          }
        }
      }
    })
    const compiledLayout = await compile({
      $id: 'https://test.com/main',
      type: 'object',
      discriminator: { propertyName: 'key' },
      oneOf: [{ $ref: 'branches#/$defs/oneOf1' }]
    }, { ajv })
    assert.equal(compiledLayout.schema?.allOf?.length, 1)
    assert.ok(compiledLayout.schema?.allOf?.[0].then.$ref)
  })
})
