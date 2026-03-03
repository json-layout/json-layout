import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { createAgentToolkit } from '../src/index.ts'

describe('agent flow: simple form filling', () => {
  it('should complete a full compile -> create -> fill -> validate flow', () => {
    const toolkit = createAgentToolkit()

    // Step 1: compile schema
    const compiled = toolkit.compile({
      schema: {
        type: 'object',
        required: ['firstName', 'lastName', 'email'],
        properties: {
          firstName: { type: 'string', title: 'First Name', minLength: 1 },
          lastName: { type: 'string', title: 'Last Name', minLength: 1 },
          email: { type: 'string', title: 'Email', format: 'email' },
          age: { type: 'integer', title: 'Age', minimum: 0, maximum: 150 }
        }
      }
    })
    assert.equal(compiled.valid, true)

    // Step 2: create state
    const { stateId, state } = toolkit.createState({ compiledId: compiled.id })
    assert.ok(stateId)
    assert.equal(state.root.comp, 'section')
    assert.ok(state.root.children)
    assert.equal(state.root.children.length, 4)

    // Step 3: describe — agent sees the fields
    const desc = toolkit.describeState({ stateId })
    assert.ok(!desc.valid || desc.errors.length === 0)

    // Step 4: bulk set data — agent's first attempt
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

    // Step 5: validate and extract
    const validation = toolkit.validateState({ stateId })
    assert.equal(validation.valid, true)
    assert.deepEqual(validation.data, {
      firstName: 'Alice',
      lastName: 'Smith',
      email: 'alice@example.com',
      age: 30
    })

    // Step 6: get final data
    const final = toolkit.getData({ stateId })
    assert.equal(final.valid, true)
    assert.deepEqual(final.data, validation.data)

    toolkit.destroy()
  })

  it('should handle validation errors and iterative fixing', () => {
    const toolkit = createAgentToolkit()

    const compiled = toolkit.compile({
      schema: {
        type: 'object',
        required: ['name', 'count'],
        properties: {
          name: { type: 'string', minLength: 2 },
          count: { type: 'integer', minimum: 1, maximum: 100 }
        }
      }
    })

    const { stateId } = toolkit.createState({ compiledId: compiled.id })

    // First attempt — invalid data
    const attempt1 = toolkit.setData({
      stateId,
      data: { name: 'A', count: 0 }
    })
    assert.equal(attempt1.valid, false)
    assert.ok(attempt1.errors.length >= 2) // both fields invalid

    // Agent fixes the data
    const attempt2 = toolkit.setData({
      stateId,
      data: { name: 'Alice', count: 42 }
    })
    assert.equal(attempt2.valid, true)
    assert.deepEqual(attempt2.errors, [])

    toolkit.destroy()
  })

  it('should support field-by-field updates', () => {
    const toolkit = createAgentToolkit()

    const compiled = toolkit.compile({
      schema: {
        type: 'object',
        properties: {
          a: { type: 'string' },
          b: { type: 'string' },
          c: { type: 'string' }
        }
      }
    })

    const { stateId } = toolkit.createState({ compiledId: compiled.id, data: {} })

    toolkit.setFieldValue({ stateId, path: '/a', value: 'hello' })
    toolkit.setFieldValue({ stateId, path: '/b', value: 'world' })
    toolkit.setFieldValue({ stateId, path: '/c', value: '!' })

    const result = toolkit.getData({ stateId })
    assert.deepEqual(result.data, { a: 'hello', b: 'world', c: '!' })

    toolkit.destroy()
  })
})

describe('agent flow: conditional schema (oneOf)', () => {
  it('should handle oneOf selection and data filling', () => {
    const toolkit = createAgentToolkit()

    const compiled = toolkit.compile({
      schema: {
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
    })
    assert.equal(compiled.valid, true)

    const { stateId, state } = toolkit.createState({ compiledId: compiled.id })
    assert.ok(state)

    // Set data matching the second oneOf branch (Company)
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

    toolkit.destroy()
  })
})

describe('agent flow: nested objects', () => {
  it('should handle nested object schemas', () => {
    const toolkit = createAgentToolkit()

    const compiled = toolkit.compile({
      schema: {
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
    })

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

    // Navigate to a nested node
    const desc = toolkit.describeState({ stateId, path: '/person/address' })
    assert.ok(!('root' in desc.state))
    assert.equal(desc.state.comp, 'section')
    assert.ok(desc.state.children)
    assert.equal(desc.state.children.length, 2)

    toolkit.destroy()
  })
})
