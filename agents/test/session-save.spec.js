import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'

import { FormSession, SAVE_MODES } from '../src/index.js'

const lineSchema = {
  type: 'object',
  properties: {
    nom: { type: 'string', title: 'Nom' },
    commune: {
      type: 'string',
      title: 'Commune',
      layout: { getItems: { url: 'http://example.com/communes?q={q}', itemsResults: 'data.results', itemKey: 'item.code', itemTitle: 'item.label' } }
    },
    activites: { type: 'array', items: { type: 'object', properties: { label: { type: 'string' } } } }
  },
  required: ['nom']
}

const fetch = async () => ({ results: [{ code: '44109', label: 'Nantes' }, { code: '44190', label: 'Saint-Sébastien-sur-Loire' }] })

/**
 * @param {Partial<import('../src/session.js').SessionSpec>} [overrides]
 * @returns {{ session: FormSession, saved: unknown[] }}
 */
function makeSession (overrides = {}) {
  /** @type {unknown[]} */
  const saved = []
  let version = 1
  const session = new FormSession({
    title: 'line',
    schema: async () => lineSchema,
    load: async () => ({ data: { nom: 'Dojo' }, version }),
    save: async (data) => { saved.push(data); version += 1; return { version } },
    options: { fetch },
    ...overrides
  })
  return { session, saved }
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

describe('FormSession save modes', () => {
  it('should announce its save modes', () => {
    assert.deepEqual([...SAVE_MODES], ['explicit', 'auto'])
  })

  it('should refuse an unknown save mode', () => {
    assert.throws(() => makeSession({ saveMode: /** @type {any} */('sometimes') }), /save mode/)
  })

  it('should refuse auto-save without a save function', () => {
    assert.throws(() => makeSession({ saveMode: 'auto', save: undefined }), /save function/)
  })
})

describe('FormSession explicit save with a write', () => {
  it('should offer a save option on the write tools only', async () => {
    const { session } = makeSession()
    await session.open()
    for (const tool of session.getTools()) {
      const properties = /** @type {any} */(tool.inputSchema)?.properties ?? {}
      assert.equal('save' in properties, ['setData', 'setFieldValue', 'editArray'].includes(tool.name), tool.name)
    }
    assert.match(session.getSkill(), /save: true/)
  })

  it('should offer no save option on a read-only session', async () => {
    const { session } = makeSession({ save: undefined })
    await session.open()
    for (const tool of session.getTools()) {
      assert.ok(!('save' in (/** @type {any} */(tool.inputSchema)?.properties ?? {})), tool.name)
    }
    assert.doesNotMatch(session.getSkill(), /save: true/)
  })

  it('should not save a write that does not ask for it', async () => {
    // 715eac0: a consumer saving whenever the form was valid destroyed a draft
    const { session, saved } = makeSession()
    await session.open()
    const text = textOf(await call(session, 'setFieldValue', { path: '/nom', value: 'Judo club' }))
    assert.equal(saved.length, 0)
    assert.doesNotMatch(text, /saved/)
  })

  it('should save a valid write that asks for it', async () => {
    const { session, saved } = makeSession()
    await session.open()
    const result = await call(session, 'setFieldValue', { path: '/nom', value: 'Judo club', save: true })
    assert.ok(!result.isError)
    assert.match(textOf(result), /\nsaved, version 2$/)
    assert.deepEqual(saved, [{ nom: 'Judo club' }])
    assert.equal(session.modified, false)

    const added = textOf(await call(session, 'editArray', { path: '/activites', action: 'add', value: { label: 'judo' }, save: true }))
    assert.match(added, /saved, version 3/)
    assert.equal(saved.length, 2)
  })

  it('should not save an invalid write, and say so', async () => {
    const { session, saved } = makeSession()
    await session.open()
    const result = await call(session, 'setData', { data: { commune: '44109' }, merge: false, save: true })
    assert.ok(!result.isError)
    const text = textOf(result)
    assert.match(text, /not saved: the form is invalid/)
    assert.match(text, /\/nom/, 'the errors come with it')
    assert.equal(saved.length, 0)
  })

  it('should hold a save while a list value was not picked, and saveForm saves anyway', async () => {
    const { session, saved } = makeSession()
    await session.open()
    const held = textOf(await call(session, 'setFieldValue', { path: '/commune', value: '44173', save: true }))
    assert.match(held, /not saved: \/commune value "44173" was not picked/)
    assert.match(held, /saveForm saves anyway/)
    assert.equal(saved.length, 0)

    const forced = textOf(await call(session, 'saveForm', {}))
    assert.match(forced, /Saved "line" \(version 2\)/)
    assert.match(forced, /\/commune value "44173" was not picked/)
    assert.equal(saved.length, 1)

    // the warning was given and the value saved: it does not hold every later save
    const later = textOf(await call(session, 'setFieldValue', { path: '/nom', value: 'Judo club', save: true }))
    assert.match(later, /saved, version 3/)
  })

  it('should save a picked list value', async () => {
    const { session, saved } = makeSession()
    await session.open()
    const listed = textOf(await call(session, 'getFieldSuggestions', { path: '/commune', query: 'Sébastien' }))
    const index = Number(listed.match(/\[(\d+)\] Saint-Sébastien/)?.[1])
    const text = textOf(await call(session, 'setFieldValue', { path: '/commune', suggestionIndex: index, save: true }))
    assert.match(text, /saved, version 2/)
    assert.deepEqual(saved, [{ nom: 'Dojo', commune: '44190' }])
  })
})

describe('FormSession auto save', () => {
  it('should have no saveForm and no save option, and say edits are saved as they go', async () => {
    const { session } = makeSession({ saveMode: 'auto' })
    await session.open()
    const tools = session.getTools()
    assert.ok(!tools.some((t) => t.name === 'saveForm'))
    assert.ok(tools.some((t) => t.name === 'reloadForm'))
    for (const tool of tools) {
      assert.ok(!('save' in (/** @type {any} */(tool.inputSchema)?.properties ?? {})), tool.name)
    }
    const skill = session.getSkill()
    assert.match(skill, /saved as/)
    assert.doesNotMatch(skill, /saveForm/)
  })

  it('should save a write that leaves the form valid', async () => {
    const { session, saved } = makeSession({ saveMode: 'auto' })
    await session.open()
    const text = textOf(await call(session, 'setFieldValue', { path: '/nom', value: 'Judo club' }))
    assert.match(text, /\nsaved, version 2$/)
    assert.deepEqual(saved, [{ nom: 'Judo club' }])
  })

  it('should not save a write that leaves the form invalid', async () => {
    const { session, saved } = makeSession({ saveMode: 'auto' })
    await session.open()
    const text = textOf(await call(session, 'setData', { data: { commune: '44109' }, merge: false }))
    assert.match(text, /not saved yet: the form is invalid/)
    assert.equal(saved.length, 0)
  })

  it('should only warn about a list value that was not picked', async () => {
    const { session, saved } = makeSession({ saveMode: 'auto' })
    await session.open()
    const text = textOf(await call(session, 'setFieldValue', { path: '/commune', value: '44173' }))
    assert.match(text, /was not among the suggestions/)
    assert.match(text, /saved, version 2/)
    assert.equal(saved.length, 1)
  })

  it('should coalesce writes landing during a save, the last valid data winning', async () => {
    /** @type {Array<{ data: unknown, resolve: (value: unknown) => void }>} */
    const pending = []
    /** @type {unknown[]} */
    const saved = []
    const { session } = makeSession({
      saveMode: 'auto',
      save: (data) => new Promise((resolve) => { pending.push({ data, resolve }) }).then(() => { saved.push(data) })
    })
    await session.open()
    const first = call(session, 'setFieldValue', { path: '/nom', value: 'A' })
    await waitUntil(() => pending.length === 1, 'the first save')
    /** @returns {any} */
    const queued = () => /** @type {any} */(session)._queuedSave
    const second = call(session, 'setFieldValue', { path: '/nom', value: 'B' })
    await waitUntil(() => queued()?.snapshot?.nom === 'B', 'the second write queued')
    const third = call(session, 'setFieldValue', { path: '/nom', value: 'C' })
    await waitUntil(() => queued()?.snapshot?.nom === 'C', 'the third write queued')
    const invalid = textOf(await call(session, 'setFieldValue', { path: '/nom', value: '' }))
    assert.match(invalid, /not saved yet/)
    // no overlapping save
    assert.equal(pending.length, 1)
    pending[0].resolve(undefined)
    await waitUntil(() => pending.length === 2, 'the queued save')
    assert.deepEqual(pending[1].data, { nom: 'C' })
    pending[1].resolve(undefined)
    const texts = (await Promise.all([first, second, third])).map(textOf)
    for (const text of texts) assert.match(text, /saved/)
    assert.deepEqual(saved, [{ nom: 'A' }, { nom: 'C' }])
  })

  it('should refuse to auto-save a record being created', async () => {
    const { session } = makeSession({ saveMode: 'auto', load: async () => undefined })
    await assert.rejects(session.open(), /auto/)
  })
})

describe('FormSession create', () => {
  it('should start empty again after a successful save', async () => {
    const { session, saved } = makeSession({ load: undefined })
    await session.open()
    assert.deepEqual(session.data ?? {}, {})
    await call(session, 'getFieldSuggestions', { path: '/commune', query: 'Nantes' })
    const text = textOf(await call(session, 'setData', { data: { nom: 'Dojo', commune: '44109' }, save: true }))
    assert.match(text, /saved, version 2; the form is empty again for a new record/)
    assert.deepEqual(saved, [{ nom: 'Dojo', commune: '44109' }])
    assert.deepEqual(session.data ?? {}, {})
    assert.equal(session.modified, false)

    // picks are gone with the record: the next one picks its own commune
    const next = textOf(await call(session, 'setData', { data: { nom: 'Club', commune: '44109' }, save: true }))
    assert.match(next, /not saved: \/commune value "44109" was not picked/)

    const forced = textOf(await call(session, 'saveForm', {}))
    assert.match(forced, /the form is empty again for a new record/i)
    assert.equal(saved.length, 2)
  })

  it('should treat a load that returns no document as a create', async () => {
    const { session } = makeSession({ load: async () => undefined })
    await session.open()
    const text = textOf(await call(session, 'setFieldValue', { path: '/nom', value: 'Dojo', save: true }))
    assert.match(text, /the form is empty again for a new record/)
  })

  it('should keep the document of an edit session after a save', async () => {
    const { session } = makeSession()
    await session.open()
    const text = textOf(await call(session, 'setFieldValue', { path: '/nom', value: 'Judo club', save: true }))
    assert.doesNotMatch(text, /empty again/)
    assert.deepEqual(session.data, { nom: 'Judo club' })
  })
})

/**
 * @param {() => boolean} predicate
 * @param {string} what
 */
async function waitUntil (predicate, what) {
  for (let i = 0; i < 100 && !predicate(); i++) await new Promise((resolve) => setImmediate(resolve))
  assert.ok(predicate(), `waited for ${what}`)
}
