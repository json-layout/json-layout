import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { compile, StatefulLayout } from '../src/index.js'

/**
 * @param {import('../src/index.js').StateNode} node
 * @param {(node: import('../src/index.js').StateNode) => boolean} predicate
 * @returns {import('../src/index.js').StateNode | undefined}
 */
function findNode (node, predicate) {
  if (predicate(node)) return node
  for (const child of node.children ?? []) {
    const found = findNode(child, predicate)
    if (found) return found
  }
}

describe('Management of additional properties', () => {
  const defaultOptions = { debounceInputMs: 0 }

  it('should keep additional properties by default', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        str1: { type: 'string' }
      }
    })
    const statefulLayout = new StatefulLayout(
      compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree],
      defaultOptions,
      { str1: 'str1', str2: 'str2' }
    )
    assert.ok(statefulLayout.valid)
    assert.deepEqual(statefulLayout.data, { str1: 'str1', str2: 'str2' })
  })

  it('should remove additional property if it is rejected by the schema', async () => {
    const compiledLayout = await compile({
      type: 'object',
      additionalProperties: false,
      properties: {
        str1: { type: 'string' }
      }
    })
    const statefulLayout = new StatefulLayout(
      compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree],
      defaultOptions,
      { str1: 'str1', str2: 'str2' }
    )
    assert.ok(statefulLayout.valid)
    assert.deepEqual(statefulLayout.data, { str1: 'str1' })
  })

  it('should also remove property based on unevaluatedProperties keyword', async () => {
    const compiledLayout = await compile({
      type: 'object',
      unevaluatedProperties: false,
      properties: {
        str1: { type: 'string' }
      }
    })
    const statefulLayout = new StatefulLayout(
      compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree],
      defaultOptions,
      { str1: 'str1', str2: 'str2' }
    )
    assert.ok(statefulLayout.valid)
    assert.deepEqual(statefulLayout.data, { str1: 'str1' })
  })

  it('should remove additional property if option is activated', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        str1: { type: 'string' }
      }
    })
    const statefulLayout = new StatefulLayout(
      compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree],
      { ...defaultOptions, removeAdditional: 'unknown' },
      { str1: 'str1', str2: 'str2' }
    )
    assert.ok(statefulLayout.valid)
    assert.deepEqual(statefulLayout.data, { str1: 'str1' })
  })

  it('should not remove properties that are defined in a allOf', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        str1: { type: 'string' }
      },
      allOf: [{
        properties: {
          str2: { type: 'string' }
        }
      }]
    })
    const statefulLayout = new StatefulLayout(
      compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree],
      { ...defaultOptions, removeAdditional: 'unknown' },
      { str1: 'str1', str2: 'str2', str3: 'str3' }
    )
    assert.ok(statefulLayout.valid)
    assert.deepEqual(statefulLayout.data, { str1: 'str1', str2: 'str2' })
  })

  it('should not remove properties that are defined in a oneOf', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        str1: { type: 'string' }
      },
      oneOf: [{
        properties: {
          str2: { type: 'string' }
        }
      }]
    })
    const statefulLayout = new StatefulLayout(
      compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree],
      { ...defaultOptions, removeAdditional: 'unknown' },
      { str1: 'str1', str2: 'str2', str3: 'str3' }
    )
    assert.ok(statefulLayout.valid)
    assert.deepEqual(statefulLayout.data, { str1: 'str1', str2: 'str2' })
  })

  it('should support different values of removeAdditional option on different parts of the schema', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        obj1: {
          type: 'object',
          properties: {
            str1: { type: 'string' }
          }
        },
        obj2: {
          type: 'object',
          layout: {
            removeAdditional: false
          },
          properties: {
            str1: { type: 'string' }
          }
        }
      }
    })
    const statefulLayout = new StatefulLayout(
      compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree],
      { ...defaultOptions, removeAdditional: 'unknown' },
      { obj1: { str1: 'str1', str2: 'str2' }, obj2: { str1: 'str1', str2: 'str2' } }
    )
    assert.ok(statefulLayout.valid)
    assert.deepEqual(statefulLayout.data, { obj1: { str1: 'str1' }, obj2: { str1: 'str1', str2: 'str2' } })
  })
  // A chart editor switched from a bar chart to a pie chart: the nested config of the bar kept a
  // property the pie's config rejects, and the form stayed invalid on a property nobody could see.
  // The configs are shared definitions, so the errors they raise do not point inside the oneOf.
  it('should remove a nested property rejected by the newly chosen option of a oneOf', async () => {
    const compiledLayout = await compile({
      type: 'object',
      discriminator: { propertyName: 'type' },
      oneOf: [{
        title: 'Bar',
        required: ['type'],
        additionalProperties: false,
        properties: { type: { const: 'bar' }, config: { $ref: '#/$defs/barConfig' }, horizontal: { type: 'boolean' } }
      }, {
        title: 'Pie',
        required: ['type'],
        additionalProperties: false,
        properties: { type: { const: 'pie' }, config: { $ref: '#/$defs/pieConfig' } }
      }],
      $defs: {
        barConfig: { type: 'object', additionalProperties: false, properties: { field: { type: 'string' }, color: { type: 'string' } } },
        pieConfig: { type: 'object', additionalProperties: false, properties: { field: { type: 'string' }, colors: { type: 'string' } } }
      }
    })
    const statefulLayout = new StatefulLayout(
      compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree],
      { ...defaultOptions, removeAdditional: 'error' },
      { type: 'bar', horizontal: true, config: { field: 'f', color: 'red' } }
    )
    assert.ok(statefulLayout.valid)
    const oneOf = statefulLayout.stateTree.root.children?.find(c => c.key === '$oneOf')
    assert.ok(oneOf)
    statefulLayout.activateItem(oneOf, 1)
    assert.deepEqual(statefulLayout.data, { type: 'pie', config: { field: 'f' } })
    assert.ok(statefulLayout.valid)
  })

  // A page editor switched a text block nested in a two-columns block to an alert: the text's
  // centered stayed in the data and the form was invalid with no error located anywhere. The
  // nested block is described by the same definition as the blocks around it, so the error it
  // raises points at a sibling option of the enclosing block's oneOf, which dropped it as its own.
  it('should remove a property of the previous option of a oneOf nested in the same recursive definition', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: { elements: { type: 'array', items: { $ref: '#/$defs/element' } } },
      $defs: {
        element: {
          type: 'object',
          discriminator: { propertyName: 'type' },
          oneOf: [{
            title: 'Text',
            required: ['type'],
            additionalProperties: false,
            properties: { type: { const: 'text' }, content: { type: 'string' }, centered: { type: 'boolean' } }
          }, {
            title: 'Alert',
            required: ['type'],
            additionalProperties: false,
            properties: { type: { const: 'alert' }, content: { type: 'string' } }
          }, {
            title: 'Columns',
            required: ['type'],
            additionalProperties: false,
            properties: { type: { const: 'columns' }, children: { type: 'array', items: { $ref: '#/$defs/element' } } }
          }]
        }
      }
    })
    const statefulLayout = new StatefulLayout(
      compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree],
      { ...defaultOptions, removeAdditional: 'error' },
      { elements: [{ type: 'columns', children: [{ type: 'text', content: 'help', centered: false }] }] }
    )
    assert.ok(statefulLayout.valid)
    const nestedOneOf = findNode(statefulLayout.stateTree.root, n => n.key === '$oneOf' && n.dataPath === '/elements/0/children/0')
    assert.ok(nestedOneOf)
    statefulLayout.activateItem(nestedOneOf, 1)
    assert.deepEqual(statefulLayout.data, { elements: [{ type: 'columns', children: [{ type: 'alert', content: 'help' }] }] })
    assert.ok(statefulLayout.valid)
  })

  it('should remove a property the previous option of a oneOf declared through an allOf', async () => {
    const compiledLayout = await compile({
      type: 'object',
      discriminator: { propertyName: 'type' },
      oneOf: [{
        title: 'Text',
        required: ['type'],
        allOf: [{ properties: { centered: { type: 'boolean' } } }],
        properties: { type: { const: 'text' }, content: { type: 'string' } },
        unevaluatedProperties: false
      }, {
        title: 'Alert',
        required: ['type'],
        additionalProperties: false,
        properties: { type: { const: 'alert' }, content: { type: 'string' } }
      }]
    })
    const statefulLayout = new StatefulLayout(
      compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree],
      { ...defaultOptions, removeAdditional: 'error' },
      { type: 'text', content: 'help', centered: true }
    )
    assert.ok(statefulLayout.valid)
    const oneOf = statefulLayout.stateTree.root.children?.find(c => c.key === '$oneOf')
    assert.ok(oneOf)
    statefulLayout.activateItem(oneOf, 1)
    assert.deepEqual(statefulLayout.data, { type: 'alert', content: 'help' })
    assert.ok(statefulLayout.valid)
  })
})
