import { describe, it, beforeEach } from 'node:test'
import { strict as assert } from 'node:assert'
import { createAgentToolkit, type AgentToolkit } from '../src/index.ts'

describe('agent toolkit', () => {
  let toolkit: AgentToolkit

  beforeEach(() => {
    toolkit = createAgentToolkit({ ttlMs: 60000 })
  })

  describe('compile', () => {
    it('should compile a simple string schema', () => {
      const result = toolkit.compile({ schema: { type: 'string' } })
      assert.ok(result.id)
      assert.equal(result.valid, true)
      assert.deepEqual(result.errors, [])
    })

    it('should compile an object schema with properties', () => {
      const result = toolkit.compile({
        schema: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', title: 'Name' },
            age: { type: 'integer', title: 'Age' }
          }
        }
      })
      assert.ok(result.id)
      assert.equal(result.valid, true)
    })

    it('should accept a custom id', () => {
      const result = toolkit.compile({ schema: { type: 'string' }, id: 'my-schema' })
      assert.equal(result.id, 'my-schema')
    })
  })

  describe('createState', () => {
    it('should create state from a compiled layout', () => {
      const { id } = toolkit.compile({
        schema: {
          type: 'object',
          properties: {
            name: { type: 'string' }
          }
        }
      })

      const result = toolkit.createState({ compiledId: id })
      assert.ok(result.stateId)
      assert.ok(result.state)
      assert.equal(result.state.valid, true)
      assert.ok(result.state.root)
      assert.equal(result.state.root.comp, 'section')
    })

    it('should accept initial data', () => {
      const { id } = toolkit.compile({
        schema: {
          type: 'object',
          properties: {
            name: { type: 'string' }
          }
        }
      })

      const result = toolkit.createState({ compiledId: id, data: { name: 'Alice' } })
      assert.deepEqual(result.state.root.data, { name: 'Alice' })
    })

    it('should throw for unknown compiled id', () => {
      assert.throws(
        () => toolkit.createState({ compiledId: 'nonexistent' }),
        /compiled layout not found/
      )
    })
  })

  describe('describeState', () => {
    it('should describe the full state tree', () => {
      const { id } = toolkit.compile({
        schema: {
          type: 'object',
          properties: {
            name: { type: 'string', title: 'Name' },
            email: { type: 'string', title: 'Email' }
          }
        }
      })
      const { stateId } = toolkit.createState({ compiledId: id })
      const result = toolkit.describeState({ stateId })

      assert.equal(result.valid, true)
      assert.ok('root' in result.state)
      const tree = result.state as import('../src/types.ts').ProjectedStateTree
      assert.ok(tree.root.children)
      assert.equal(tree.root.children.length, 2)
    })

    it('should describe a subtree by path', () => {
      const { id } = toolkit.compile({
        schema: {
          type: 'object',
          properties: {
            name: { type: 'string', title: 'Name' }
          }
        }
      })
      const { stateId } = toolkit.createState({ compiledId: id })
      const result = toolkit.describeState({ stateId, path: '/name' })

      assert.ok(!('root' in result.state))
      assert.equal(result.state.comp, 'text-field')
      assert.equal(result.state.key, 'name')
    })

    it('should throw for unknown path', () => {
      const { id } = toolkit.compile({ schema: { type: 'object', properties: { name: { type: 'string' } } } })
      const { stateId } = toolkit.createState({ compiledId: id })

      assert.throws(
        () => toolkit.describeState({ stateId, path: '/nonexistent' }),
        /node not found/
      )
    })
  })

  describe('setData', () => {
    it('should set data and return updated state', () => {
      const { id } = toolkit.compile({
        schema: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string' }
          }
        }
      })
      const { stateId } = toolkit.createState({ compiledId: id })

      const result = toolkit.setData({ stateId, data: { name: 'Bob' } })
      assert.equal(result.valid, true)
      assert.deepEqual(result.state.root.data, { name: 'Bob' })
    })

    it('should report validation errors', () => {
      const { id } = toolkit.compile({
        schema: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', minLength: 1 }
          }
        }
      })
      const { stateId } = toolkit.createState({ compiledId: id })

      // set empty string — should violate minLength
      const result = toolkit.setData({ stateId, data: { name: '' } })
      assert.equal(result.valid, false)
      assert.ok(result.errors.length > 0)
    })
  })

  describe('setFieldValue', () => {
    it('should set a specific field value', () => {
      const { id } = toolkit.compile({
        schema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            age: { type: 'integer' }
          }
        }
      })
      const { stateId } = toolkit.createState({ compiledId: id, data: { name: '', age: 0 } })

      const result = toolkit.setFieldValue({ stateId, path: '/name', value: 'Charlie' })
      assert.deepEqual(result.state.root.data, { name: 'Charlie', age: 0 })
    })
  })

  describe('validateState', () => {
    it('should trigger full validation', () => {
      const { id } = toolkit.compile({
        schema: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', minLength: 1 }
          }
        }
      })
      const { stateId } = toolkit.createState({ compiledId: id, data: {} })

      const result = toolkit.validateState({ stateId })
      assert.equal(result.valid, false)
      assert.ok(result.errors.length > 0)
      assert.ok(result.data !== undefined)
    })
  })

  describe('destroyById', () => {
    it('should destroy a compiled layout by id', () => {
      const { id } = toolkit.compile({ schema: { type: 'string' } })

      const result = toolkit.destroyById({ compiledId: id })
      assert.equal(result.deletedCompiled, true)
      assert.equal(result.deletedState, false)

      // creating state from deleted compiled should throw
      assert.throws(
        () => toolkit.createState({ compiledId: id }),
        /compiled layout not found/
      )
    })

    it('should destroy a stateful layout by id', () => {
      const { id } = toolkit.compile({
        schema: { type: 'object', properties: { name: { type: 'string' } } }
      })
      const { stateId } = toolkit.createState({ compiledId: id })

      const result = toolkit.destroyById({ stateId })
      assert.equal(result.deletedCompiled, false)
      assert.equal(result.deletedState, true)

      // accessing destroyed state should throw
      assert.throws(
        () => toolkit.describeState({ stateId }),
        /stateful layout not found/
      )
    })

    it('should destroy both compiled and state at once', () => {
      const { id } = toolkit.compile({
        schema: { type: 'object', properties: { name: { type: 'string' } } }
      })
      const { stateId } = toolkit.createState({ compiledId: id })

      const result = toolkit.destroyById({ compiledId: id, stateId })
      assert.equal(result.deletedCompiled, true)
      assert.equal(result.deletedState, true)
    })

    it('should return false when ids do not exist', () => {
      const result = toolkit.destroyById({ compiledId: 'nonexistent' })
      assert.equal(result.deletedCompiled, false)
      assert.equal(result.deletedState, false)
    })

    it('should throw when neither id is provided', () => {
      assert.throws(
        () => toolkit.destroyById({}),
        /at least one of compiledId or stateId must be provided/
      )
    })
  })

  describe('getData', () => {
    it('should return current data and validity', () => {
      const { id } = toolkit.compile({
        schema: {
          type: 'object',
          properties: {
            name: { type: 'string' }
          }
        }
      })
      const { stateId } = toolkit.createState({ compiledId: id, data: { name: 'test' } })

      const result = toolkit.getData({ stateId })
      assert.deepEqual(result.data, { name: 'test' })
      assert.equal(result.valid, true)
    })
  })

  describe('constraints projection', () => {
    it('should expose min/max/step on number fields', () => {
      const { id } = toolkit.compile({
        schema: {
          type: 'object',
          properties: {
            num: { type: 'number', minimum: 0, maximum: 100, title: 'A number' }
          }
        }
      })
      const { stateId } = toolkit.createState({ compiledId: id })
      const result = toolkit.describeState({ stateId })
      const tree = result.state as import('../src/types.ts').ProjectedStateTree
      const numNode = tree.root.children![0]
      assert.equal(numNode.comp, 'number-field')
      assert.ok(numNode.constraints)
      assert.equal(numNode.constraints.min, 0)
      assert.equal(numNode.constraints.max, 100)
    })

    it('should expose min/max on slider', () => {
      const { id } = toolkit.compile({
        schema: {
          type: 'object',
          properties: {
            slider: { type: 'integer', minimum: 0, maximum: 50, layout: 'slider' }
          }
        }
      })
      const { stateId } = toolkit.createState({ compiledId: id })
      const result = toolkit.describeState({ stateId })
      const tree = result.state as import('../src/types.ts').ProjectedStateTree
      const sliderNode = tree.root.children![0]
      assert.equal(sliderNode.comp, 'slider')
      assert.ok(sliderNode.constraints)
      assert.equal(sliderNode.constraints.min, 0)
      assert.equal(sliderNode.constraints.max, 50)
    })

    it('should expose format on date-picker', () => {
      const { id } = toolkit.compile({
        schema: {
          type: 'object',
          properties: {
            d: { type: 'string', format: 'date-time', layout: 'date-picker' }
          }
        }
      })
      const { stateId } = toolkit.createState({ compiledId: id })
      const result = toolkit.describeState({ stateId })
      const tree = result.state as import('../src/types.ts').ProjectedStateTree
      const dateNode = tree.root.children![0]
      assert.equal(dateNode.comp, 'date-picker')
      assert.ok(dateNode.constraints)
      assert.equal(dateNode.constraints.format, 'date-time')
    })

    it('should expose separator on combobox', () => {
      const { id } = toolkit.compile({
        schema: {
          type: 'object',
          properties: {
            s: { type: 'string', layout: { separator: ',' } }
          }
        }
      })
      const { stateId } = toolkit.createState({ compiledId: id })
      const result = toolkit.describeState({ stateId })
      const tree = result.state as import('../src/types.ts').ProjectedStateTree
      const comboNode = tree.root.children![0]
      assert.equal(comboNode.comp, 'combobox')
      assert.ok(comboNode.constraints)
      assert.equal(comboNode.constraints.separator, ',')
    })

    it('should not include constraints when none apply', () => {
      const { id } = toolkit.compile({
        schema: {
          type: 'object',
          properties: {
            name: { type: 'string' }
          }
        }
      })
      const { stateId } = toolkit.createState({ compiledId: id })
      const result = toolkit.describeState({ stateId })
      const tree = result.state as import('../src/types.ts').ProjectedStateTree
      const nameNode = tree.root.children![0]
      assert.equal(nameNode.comp, 'text-field')
      assert.equal(nameNode.constraints, undefined)
    })
  })

  describe('oneOf variants', () => {
    it('should expose oneOfItems in the projected state', () => {
      const { id } = toolkit.compile({
        schema: {
          type: 'object',
          oneOf: [
            { title: 'Option A', properties: { key: { const: 'a' }, str1: { type: 'string' } } },
            { title: 'Option B', properties: { key: { const: 'b' }, str2: { type: 'string' } } }
          ]
        }
      })
      const { stateId } = toolkit.createState({ compiledId: id })
      const result = toolkit.describeState({ stateId })
      const tree = result.state as import('../src/types.ts').ProjectedStateTree
      const oneOfNode = tree.root.children![0]
      assert.equal(oneOfNode.comp, 'one-of-select')
      assert.ok(oneOfNode.oneOfItems)
      assert.deepEqual(oneOfNode.oneOfItems, [
        { key: 0, title: 'Option A' },
        { key: 1, title: 'Option B' }
      ])
    })

    it('should return oneOf variants via getFieldSuggestions', async () => {
      const { id } = toolkit.compile({
        schema: {
          type: 'object',
          oneOf: [
            { title: 'Variant 1', properties: { key: { const: 'v1' } } },
            { title: 'Variant 2', properties: { key: { const: 'v2' } } },
            { title: 'Variant 3', properties: { key: { const: 'v3' } } }
          ]
        }
      })
      const { stateId } = toolkit.createState({ compiledId: id })
      const result = await toolkit.getFieldSuggestions({ stateId, path: '/$oneOf' })
      assert.deepEqual(result.items, [
        { value: 0, title: 'Variant 1' },
        { value: 1, title: 'Variant 2' },
        { value: 2, title: 'Variant 3' }
      ])
    })
  })

  describe('coerceTypes', () => {
    it('should coerce a scalar value into an array', () => {
      const { id } = toolkit.compile({
        schema: {
          type: 'object',
          properties: {
            tags: { type: 'array', items: { type: 'string' } }
          }
        }
      })
      const { stateId } = toolkit.createState({ compiledId: id })
      toolkit.setData({ stateId, data: { tags: 'single' } })
      const result = toolkit.getData({ stateId })
      assert.deepEqual(result.data, { tags: ['single'] })
      assert.ok(result.valid)
    })

    it('should coerce a string to a number', () => {
      const { id } = toolkit.compile({
        schema: {
          type: 'object',
          properties: {
            age: { type: 'integer' }
          }
        }
      })
      const { stateId } = toolkit.createState({ compiledId: id })
      toolkit.setData({ stateId, data: { age: '42' } })
      const result = toolkit.getData({ stateId })
      assert.deepEqual(result.data, { age: 42 })
      assert.ok(result.valid)
    })
  })
})
