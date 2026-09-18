import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'

import { FormSession } from '../src/index.js'

const simpleSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', title: 'Name' },
    age: { type: 'integer', title: 'Age' }
  },
  required: ['name']
}

/**
 * @param {Partial<import('../src/session.js').SessionSpec>} [overrides]
 * @returns {FormSession}
 */
function makeSession (overrides = {}) {
  return new FormSession({
    title: 'contact',
    schema: async () => simpleSchema,
    load: async () => ({ name: 'Alice', age: 30 }),
    ...overrides
  })
}

/**
 * @param {FormSession} session
 * @param {string} name
 * @param {any} [args]
 * @returns {Promise<any>}
 */
async function call (session, name, args) {
  const tool = session.getTools().find((t) => t.name === name)
  assert.ok(tool, `tool ${name} exists`)
  return tool.execute(args)
}

/**
 * @param {any} result
 * @returns {string}
 */
function textOf (result) {
  return (result.content ?? []).map((/** @type {any} */ part) => part.text).join('')
}

describe('FormSession lifecycle', () => {
  it('should load once and expose the document', async () => {
    let loads = 0
    const session = makeSession({
      load: async () => { loads += 1; return { name: 'Alice', age: 30 } }
    })

    assert.equal(session.status, 'closed')
    await session.open()
    await session.open()

    assert.equal(loads, 1)
    assert.equal(session.status, 'ready')
    assert.equal(session.isOpen, true)
    assert.deepEqual(session.data, { name: 'Alice', age: 30 })
    assert.equal(session.valid, true)
  })

  it('should dedupe concurrent opens', async () => {
    let loads = 0
    let resolveLoad = () => {}
    let loadStarted = () => {}
    const started = new Promise((resolve) => { loadStarted = resolve })
    const session = makeSession({
      load: () => {
        loads += 1
        loadStarted()
        return new Promise((resolve) => { resolveLoad = resolve })
      }
    })

    const first = session.open()
    const second = session.open()
    await started
    assert.equal(loads, 1)
    resolveLoad({ name: 'Alice' })
    await Promise.all([first, second])
    assert.equal(session.status, 'ready')
  })

  it('should mark the status errored when the load fails', async () => {
    const session = makeSession({ load: async () => { throw new Error('offline') } })
    await assert.rejects(session.open(), /offline/)
    assert.equal(session.status, 'error')
    assert.equal(session.isOpen, false)
  })

  it('should reload and discard local changes', async () => {
    let loads = 0
    const session = makeSession({
      load: async () => { loads += 1; return { name: loads === 1 ? 'Alice' : 'Server', age: 30 } }
    })
    await session.open()
    await call(session, 'setFieldValue', { path: '/name', value: 'Local' })
    assert.equal(session.modified, true)

    await session.reload()
    assert.equal(loads, 2)
    assert.deepEqual(session.data, { name: 'Server', age: 30 })
    assert.equal(session.modified, false)
    assert.equal(session.status, 'ready')
  })

  it('should close and open again from the source', async () => {
    let loads = 0
    const session = makeSession({ load: async () => { loads += 1; return { name: 'Alice' } } })
    await session.open()
    session.close()
    assert.equal(session.status, 'closed')
    assert.equal(session.isOpen, false)
    await session.open()
    assert.equal(loads, 2)
  })

  it('should treat a bare document carrying a data key as the document', async () => {
    const session = makeSession({ load: async () => ({ data: { nested: true } }) })
    await session.open()
    assert.deepEqual(session.data, { data: { nested: true } })
  })
})

describe('FormSession tools', () => {
  it('should expose the core tools plus save and reload', async () => {
    const session = makeSession()
    await session.open()
    assert.deepEqual(session.getTools().map((t) => t.name), [
      'getData',
      'setData',
      'describeState',
      'setFieldValue',
      'getFieldSuggestions',
      'editArray',
      'saveForm',
      'reloadForm'
    ])
  })

  it('should prefix every tool name', async () => {
    const session = makeSession({ prefixName: 'contact_' })
    await session.open()
    const names = session.getTools().map((t) => t.name)
    assert.ok(names.includes('contact_describeState'))
    assert.ok(names.includes('contact_saveForm'))
    assert.ok(names.includes('contact_reloadForm'))
  })

  it('should mark edited fields modified and clear them after a save', async () => {
    const session = makeSession({ save: async () => ({}) })
    await session.open()

    await call(session, 'setFieldValue', { path: '/name', value: 'Bob' })
    const before = textOf(await call(session, 'describeState', {})).split('\n')
    assert.match(before.find((l) => l.includes('/name ')) ?? '', /modified/)
    assert.ok(!/modified/.test(before.find((l) => l.includes('/age ')) ?? ''))
    assert.equal(session.modified, true)

    await session.save()
    assert.equal(session.modified, false)
    const after = textOf(await call(session, 'describeState', {}))
    assert.ok(!/modified/.test(after))
  })
})

describe('FormSession save', () => {
  it('should pass the document, version and base, and adopt the returned version', async () => {
    /** @type {any} */
    let received
    const session = makeSession({
      load: async () => ({ data: { name: 'Alice', age: 30 }, version: 1 }),
      save: async (data, context) => { received = { data, context }; return { version: 2 } }
    })
    await session.open()
    await call(session, 'setFieldValue', { path: '/age', value: 31 })

    const text = textOf(await call(session, 'saveForm', {}))
    assert.match(text, /Saved "contact" \(version 2\)/)
    assert.deepEqual(received.data, { name: 'Alice', age: 31 })
    assert.equal(received.context.version, 1)
    assert.deepEqual(received.context.base, { name: 'Alice', age: 30 })
    assert.equal(session.version, 2)
    assert.equal(session.status, 'ready')
  })

  it('should refuse to save an invalid document unless allowed', async () => {
    const session = makeSession({
      load: async () => ({}),
      save: async () => ({})
    })
    await session.open()
    assert.equal(session.valid, false)

    await assert.rejects(session.save(), (err) => /** @type {any} */(err).code === 'invalid')
    const refused = await call(session, 'saveForm', {})
    assert.equal(refused.isError, true)
    assert.match(textOf(refused), /not valid/)

    await session.save({ allowInvalid: true })
    assert.equal(session.status, 'ready')
  })

  it('should mark a conflict stale and recover on reload', async () => {
    let loads = 0
    const conflict = Object.assign(new Error('precondition failed'), { status: 409 })
    const session = makeSession({
      load: async () => {
        loads += 1
        return { data: { name: loads === 1 ? 'Alice' : 'Server' }, version: loads }
      },
      save: async () => { throw conflict }
    })
    await session.open()

    const result = await call(session, 'saveForm', {})
    assert.equal(result.isError, true)
    assert.match(textOf(result), /reload/i)
    assert.equal(session.status, 'stale')

    await call(session, 'reloadForm', {})
    assert.equal(session.status, 'ready')
    assert.deepEqual(session.data, { name: 'Server' })
  })

  it('should mark other save failures errored', async () => {
    const session = makeSession({ save: async () => { throw new Error('server exploded') } })
    await session.open()
    await assert.rejects(session.save(), /server exploded/)
    assert.equal(session.status, 'error')
  })

  it('should report a read-only session', async () => {
    const session = makeSession()
    await session.open()
    await assert.rejects(session.save(), (err) => /** @type {any} */(err).code === 'readonly')

    const result = await call(session, 'saveForm', {})
    assert.equal(result.isError, true)
    assert.match(textOf(result), /read-only/)
  })

  it('should require an open session', async () => {
    const session = makeSession()
    assert.throws(() => session.getTools(), (err) => /** @type {any} */(err).code === 'closed')
    await assert.rejects(session.save(), (err) => /** @type {any} */(err).code === 'closed')
  })

  it('should compile a versioned schema envelope', async () => {
    const session = makeSession({ schema: async () => ({ schema: simpleSchema, version: 'v1' }) })
    await session.open()
    assert.deepEqual(session.data, { name: 'Alice', age: 30 })
  })
})
