/**
 * @file TTL store for form sessions.
 */

/**
 * @typedef {object} SessionStoreOptions
 * @property {number} [ttlMs] - sliding lifetime of an entry (default 30 minutes)
 * @property {() => number} [now] - clock, injectable for tests
 * @property {(key: string, value: unknown) => void} [onEvict] - called for an entry
 *   dropped by expiry, not by an explicit delete
 */

/**
 * @typedef {object} SessionStoreEntry
 * @property {unknown} value - the stored value
 * @property {number} expiresAt - epoch milliseconds after which the entry is stale
 */

/**
 * A map with a sliding TTL, keyed by whatever the consumer uses to name a form edit
 * (typically `${userId}:${resourcePath}:${recordId}`). Eviction is safe by design:
 * the next `getOrCreate` re-runs the factory, which for a form session means a reload
 * from the consumer's source.
 * @template T
 */
export class SessionStore {
  /** @type {Map<string, SessionStoreEntry>} */
  _entries = new Map()

  /** @type {Map<string, Promise<T>>} */
  _pending = new Map()

  /** @type {number} */
  _ttlMs

  /** @type {() => number} */
  _now

  /** @type {((key: string, value: unknown) => void) | undefined} */
  _onEvict

  /**
   * @param {SessionStoreOptions} [options]
   */
  constructor (options = {}) {
    this._ttlMs = options.ttlMs ?? 30 * 60 * 1000
    this._now = options.now ?? Date.now
    this._onEvict = options.onEvict
  }

  /**
   * @param {string} key
   * @returns {T | undefined}
   */
  get (key) {
    const entry = this._entries.get(key)
    if (!entry) return undefined
    if (this._expired(entry)) {
      this._evict(key, entry)
      return undefined
    }
    entry.expiresAt = this._now() + this._ttlMs
    return /** @type {T} */(entry.value)
  }

  /**
   * @param {string} key
   * @param {T} value
   * @returns {T}
   */
  set (key, value) {
    this._entries.set(key, { value, expiresAt: this._now() + this._ttlMs })
    return value
  }

  /**
   * Return the stored value, or run the factory once to create it. Concurrent calls
   * for the same key share one factory run, so two tool calls arriving together cannot
   * race a load.
   * @param {string} key
   * @param {() => T | Promise<T>} factory
   * @returns {Promise<T>}
   */
  async getOrCreate (key, factory) {
    const existing = this.get(key)
    if (existing !== undefined) return existing
    const pending = this._pending.get(key)
    if (pending) return pending
    const created = Promise.resolve()
      .then(factory)
      .then((value) => {
        this.set(key, value)
        return value
      })
      .finally(() => {
        this._pending.delete(key)
      })
    this._pending.set(key, created)
    return created
  }

  /**
   * @param {string} key
   * @returns {boolean}
   */
  delete (key) {
    return this._entries.delete(key)
  }

  clear () {
    this._entries.clear()
  }

  /**
   * Drop every expired entry. Accessing an entry already evicts it lazily; this is for
   * consumers that want expired sessions released without waiting for the next access.
   * @returns {number} how many were dropped
   */
  sweep () {
    let dropped = 0
    for (const [key, entry] of this._entries) {
      if (this._expired(entry)) {
        this._evict(key, entry)
        dropped += 1
      }
    }
    return dropped
  }

  /** @returns {number} */
  get size () {
    return this._entries.size
  }

  /**
   * @param {SessionStoreEntry} entry
   * @returns {boolean}
   */
  _expired (entry) {
    return this._now() > entry.expiresAt
  }

  /**
   * @param {string} key
   * @param {SessionStoreEntry} entry
   */
  _evict (key, entry) {
    this._entries.delete(key)
    this._onEvict?.(key, entry.value)
  }
}

/**
 * @template T
 * @param {SessionStoreOptions} [options]
 * @returns {SessionStore<T>}
 */
export function createSessionStore (options) {
  return new SessionStore(options)
}
