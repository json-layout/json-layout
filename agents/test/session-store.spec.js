import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'

import { SessionStore, createSessionStore } from '../src/index.js'

describe('SessionStore', () => {
  it('should expire entries after the ttl and slide on access', () => {
    let now = 0
    const store = new SessionStore({ ttlMs: 100, now: () => now })
    store.set('a', { id: 'a' })

    now = 50
    assert.deepEqual(store.get('a'), { id: 'a' })
    now = 140
    assert.deepEqual(store.get('a'), { id: 'a' })
    now = 241
    assert.equal(store.get('a'), undefined)
  })

  it('should report evicted entries', () => {
    let now = 0
    /** @type {Array<[string, unknown]>} */
    const evicted = []
    const store = new SessionStore({
      ttlMs: 10,
      now: () => now,
      onEvict: (key, value) => evicted.push([key, value])
    })
    store.set('a', 1)
    now = 11
    assert.equal(store.get('a'), undefined)
    assert.deepEqual(evicted, [['a', 1]])
  })

  it('should sweep every expired entry', () => {
    let now = 0
    const store = createSessionStore({ ttlMs: 10, now: () => now })
    store.set('a', 1)
    store.set('b', 2)
    now = 11
    store.set('c', 3)
    assert.equal(store.sweep(), 2)
    assert.equal(store.size, 1)
    assert.equal(store.get('c'), 3)
  })

  it('should share one factory run between concurrent getOrCreate calls', async () => {
    let created = 0
    let release = () => {}
    const gate = new Promise((resolve) => { release = () => resolve(undefined) })
    const store = createSessionStore()
    const factory = async () => { created += 1; await gate; return 42 }

    const first = store.getOrCreate('x', factory)
    const second = store.getOrCreate('x', factory)
    release()
    assert.equal(await first, 42)
    assert.equal(await second, 42)
    assert.equal(created, 1)
  })

  it('should let a failed factory be retried', async () => {
    const store = createSessionStore()
    await assert.rejects(store.getOrCreate('x', async () => { throw new Error('boom') }), /boom/)
    assert.equal(await store.getOrCreate('x', async () => 1), 1)
  })

  it('should delete and clear entries', () => {
    const store = createSessionStore()
    store.set('a', 1)
    assert.equal(store.delete('a'), true)
    assert.equal(store.delete('a'), false)
    store.set('a', 1)
    store.set('b', 2)
    store.clear()
    assert.equal(store.size, 0)
  })
})
