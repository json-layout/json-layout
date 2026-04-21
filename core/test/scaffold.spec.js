import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { compile, StatefulLayout } from '../src/index.js'
import { scaffoldDefault } from '../src/utils/scaffold.js'

describe('scaffoldDefault', () => {
  it('should return the schema default for a leaf when the leaf is required', async () => {
    const compiledLayout = await compile({
      type: 'object',
      required: ['greeting'],
      properties: {
        greeting: { type: 'string', default: 'hello' }
      }
    })
    const mainTree = compiledLayout.skeletonTrees[compiledLayout.mainTree]
    const rootSkeleton = compiledLayout.skeletonNodes[mainTree.root]
    const greetingPointer = /** @type {string[]} */(rootSkeleton.children)
      .map(p => compiledLayout.skeletonNodes[p])
      .find(n => n.key === 'greeting').pointer
    assert.equal(scaffoldDefault(greetingPointer, compiledLayout), 'hello')
  })

  it('should return undefined for an optional leaf with no default', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: { greeting: { type: 'string' } }
    })
    const mainTree = compiledLayout.skeletonTrees[compiledLayout.mainTree]
    const rootSkeleton = compiledLayout.skeletonNodes[mainTree.root]
    const greetingPointer = /** @type {string[]} */(rootSkeleton.children)
      .map(p => compiledLayout.skeletonNodes[p])
      .find(n => n.key === 'greeting').pointer
    assert.equal(scaffoldDefault(greetingPointer, compiledLayout), undefined)
  })

  it('should scaffold a required object with required children only', async () => {
    const compiledLayout = await compile({
      type: 'object',
      required: ['str', 'num'],
      properties: {
        str: { type: 'string', default: 'x' },
        num: { type: 'integer', default: 0 },
        opt: { type: 'string', default: 'ignored' }
      }
    })
    const mainTree = compiledLayout.skeletonTrees[compiledLayout.mainTree]
    assert.deepEqual(scaffoldDefault(mainTree.root, compiledLayout), { str: 'x', num: 0 })
  })

  it('should scaffold an array as []', async () => {
    const compiledLayout = await compile({
      type: 'object',
      required: ['arr'],
      properties: {
        arr: { type: 'array', layout: 'list', items: { type: 'string' } }
      }
    })
    const mainTree = compiledLayout.skeletonTrees[compiledLayout.mainTree]
    const rootSkeleton = compiledLayout.skeletonNodes[mainTree.root]
    const arrPointer = /** @type {string[]} */(rootSkeleton.children)
      .map(p => compiledLayout.skeletonNodes[p])
      .find(n => n.key === 'arr').pointer
    assert.deepEqual(scaffoldDefault(arrPointer, compiledLayout), [])
  })

  it('should scaffold a required nested object recursively', async () => {
    const compiledLayout = await compile({
      type: 'object',
      required: ['outer'],
      properties: {
        outer: {
          type: 'object',
          required: ['inner'],
          properties: {
            inner: { type: 'string', default: 'in' }
          }
        }
      }
    })
    const mainTree = compiledLayout.skeletonTrees[compiledLayout.mainTree]
    assert.deepEqual(
      scaffoldDefault(mainTree.root, compiledLayout),
      { outer: { inner: 'in' } }
    )
  })

  it('should scaffold a oneOf by picking the first variant', async () => {
    const compiledLayout = await compile({
      type: 'object',
      required: ['value'],
      properties: {
        value: {
          oneOf: [
            { type: 'object', required: ['a'], properties: { a: { type: 'string', default: 'A' } } },
            { type: 'object', required: ['b'], properties: { b: { type: 'integer', default: 1 } } }
          ]
        }
      }
    })
    const mainTree = compiledLayout.skeletonTrees[compiledLayout.mainTree]
    const result = /** @type {any} */(scaffoldDefault(mainTree.root, compiledLayout))
    assert.deepEqual(result.value, { a: 'A' })
  })

  it('should fill in the discriminator property for a discriminated oneOf', async () => {
    const compiledLayout = await compile({
      type: 'object',
      required: ['value'],
      properties: {
        value: {
          discriminator: { propertyName: 'kind' },
          required: ['kind'],
          oneOf: [
            {
              properties: { kind: { const: 'alpha' }, a: { type: 'string', default: 'A' } },
              required: ['a']
            },
            {
              properties: { kind: { const: 'beta' }, b: { type: 'integer', default: 2 } },
              required: ['b']
            }
          ]
        }
      }
    })
    const mainTree = compiledLayout.skeletonTrees[compiledLayout.mainTree]
    const result = /** @type {any} */(scaffoldDefault(mainTree.root, compiledLayout))
    assert.equal(result.value.kind, 'alpha')
    assert.equal(result.value.a, 'A')
  })
})

describe('scaffoldDefault parity with StatefulLayout', () => {
  it('matches StatefulLayout root data for an object with required children', async () => {
    const schema = {
      type: 'object',
      required: ['a', 'b'],
      properties: {
        a: { type: 'string', default: 'A' },
        b: { type: 'integer', default: 7 }
      }
    }
    const compiledLayout = await compile(schema)
    const statefulLayout = new StatefulLayout(
      compiledLayout,
      compiledLayout.skeletonTrees[compiledLayout.mainTree],
      { debounceInputMs: 0 },
      undefined
    )
    const scaffolded = scaffoldDefault(compiledLayout.skeletonTrees[compiledLayout.mainTree].root, compiledLayout)
    assert.deepEqual(scaffolded, statefulLayout.stateTree.root.data)
  })
})
