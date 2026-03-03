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
})
