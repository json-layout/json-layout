import { randomUUID } from 'node:crypto'
import type { CompiledLayout } from '@json-layout/core'
import type { StatefulLayout } from '@json-layout/core/state'
import type { Store, StoreEntry } from './types.ts'

interface CompiledByPathEntry {
  layout: CompiledLayout
  updateDate: number
  expiresAt: number
}

export function createStore (ttlMs: number = 30 * 60 * 1000): Store {
  const compiledLayouts = new Map<string, StoreEntry<CompiledLayout>>()
  const compiledByPath = new Map<string, CompiledByPathEntry>()
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

  function getByPath (path: string): CompiledByPathEntry | undefined {
    const entry = compiledByPath.get(path)
    if (!entry) return undefined
    if (Date.now() > entry.expiresAt) {
      compiledByPath.delete(path)
      return undefined
    }
    entry.expiresAt = Date.now() + ttlMs
    return entry
  }

  function setByPath (path: string, layout: CompiledLayout, updateDate: number): void {
    compiledByPath.set(path, { layout, updateDate, expiresAt: Date.now() + ttlMs })
  }

  return {
    generateId,
    setCompiled: (id, v) => set(compiledLayouts, id, v),
    getCompiled: (id) => {
      const fromMap = get(compiledLayouts, id)
      if (fromMap) return fromMap
      const fromPath = getByPath(id)
      return fromPath?.layout
    },
    setCompiledByPath: (path, layout, updateDate) => setByPath(path, layout, updateDate),
    getCompiledByPath: (path) => {
      const entry = getByPath(path)
      return entry ? { layout: entry.layout, updateDate: entry.updateDate } : undefined
    },
    setState: (id, v) => set(statefulLayouts, id, v),
    getState: (id) => get(statefulLayouts, id),
    deleteCompiled: (id) => {
      compiledLayouts.delete(id)
      return compiledByPath.delete(id)
    },
    deleteState: (id) => del(statefulLayouts, id),
    clear: () => { compiledLayouts.clear(); compiledByPath.clear(); statefulLayouts.clear() }
  }
}

export const store = createStore()
