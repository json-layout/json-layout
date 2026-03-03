import { randomUUID } from 'node:crypto'
import type { CompiledLayout } from '@json-layout/core'
import type { StatefulLayout } from '@json-layout/core/state'
import type { Store, StoreEntry } from './types.ts'

export function createStore (ttlMs: number = 30 * 60 * 1000): Store {
  const compiledLayouts = new Map<string, StoreEntry<CompiledLayout>>()
  const statefulLayouts = new Map<string, StoreEntry<StatefulLayout>>()

  function generateId (): string {
    return randomUUID()
  }

  function set<T> (map: Map<string, StoreEntry<T>>, id: string, value: T): void {
    map.set(id, { value, expiresAt: Date.now() + ttlMs })
  }

  function get<T> (map: Map<string, StoreEntry<T>>, id: string): T | undefined {
    const entry = map.get(id)
    if (!entry) return undefined
    if (Date.now() > entry.expiresAt) {
      map.delete(id)
      return undefined
    }
    // touch on access
    entry.expiresAt = Date.now() + ttlMs
    return entry.value
  }

  function del<T> (map: Map<string, StoreEntry<T>>, id: string): boolean {
    return map.delete(id)
  }

  return {
    generateId,
    setCompiled: (id, v) => set(compiledLayouts, id, v),
    getCompiled: (id) => get(compiledLayouts, id),
    setState: (id, v) => set(statefulLayouts, id, v),
    getState: (id) => get(statefulLayouts, id),
    deleteCompiled: (id) => del(compiledLayouts, id),
    deleteState: (id) => del(statefulLayouts, id),
    clear: () => { compiledLayouts.clear(); statefulLayouts.clear() }
  }
}
