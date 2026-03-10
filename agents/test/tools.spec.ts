import { describe, it, beforeEach } from 'node:test'
import { strict as assert } from 'node:assert'
import { createAgentToolkit, type AgentToolkit } from '../src/index.ts'

function createMockGetSchema (schemas: Record<string, Record<string, unknown>>) {
  const updateDates: Record<string, number> = {}
  return (
    path: string,
    updateDate?: number
  ): { schema: Record<string, unknown>, updateDate: number } | null => {
    const schema = schemas[path]
    if (!schema) return null

    const cachedUpdateDate = updateDates[path]
    if (updateDate !== undefined && cachedUpdateDate !== undefined && updateDate === cachedUpdateDate) {
      return null
    }

    const currentUpdateDate = Date.now()
    updateDates[path] = currentUpdateDate
    return { schema, updateDate: currentUpdateDate }
  }
}

describe('agent toolkit', () => {
  let toolkit: AgentToolkit
  let getSchema: ReturnType<typeof createMockGetSchema>
  const schemas: Record<string, Record<string, unknown>> = {}

  beforeEach(() => {
    getSchema = createMockGetSchema(schemas)
    toolkit = createAgentToolkit({ getSchema })
    Object.keys(schemas).forEach(key => delete schemas[key])
  })

  describe('compile', () => {
    it('should compile a schema from path', () => {
      schemas['test-schema'] = { type: 'string' }

      const result = toolkit.compile({ path: 'test-schema' })
      assert.equal(result.id, 'test-schema')
      assert.equal(result.valid, true)
      assert.deepEqual(result.errors, [])
      assert.equal(result.recompiled, true)
      assert.ok(result.updateDate)
    })

    it('should return cached layout when schema unchanged', () => {
      schemas['test-schema'] = { type: 'string' }

      const result1 = toolkit.compile({ path: 'test-schema' })
      const updateDate = result1.updateDate

      const result2 = toolkit.compile({ path: 'test-schema' })
      assert.equal(result2.id, 'test-schema')
      assert.equal(result2.recompiled, false)
      assert.equal(result2.updateDate, updateDate)
    })

    it('should throw when path not found and no cache', () => {
      assert.throws(
        () => toolkit.compile({ path: 'nonexistent' }),
        /no compiled layout found for path/
      )
    })
  })

  describe('createState', () => {
    it('should create state from a compiled layout', () => {
      schemas['test-schema'] = {
        type: 'object',
        properties: {
          name: { type: 'string' }
        }
      }

      toolkit.compile({ path: 'test-schema' })
      const result = toolkit.createState({ compiledId: 'test-schema' })

      assert.ok(result.stateId)
      assert.ok(result.state)
      assert.equal(result.state.valid, true)
      assert.ok(result.state.root)
      assert.equal(result.state.root.comp, 'section')
    })

    it('should accept initial data', () => {
      schemas['test-schema'] = {
        type: 'object',
        properties: {
          name: { type: 'string' }
        }
      }

      toolkit.compile({ path: 'test-schema' })
      const result = toolkit.createState({ compiledId: 'test-schema', data: { name: 'Alice' } })

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
      schemas['test-schema'] = {
        type: 'object',
        properties: {
          name: { type: 'string', title: 'Name' },
          email: { type: 'string', title: 'Email' }
        }
      }

      toolkit.compile({ path: 'test-schema' })
      const { stateId } = toolkit.createState({ compiledId: 'test-schema' })
      const result = toolkit.describeState({ stateId })

      assert.equal(result.valid, true)
      assert.ok('root' in result.state)
      const tree = result.state as import('../src/types.ts').ProjectedStateTree
      assert.ok(tree.root.children)
      assert.equal(tree.root.children.length, 2)
    })

    it('should describe a subtree by path', () => {
      schemas['test-schema'] = {
        type: 'object',
        properties: {
          name: { type: 'string', title: 'Name' }
        }
      }

      toolkit.compile({ path: 'test-schema' })
      const { stateId } = toolkit.createState({ compiledId: 'test-schema' })
      const result = toolkit.describeState({ stateId, path: '/name' })

      assert.ok(!('root' in result.state))
      assert.equal(result.state.comp, 'text-field')
      assert.equal(result.state.key, 'name')
    })

    it('should throw for unknown path', () => {
      schemas['test-schema'] = { type: 'object', properties: { name: { type: 'string' } } }
      toolkit.compile({ path: 'test-schema' })
      const { stateId } = toolkit.createState({ compiledId: 'test-schema' })

      assert.throws(
        () => toolkit.describeState({ stateId, path: '/nonexistent' }),
        /node not found/
      )
    })
  })

  describe('setData', () => {
    it('should set data and return updated state', () => {
      schemas['test-schema'] = {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' }
        }
      }

      toolkit.compile({ path: 'test-schema' })
      const { stateId } = toolkit.createState({ compiledId: 'test-schema' })

      const result = toolkit.setData({ stateId, data: { name: 'Bob' } })
      assert.equal(result.valid, true)
      assert.deepEqual(result.state.root.data, { name: 'Bob' })
    })

    it('should report validation errors', () => {
      schemas['test-schema'] = {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1 }
        }
      }

      toolkit.compile({ path: 'test-schema' })
      const { stateId } = toolkit.createState({ compiledId: 'test-schema' })

      const result = toolkit.setData({ stateId, data: { name: '' } })
      assert.equal(result.valid, false)
      assert.ok(result.errors.length > 0)
    })
  })

  describe('setFieldValue', () => {
    it('should set a specific field value', () => {
      schemas['test-schema'] = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'integer' }
        }
      }

      toolkit.compile({ path: 'test-schema' })
      const { stateId } = toolkit.createState({ compiledId: 'test-schema', data: { name: '', age: 0 } })

      const result = toolkit.setFieldValue({ stateId, path: '/name', value: 'Charlie' })
      assert.deepEqual(result.state.root.data, { name: 'Charlie', age: 0 })
    })
  })

  describe('validateState', () => {
    it('should trigger full validation', () => {
      schemas['test-schema'] = {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1 }
        }
      }

      toolkit.compile({ path: 'test-schema' })
      const { stateId } = toolkit.createState({ compiledId: 'test-schema', data: {} })

      const result = toolkit.validateState({ stateId })
      assert.equal(result.valid, false)
      assert.ok(result.errors.length > 0)
      assert.ok(result.data !== undefined)
    })
  })

  describe('destroyById', () => {
    it('should destroy a compiled layout by id', () => {
      schemas['test-schema'] = { type: 'string' }
      toolkit.compile({ path: 'test-schema' })

      const result = toolkit.destroyById({ compiledId: 'test-schema' })
      assert.equal(result.deletedCompiled, true)
      assert.equal(result.deletedState, false)

      assert.throws(
        () => toolkit.createState({ compiledId: 'test-schema' }),
        /compiled layout not found/
      )
    })

    it('should destroy a stateful layout by id', () => {
      schemas['test-schema'] = { type: 'object', properties: { name: { type: 'string' } } }
      toolkit.compile({ path: 'test-schema' })
      const { stateId } = toolkit.createState({ compiledId: 'test-schema' })

      const result = toolkit.destroyById({ stateId })
      assert.equal(result.deletedCompiled, false)
      assert.equal(result.deletedState, true)

      assert.throws(
        () => toolkit.describeState({ stateId }),
        /stateful layout not found/
      )
    })

    it('should destroy both compiled and state at once', () => {
      schemas['test-schema'] = { type: 'object', properties: { name: { type: 'string' } } }
      toolkit.compile({ path: 'test-schema' })
      const { stateId } = toolkit.createState({ compiledId: 'test-schema' })

      const result = toolkit.destroyById({ compiledId: 'test-schema', stateId })
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
      schemas['test-schema'] = {
        type: 'object',
        properties: {
          name: { type: 'string' }
        }
      }

      toolkit.compile({ path: 'test-schema' })
      const { stateId } = toolkit.createState({ compiledId: 'test-schema', data: { name: 'test' } })

      const result = toolkit.getData({ stateId })
      assert.deepEqual(result.data, { name: 'test' })
      assert.equal(result.valid, true)
    })
  })

  describe('constraints projection', () => {
    it('should expose min/max/step on number fields', () => {
      schemas['test-schema'] = {
        type: 'object',
        properties: {
          num: { type: 'number', minimum: 0, maximum: 100, title: 'A number' }
        }
      }

      toolkit.compile({ path: 'test-schema' })
      const { stateId } = toolkit.createState({ compiledId: 'test-schema' })
      const result = toolkit.describeState({ stateId })
      const tree = result.state as import('../src/types.ts').ProjectedStateTree
      const numNode = tree.root.children![0]
      assert.equal(numNode.comp, 'number-field')
      assert.ok(numNode.constraints)
      assert.equal(numNode.constraints.min, 0)
      assert.equal(numNode.constraints.max, 100)
    })

    it('should expose min/max on slider', () => {
      schemas['test-schema'] = {
        type: 'object',
        properties: {
          slider: { type: 'integer', minimum: 0, maximum: 50, layout: 'slider' }
        }
      }

      toolkit.compile({ path: 'test-schema' })
      const { stateId } = toolkit.createState({ compiledId: 'test-schema' })
      const result = toolkit.describeState({ stateId })
      const tree = result.state as import('../src/types.ts').ProjectedStateTree
      const sliderNode = tree.root.children![0]
      assert.equal(sliderNode.comp, 'slider')
      assert.ok(sliderNode.constraints)
      assert.equal(sliderNode.constraints.min, 0)
      assert.equal(sliderNode.constraints.max, 50)
    })

    it('should expose format on date-picker', () => {
      schemas['test-schema'] = {
        type: 'object',
        properties: {
          d: { type: 'string', format: 'date-time', layout: 'date-picker' }
        }
      }

      toolkit.compile({ path: 'test-schema' })
      const { stateId } = toolkit.createState({ compiledId: 'test-schema' })
      const result = toolkit.describeState({ stateId })
      const tree = result.state as import('../src/types.ts').ProjectedStateTree
      const dateNode = tree.root.children![0]
      assert.equal(dateNode.comp, 'date-picker')
      assert.ok(dateNode.constraints)
      assert.equal(dateNode.constraints.format, 'date-time')
    })

    it('should expose separator on combobox', () => {
      schemas['test-schema'] = {
        type: 'object',
        properties: {
          s: { type: 'string', layout: { separator: ',' } }
        }
      }

      toolkit.compile({ path: 'test-schema' })
      const { stateId } = toolkit.createState({ compiledId: 'test-schema' })
      const result = toolkit.describeState({ stateId })
      const tree = result.state as import('../src/types.ts').ProjectedStateTree
      const comboNode = tree.root.children![0]
      assert.equal(comboNode.comp, 'combobox')
      assert.ok(comboNode.constraints)
      assert.equal(comboNode.constraints.separator, ',')
    })

    it('should not include constraints when none apply', () => {
      schemas['test-schema'] = {
        type: 'object',
        properties: {
          name: { type: 'string' }
        }
      }

      toolkit.compile({ path: 'test-schema' })
      const { stateId } = toolkit.createState({ compiledId: 'test-schema' })
      const result = toolkit.describeState({ stateId })
      const tree = result.state as import('../src/types.ts').ProjectedStateTree
      const nameNode = tree.root.children![0]
      assert.equal(nameNode.comp, 'text-field')
      assert.equal(nameNode.constraints, undefined)
    })
  })

  describe('oneOf variants', () => {
    it('should expose oneOfItems in the projected state', () => {
      schemas['test-schema'] = {
        type: 'object',
        oneOf: [
          { title: 'Option A', properties: { key: { const: 'a' }, str1: { type: 'string' } } },
          { title: 'Option B', properties: { key: { const: 'b' }, str2: { type: 'string' } } }
        ]
      }

      toolkit.compile({ path: 'test-schema' })
      const { stateId } = toolkit.createState({ compiledId: 'test-schema' })
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
      schemas['test-schema'] = {
        type: 'object',
        oneOf: [
          { title: 'Variant 1', properties: { key: { const: 'v1' } } },
          { title: 'Variant 2', properties: { key: { const: 'v2' } } },
          { title: 'Variant 3', properties: { key: { const: 'v3' } } }
        ]
      }

      toolkit.compile({ path: 'test-schema' })
      const { stateId } = toolkit.createState({ compiledId: 'test-schema' })
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
      schemas['test-schema'] = {
        type: 'object',
        properties: {
          tags: { type: 'array', items: { type: 'string' } }
        }
      }

      toolkit.compile({ path: 'test-schema' })
      const { stateId } = toolkit.createState({ compiledId: 'test-schema' })
      toolkit.setData({ stateId, data: { tags: 'single' } })
      const result = toolkit.getData({ stateId })
      assert.deepEqual(result.data, { tags: ['single'] })
      assert.ok(result.valid)
    })

    it('should coerce a string to a number', () => {
      schemas['test-schema'] = {
        type: 'object',
        properties: {
          age: { type: 'integer' }
        }
      }

      toolkit.compile({ path: 'test-schema' })
      const { stateId } = toolkit.createState({ compiledId: 'test-schema' })
      toolkit.setData({ stateId, data: { age: '42' } })
      const result = toolkit.getData({ stateId })
      assert.deepEqual(result.data, { age: 42 })
      assert.ok(result.valid)
    })
  })
})
