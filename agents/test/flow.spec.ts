import { describe, it, beforeEach } from 'node:test'
import { strict as assert } from 'node:assert'
import { createAgentToolkit, type AgentToolkit } from '../src/index.ts'
import type { GetSchemaContext } from '../src/types.ts'

function createMockGetSchema (schemas: Record<string, Record<string, unknown>>): GetSchemaContext {
  return (path: string, updateDate?: number) => {
    const schema = schemas[path]
    if (!schema) return null

    const currentUpdateDate = Date.now()
    if (updateDate !== undefined && updateDate === currentUpdateDate) {
      return null
    }

    return { schema, updateDate: currentUpdateDate }
  }
}

describe('agent flow: simple form filling', () => {
  let toolkit: AgentToolkit
  let getSchema: GetSchemaContext
  const schemas: Record<string, Record<string, unknown>> = {}

  beforeEach(() => {
    getSchema = createMockGetSchema(schemas)
    toolkit = createAgentToolkit({ getSchema })
    Object.keys(schemas).forEach(key => delete schemas[key])
  })

  it('should complete a full compile -> create -> fill -> validate flow', () => {
    schemas['test-schema'] = {
      type: 'object',
      required: ['firstName', 'lastName', 'email'],
      properties: {
        firstName: { type: 'string', title: 'First Name', minLength: 1 },
        lastName: { type: 'string', title: 'Last Name', minLength: 1 },
        email: { type: 'string', title: 'Email', format: 'email' },
        age: { type: 'integer', title: 'Age', minimum: 0, maximum: 150 }
      }
    }

    const compiled = toolkit.compile({ path: 'test-schema' })
    assert.equal(compiled.valid, true)

    const { stateId, state } = toolkit.createState({ compiledId: compiled.id })
    assert.ok(stateId)
    assert.equal(state.root.comp, 'section')
    assert.ok(state.root.children)
    assert.equal(state.root.children.length, 4)

    const desc = toolkit.describeState({ stateId })
    assert.ok(!desc.valid || desc.errors.length === 0)

    const attempt = toolkit.setData({
      stateId,
      data: {
        firstName: 'Alice',
        lastName: 'Smith',
        email: 'alice@example.com',
        age: 30
      }
    })
    assert.equal(attempt.valid, true)
    assert.deepEqual(attempt.errors, [])

    const validation = toolkit.validateState({ stateId })
    assert.equal(validation.valid, true)
    assert.deepEqual(validation.data, {
      firstName: 'Alice',
      lastName: 'Smith',
      email: 'alice@example.com',
      age: 30
    })

    const final = toolkit.getData({ stateId })
    assert.equal(final.valid, true)
    assert.deepEqual(final.data, validation.data)
  })

  it('should handle validation errors and iterative fixing', () => {
    schemas['test-schema'] = {
      type: 'object',
      required: ['name', 'count'],
      properties: {
        name: { type: 'string', minLength: 2 },
        count: { type: 'integer', minimum: 1, maximum: 100 }
      }
    }

    const compiled = toolkit.compile({ path: 'test-schema' })
    const { stateId } = toolkit.createState({ compiledId: compiled.id })

    const attempt1 = toolkit.setData({
      stateId,
      data: { name: 'A', count: 0 }
    })
    assert.equal(attempt1.valid, false)
    assert.ok(attempt1.errors.length >= 2)

    const attempt2 = toolkit.setData({
      stateId,
      data: { name: 'Alice', count: 42 }
    })
    assert.equal(attempt2.valid, true)
    assert.deepEqual(attempt2.errors, [])
  })

  it('should support field-by-field updates', () => {
    schemas['test-schema'] = {
      type: 'object',
      properties: {
        a: { type: 'string' },
        b: { type: 'string' },
        c: { type: 'string' }
      }
    }

    const compiled = toolkit.compile({ path: 'test-schema' })
    const { stateId } = toolkit.createState({ compiledId: compiled.id, data: {} })

    toolkit.setFieldValue({ stateId, path: '/a', value: 'hello' })
    toolkit.setFieldValue({ stateId, path: '/b', value: 'world' })
    toolkit.setFieldValue({ stateId, path: '/c', value: '!' })

    const result = toolkit.getData({ stateId })
    assert.deepEqual(result.data, { a: 'hello', b: 'world', c: '!' })
  })
})

describe('agent flow: conditional schema (oneOf)', () => {
  let toolkit: AgentToolkit
  let getSchema: GetSchemaContext
  const schemas: Record<string, Record<string, unknown>> = {}

  beforeEach(() => {
    getSchema = createMockGetSchema(schemas)
    toolkit = createAgentToolkit({ getSchema })
    Object.keys(schemas).forEach(key => delete schemas[key])
  })

  it('should handle oneOf selection and data filling', () => {
    schemas['test-schema'] = {
      type: 'object',
      oneOf: [
        {
          title: 'Person',
          properties: {
            type: { type: 'string', const: 'person' },
            name: { type: 'string' }
          },
          required: ['type', 'name']
        },
        {
          title: 'Company',
          properties: {
            type: { type: 'string', const: 'company' },
            companyName: { type: 'string' },
            employees: { type: 'integer' }
          },
          required: ['type', 'companyName']
        }
      ]
    }

    const compiled = toolkit.compile({ path: 'test-schema' })
    assert.equal(compiled.valid, true)

    const { stateId, state } = toolkit.createState({ compiledId: compiled.id })
    assert.ok(state)

    const result = toolkit.setData({
      stateId,
      data: {
        type: 'company',
        companyName: 'Acme Corp',
        employees: 50
      }
    })
    assert.equal(result.valid, true)

    const final = toolkit.getData({ stateId })
    assert.deepEqual(final.data, {
      type: 'company',
      companyName: 'Acme Corp',
      employees: 50
    })
  })
})

describe('agent flow: nested objects', () => {
  let toolkit: AgentToolkit
  let getSchema: GetSchemaContext
  const schemas: Record<string, Record<string, unknown>> = {}

  beforeEach(() => {
    getSchema = createMockGetSchema(schemas)
    toolkit = createAgentToolkit({ getSchema })
    Object.keys(schemas).forEach(key => delete schemas[key])
  })

  it('should handle nested object schemas', () => {
    schemas['test-schema'] = {
      type: 'object',
      properties: {
        person: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            address: {
              type: 'object',
              properties: {
                street: { type: 'string' },
                city: { type: 'string' }
              }
            }
          }
        }
      }
    }

    const compiled = toolkit.compile({ path: 'test-schema' })
    const { stateId } = toolkit.createState({ compiledId: compiled.id })

    const result = toolkit.setData({
      stateId,
      data: {
        person: {
          name: 'Alice',
          address: {
            street: '123 Main St',
            city: 'Springfield'
          }
        }
      }
    })

    assert.equal(result.valid, true)

    const desc = toolkit.describeState({ stateId, path: '/person/address' })
    assert.ok(!('root' in desc.state))
    assert.equal(desc.state.comp, 'section')
    assert.ok(desc.state.children)
    assert.equal(desc.state.children.length, 2)
  })
})
