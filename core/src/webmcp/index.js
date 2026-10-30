/**
 * @file WebMCP integration for JSON Layout StatefulLayout
 * @description Provides MCP tool descriptors that work with browser's navigator.modelContext
 */

import debug from 'debug'

import * as describeState from './tools/describe-state.js'
import * as openSection from './tools/open-section.js'
import * as setFieldValue from './tools/set-field-value.js'
import * as setData from './tools/set-data.js'
import * as getData from './tools/get-data.js'
import * as getFieldSuggestions from './tools/get-field-suggestions.js'
import * as editArray from './tools/edit-array.js'
import * as fillFormSkill from './tools/fill-form-skill.js'
import equal from 'fast-deep-equal'

import { formatMutationResult } from './errors.js'
import { formatSuggestions, projectSuggestions, abbreviateValue, formatVisibilityDiff, suggestionsBlocked, suggestionsSource } from './project.js'
import { suggestionsMatchQuery } from './query.js'
import { resolveNode } from './resolve.js'
import { coerceForNode } from './coerce.js'
import { resolveNodeSchema } from './schema.js'
import { SuggestionsStore } from './suggestions-store.js'
import { VariantsMemo } from './variants-memo.js'
import { reshapesFromOtherData } from '../state/index.js'

// public: a host that serves the form tools elsewhere (an MCP server's editor groups) needs
// the same guide text a page publishes as its skill
export const generateSkill = fillFormSkill.generateSkill

/**
 * Open the sections that contain what a tool just wrote, so that the person sees it, and say
 * so: the agent can then tell the person where to look. Only the tools do this, a
 * person's own edit never moves them to another tab.
 * @param {import('../state/index.js').StatefulLayout} statefulLayout
 * @param {string} path
 * @returns {string}
 */
function revealWritten (statefulLayout, path) {
  const node = resolveNode(statefulLayout.stateTree.root, path)
  if (!node) return ''
  if (!statefulLayout.revealNode(node.fullKey).length) return ''
  return `\nnow on screen: ${statefulLayout.sectionTitles(node.fullKey).map(title => `« ${title} »`).join(' > ')}`
}

/** @typedef {import('@mcp-b/webmcp-types').ToolDescriptor} ToolDescriptor */

const log = debug('jl:webmcp')

/**
 * If value is a JSON string representing an object or array, parse it.
 * Otherwise return value unchanged.
 * @param {unknown} value
 * @returns {unknown}
 */
function parseIfJsonString (value) {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  if ((trimmed[0] === '{' && trimmed[trimmed.length - 1] === '}') ||
      (trimmed[0] === '[' && trimmed[trimmed.length - 1] === ']')) {
    try {
      return JSON.parse(trimmed)
    } catch {
      return value
    }
  }
  return value
}

/**
 * The one line telling an agent which of its values were read as another JSON spelling.
 * @param {string[]|undefined} coerced
 * @returns {string}
 */
function coercedLine (coerced) {
  return coerced?.length ? `\ncoerced: ${coerced.join('; ')}` : ''
}

/**
 * @param {string[]} lines
 * @returns {string}
 */
function warningLines (lines) {
  return lines.length ? '\n' + lines.join('\n') : ''
}

/**
 * The fields an editArray answer looks at for unpicked values: inside the list, only the
 * item added (a removal or a move shifts the paths of values already there, which a
 * comparison by path would take for new ones); outside it, any field whose list the edit
 * changed.
 * @param {string|undefined} listPath
 * @param {number|undefined} addedIndex
 * @returns {(fullKey: string) => boolean}
 */
function editArrayEligible (listPath, addedIndex) {
  /**
   * @param {string} fullKey
   * @param {string} prefix
   */
  const under = (fullKey, prefix) => fullKey === prefix || fullKey.startsWith(prefix + '/')
  return (fullKey) => {
    if (listPath === undefined) return false
    if (!under(fullKey, listPath)) return true
    return addedIndex !== undefined && under(fullKey, `${listPath}/${addedIndex}`)
  }
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isEmpty (value) {
  return value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)
}

/**
 * The data with the value at a data path left out: a list's own value is not what its
 * options depend on, or picking one would make the list it came from stale.
 * @param {unknown} data
 * @param {string[]} segments
 * @returns {unknown}
 */
function withoutValueAt (data, segments) {
  if (!segments.length || data === null || typeof data !== 'object') return data
  const [segment, ...rest] = segments
  if (!(segment in data)) return data
  const copy = /** @type {Record<string, unknown>} */(Array.isArray(data) ? [...data] : { ...data })
  // left out, not set to undefined: a deep comparison tells a missing key from an undefined one
  if (!rest.length) {
    // an item keeps its place: removing it would shift the items after it
    if (Array.isArray(copy)) copy[/** @type {any} */(segment)] = null
    else delete copy[segment]
  } else copy[segment] = withoutValueAt(copy[segment], rest)
  return copy
}

/**
 * The fields whose options come from a remote list (getItems with a URL): their values are
 * codes a model may type from memory, and the form cannot tell a real one from an invented
 * one. Not a list whose items are fetched: the form fills it itself.
 * @param {import('../state/types.js').StateNode} root
 * @returns {import('../state/types.js').StateNode[]}
 */
function referentialNodes (root) {
  /** @type {import('../state/types.js').StateNode[]} */
  const found = []
  /** @param {import('../state/types.js').StateNode} node */
  const visit = (node) => {
    if (/** @type {any} */(node.layout).getItems?.url && node.layout.comp !== 'list') found.push(node)
    for (const child of node.children ?? []) visit(child)
  }
  visit(root)
  return found
}

/**
 * The values a data path held in the loaded data, any item of a list standing for the
 * item index: a loaded value stays loaded wherever adding, removing or moving items, or an
 * array passed whole, takes it.
 * @param {unknown} data
 * @param {string} dataPath
 * @returns {unknown[]}
 */
function loadedValuesAt (data, dataPath) {
  let current = [data]
  for (const segment of dataPath.split('/').filter(Boolean)) {
    /** @type {unknown[]} */
    const next = []
    for (const value of current) {
      if (Array.isArray(value) && /^\d+$/.test(segment)) next.push(...value)
      else if (value !== null && typeof value === 'object' && segment in value) next.push(/** @type {Record<string, unknown>} */(value)[segment])
    }
    current = next
  }
  return current
}

/**
 * @typedef {object} WebMCPOptions
 * @property {string} [prefixName] - Prefix for all tool names
 * @property {string} [dataTitle] - Title used in descriptions (default: 'form')
 * @property {boolean} [screen] - The form is on a person's screen (default: true). Without one
 * (a server-side session) there is no open tab to tell, open or reveal, and no openSection tool
 */

/**
 * WebMCP class that provides MCP tool descriptors for a StatefulLayout instance
 */
export class WebMCP {
  /**
   * @readonly
   * @type {import('../state/index.js').StatefulLayout}
   */
  _statefulLayout

  /**
   * @readonly
   * @type {string}
   */
  _prefixName

  /**
   * @readonly
   * @type {string}
   */
  _dataTitle

  /** @private */
  _screen = true

  /**
   * The data counted as loaded, see `resetBaseline`.
   * @private
   * @type {unknown}
   */
  _baseline

  /**
   * @type {string[]}
   */
  _registeredTools = []

  /**
   * The registered skill resource, when the model context has resources.
   * @type {{ unregister: () => void } | null}
   */
  _registeredSkill = null

  /**
   * memory of the last suggestions per node path, used by setFieldValue's suggestionIndex
   * @readonly
   * @type {SuggestionsStore}
   */
  _suggestionsStore = new SuggestionsStore()

  /**
   * Variant lists already sent to the agent. Never cleared on a write: a schema's branches
   * are a constant, so unlike memorized suggestions nothing about the data can invalidate
   * them.
   * @type {VariantsMemo}
   */
  _variantsMemo = new VariantsMemo()

  /**
   * @param {import('../state/index.js').StatefulLayout} statefulLayout
   * @param {WebMCPOptions} [options]
   */
  constructor (statefulLayout, options = {}) {
    this._statefulLayout = statefulLayout
    this._prefixName = options.prefixName || ''
    this._dataTitle = options.dataTitle || 'form'
    this._screen = options.screen ?? true
    this.resetBaseline()
  }

  /**
   * The data the form was loaded with: a value it already held when loaded counts as picked,
   * the agent did not type it. Set when this instance is created; a host that loads other
   * data into the same form (after a save, or to start a new document) calls this again.
   * @param {unknown} [data] - the data now counted as loaded, the form's current data by default
   */
  resetBaseline (data = this._statefulLayout.data) {
    try {
      this._baseline = structuredClone(data)
    } catch {
      this._baseline = data
    }
  }

  /**
   * The values of fields whose options come from a remote list that are neither among the
   * suggestions listed for that field nor the value it was loaded with: most likely typed
   * from memory, so a host can hold a save on them. Only what goes through these tools is
   * tracked: a value a person picks on screen is reported here too, unless the host calls
   * `resetBaseline()` after such an edit — so a hold on it belongs where no person edits the
   * form (a server-side session). Fields not hydrated in the form (the items of a list shown
   * as summaries and never opened) are not looked at.
   * @returns {Array<{path: string, value: unknown}>}
   */
  unpickedValues () {
    /** @type {Array<{path: string, value: unknown}>} */
    const found = []
    for (const node of referentialNodes(this._statefulLayout.stateTree.root)) {
      const value = this._unpicked(node)
      if (value !== undefined) found.push({ path: node.fullKey, value })
    }
    return found
  }

  /**
   * What of a referential node's value was not picked, undefined when all of it was.
   * @param {import('../state/types.js').StateNode} node
   * @returns {unknown}
   */
  _unpicked (node) {
    const data = node.data
    if (isEmpty(data)) return undefined
    // the schema's default is not typed by the agent either
    const defaultData = /** @type {any} */(node.layout).defaultData
    const loaded = [...loadedValuesAt(this._baseline, node.dataPath), ...(defaultData !== undefined ? [defaultData] : [])]
    /** @param {unknown} offered */
    const asWritten = (offered) => coerceForNode(node, offered, resolveNodeSchema(node, this._statefulLayout)).value
    /** @param {unknown} value */
    const picked = (value) => {
      const key = this._itemKeyOf(node, value)
      /** @param {unknown} l */
      const same = (l) => equal(l, value) || (key !== undefined && this._itemKeyOf(node, l) === key)
      return this._suggestionsStore.wasOffered(node.fullKey, this._freshnessKey(node), value, key, asWritten) ||
        loaded.some((l) => same(l) || (Array.isArray(l) && l.some(same)))
    }
    if (picked(data)) return undefined
    if (Array.isArray(data) && /** @type {any} */(node.layout).multiple) {
      const unpicked = data.filter((value) => !isEmpty(value) && !picked(value))
      return unpicked.length ? unpicked : undefined
    }
    return data
  }

  /**
   * The item key of an object value, as the state layer computes it to recognize the
   * selected item: the form stores such a value trimmed to its schema, so it no longer
   * equals the item it was picked from.
   * @param {import('../state/types.js').StateNode} node
   * @param {unknown} value
   * @returns {string|number|undefined}
   */
  _itemKeyOf (node, value) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined
    try {
      const key = this._statefulLayout.prepareSelectItem(node, value).key
      return typeof key === 'string' ? (key === '' || key === String(value) ? undefined : key) : typeof key === 'number' ? key : undefined
    } catch {
      return undefined
    }
  }

  /**
   * The values of fields whose options come from a remote list, and the lists they read,
   * before a write.
   * @returns {Map<string, {data: unknown, cacheKey: unknown}>}
   */
  _referentialData () {
    return new Map(referentialNodes(this._statefulLayout.stateTree.root).map((node) => [node.fullKey, { data: node.data, cacheKey: this._freshnessKey(node) }]))
  }

  /**
   * One line per referential value a write put in the form that was not picked: the form
   * accepts it, a code typed from memory is as valid as the right one (the data-fair agent
   * that wrote commune 44173 for 44190). A field the write left alone is told too when the
   * write changed the list it reads (a commune whose département changed): its value may
   * not be one of the new list's.
   * @param {Map<string, {data: unknown, cacheKey: unknown}>} before - see `_referentialData`
   * @param {(fullKey: string) => boolean} [eligible] - the fields to look at, all by default
   * @returns {string[]}
   */
  _unpickedWarnings (before, eligible) {
    /** @type {string[]} */
    const lines = []
    for (const node of referentialNodes(this._statefulLayout.stateTree.root)) {
      if (eligible && !eligible(node.fullKey)) continue
      const previous = before.get(node.fullKey)
      if (previous && equal(previous.data, node.data) && equal(previous.cacheKey, this._freshnessKey(node))) continue
      const value = this._unpicked(node)
      if (value === undefined) continue
      lines.push(`${node.fullKey}: ${abbreviateValue(value)} was not among the suggestions listed for this field; pick one with ${this._toolName('getFieldSuggestions')}`)
    }
    return lines
  }

  /**
   * What a node's options depend on, to tell whether a write made the suggestions memorized
   * for it, and the values they offered, stale: its itemsCacheKey (the resolved URL, the
   * evaluated items), and for a list reshaped from other fields (catalog-melodi's values of
   * the selected concept, read from one same URL) the items it lists now, reshaped from its
   * download without a request. Without a download to reshape (a list only ever searched
   * by the request's query), the data its expressions can read stands in for them, the
   * node's own value aside: any change of it then counts as one, in the safe direction.
   * @param {import('../state/types.js').StateNode} node
   * @returns {unknown}
   */
  _freshnessKey (node) {
    if (!reshapesFromOtherData(node.layout)) return node.itemsCacheKey
    try {
      const items = this._statefulLayout.cachedItems(node)
      // the key alone does not tell two lists apart: two concepts can share codes, with other ids and labels
      if (items) return { items: node.itemsCacheKey, listed: items.map((item) => [item.key, item.value, item.title]) }
    } catch {
      // an expression that fails on the current data: fall back to the data itself
    }
    return {
      items: node.itemsCacheKey,
      data: withoutValueAt(this._statefulLayout.data, node.dataPath.split('/').filter(Boolean)),
      context: node.options.context
    }
  }

  /**
   * The data each memorized path holds before a write, for `_retainFresh`.
   * @param {string} [under] - only the paths strictly under this node path
   * @returns {Map<string, unknown>}
   */
  _memorizedData (under) {
    const root = this._statefulLayout.stateTree.root
    const paths = this._suggestionsStore.paths().filter((path) => under === undefined || path.startsWith(under + '/'))
    return new Map(paths.map((path) => [path, resolveNode(root, path)?.data]))
  }

  /**
   * Drop the memorized suggestions a write invalidated. A getItems expression can depend on
   * another field, so a write may have changed the options of a field memorized under an
   * unchanged path — but only of a field whose list actually depends on it. Comparing each
   * memorized path's itemsCacheKey against the node's current one is how the state layer
   * itself decides whether to re-fetch. Compared by content: a static list is a distinct
   * array in each item of a list, so a moved item's list never had the identity of the
   * one now at its place, while having the same options.
   * @param {Map<string, unknown>} [dataBefore] - also drop the paths of this map whose data changed
   */
  _retainFresh (dataBefore) {
    this._suggestionsStore.retainFresh((path, cacheKey) => {
      const node = resolveNode(this._statefulLayout.stateTree.root, path)
      if (!node || !equal(this._freshnessKey(node), cacheKey)) return false
      return !dataBefore || !dataBefore.has(path) || equal(node.data, dataBefore.get(path))
    })
  }

  /**
   * @param {string} name
   * @returns {string}
   */
  _toolName (name) {
    return this._prefixName + name
  }

  /**
   * @returns {ToolDescriptor[]}
   */
  getTools () {
    const dataTitle = this._dataTitle

    /** @type {ToolDescriptor[]} */
    const tools = []

    tools.push(
      {
        name: this._toolName('getData'),
        description: getData.getDescription(dataTitle),
        inputSchema: getData.inputSchema,
        execute: async (args) => {
          try {
            const result = getData.execute(this._statefulLayout, args || {})
            // Returned whole, always. This tool's answer IS the data: an agent may hand it
            // to an API, and a document with named placeholders where its values should be
            // would be forwarded as those strings with nothing looking wrong. Volume on a
            // large form is a question of when to call this at all, which the guide
            // answers — not a licence for the tool to answer with something else.
            return {
              content: [{ type: 'text', text: JSON.stringify(result) }]
            }
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            return {
              content: [{ type: 'text', text: `Error: ${message}` }],
              isError: true
            }
          }
        }
      },
      {
        name: this._toolName('setData'),
        description: setData.getDescription(dataTitle),
        inputSchema: setData.inputSchema,
        execute: async (args) => {
          try {
            if (!args?.data) {
              throw new Error('data is required')
            }
            args.data = parseIfJsonString(args.data)
            const memorized = this._memorizedData()
            const referentialBefore = this._referentialData()
            const result = setData.execute(
              this._statefulLayout,
              /** @type {{ data: unknown, merge?: boolean }} */(args)
            )
            // A list survives a setData that did not touch it: round 2's agents lost the
            // commune list they had just fetched to a setData of the other fields. One whose
            // path now holds other data may designate another item (an array passed whole
            // replaces the previous one), so it goes.
            this._retainFresh(memorized)
            const warnings = []
            if (result.removed.length) {
              warnings.push(`removed ${result.removed.length} key(s) not present in the data you passed: ${result.removed.join(', ')} — pass merge=true to keep them`)
            }
            if (result.unknownKeys.length) {
              warnings.push(`${result.unknownKeys.length} key(s) match no field of this form and were ignored by it: ${result.unknownKeys.join(', ')} — check for a typo with describeState`)
            }
            warnings.push(...this._unpickedWarnings(referentialBefore))
            const visibilityInfo = result.visibility ? formatVisibilityDiff(result.visibility).replace(/^\n/, '') : ''
            const stored = result.written.length ? `stored ${result.written.length} key(s): ${result.written.join(', ')}` : ''
            const text = [formatMutationResult(result.valid, result.errors), ...(stored ? [stored] : []), ...(result.coerced ? [`coerced: ${result.coerced.join('; ')}`] : []), ...(visibilityInfo ? [visibilityInfo] : []), ...warnings].join('\n')
            return {
              content: [{ type: 'text', text }]
            }
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            return {
              content: [{ type: 'text', text: `Error: ${message}` }],
              isError: true
            }
          }
        }
      },
      {
        name: this._toolName('describeState'),
        description: describeState.getDescription(dataTitle, this._screen),
        inputSchema: describeState.inputSchema,
        execute: async (args) => {
          try {
            const text = describeState.toMarkdown(this._statefulLayout, args || {}, this._variantsMemo, this._screen)
            return {
              content: [{ type: 'text', text }]
            }
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            return {
              content: [{ type: 'text', text: `Error: ${message}` }],
              isError: true
            }
          }
        }
      },
      {
        name: this._toolName('openSection'),
        description: openSection.getDescription(dataTitle),
        inputSchema: openSection.inputSchema,
        execute: async (args) => {
          try {
            if (!args?.path) {
              throw new Error('path is required')
            }
            const text = openSection.execute(this._statefulLayout, /** @type {{ path: string }} */(args))
            return {
              content: [{ type: 'text', text }]
            }
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            return {
              content: [{ type: 'text', text: `Error: ${message}` }],
              isError: true
            }
          }
        }
      },
      {
        name: this._toolName('setFieldValue'),
        description: setFieldValue.getDescription(dataTitle),
        inputSchema: setFieldValue.inputSchema,
        execute: async (args) => {
          try {
            if (!args?.path) {
              throw new Error('path is required')
            }
            if (args.value !== undefined) args.value = parseIfJsonString(args.value)
            const referentialBefore = this._referentialData()
            // a whole array or object written at once may put other items under the paths
            // memorized below it, as setData can
            const writtenPath = resolveNode(this._statefulLayout.stateTree.root, /** @type {string} */(args.path))?.fullKey
            const memorizedBelow = writtenPath !== undefined ? this._memorizedData(writtenPath) : undefined
            const result = setFieldValue.execute(
              this._statefulLayout,
              /** @type {{ path: string, value?: unknown, suggestionIndex?: number }} */(args),
              this._suggestionsStore,
              this._variantsMemo
            )
            // A getItems expression can depend on another field, so this write may have
            // changed the options of a field memorized under an unchanged path — but only
            // of a field whose list actually depends on it. Comparing each memorized path's
            // itemsCacheKey against the node's current one is how the state layer itself
            // decides whether to re-fetch.
            this._retainFresh(memorizedBelow)
            let fieldInfo = `${result.field.path} (${result.field.type}) = ${abbreviateValue(result.field.data)}`
            if (result.visibility) fieldInfo += formatVisibilityDiff(result.visibility)
            if (result.activatedMarkdown) {
              fieldInfo += `\nFields of the activated variant:\n${result.activatedMarkdown}`
            }
            if (this._screen) fieldInfo += revealWritten(this._statefulLayout, result.field.path)
            return {
              content: [{ type: 'text', text: formatMutationResult(result.valid, result.errors, fieldInfo, result.otherErrors, result.elsewhere) + coercedLine(result.coerced) + warningLines(this._unpickedWarnings(referentialBefore)) }]
            }
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            return {
              content: [{ type: 'text', text: `Error: ${message}` }],
              isError: true
            }
          }
        }
      },
      {
        name: this._toolName('getFieldSuggestions'),
        description: getFieldSuggestions.getDescription(dataTitle),
        inputSchema: getFieldSuggestions.inputSchema,
        execute: async (args) => {
          try {
            if (!args?.path) {
              throw new Error('path is required')
            }
            const result = await getFieldSuggestions.execute(
              this._statefulLayout,
              /** @type {{ path: string, query?: string }} */(args),
              this._suggestionsStore,
              (node) => this._freshnessKey(node)
            )
            const suggestions = projectSuggestions(result.items, result.baseIndex)
            // An empty answer has two causes the agent must tell apart: a query that
            // matched nothing, and a list whose request could not be built because another
            // field is still empty. Only the second is a reason to go somewhere else.
            const node = resolveNode(this._statefulLayout.stateTree.root, /** @type {any} */(args).path)
            const blockedOn = node && suggestionsBlocked(node) ? suggestionsSource(node) : undefined
            // A search that answers whatever it has reads as a list of matches: say when
            // none of them holds a word of the query, before one is picked as the closest
            const query = typeof args.query === 'string' ? args.query : undefined
            // a variant selector ignores the query: it always lists its branches
            const unmatched = query && node?.layout.comp !== 'one-of-select' && !suggestionsMatchQuery(result.items, query) ? query : undefined
            return {
              content: [{ type: 'text', text: formatSuggestions(suggestions, blockedOn, unmatched) }]
            }
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            return {
              content: [{ type: 'text', text: `Error: ${message}` }],
              isError: true
            }
          }
        }
      },
      {
        name: this._toolName('editArray'),
        description: editArray.getDescription(dataTitle),
        inputSchema: editArray.inputSchema,
        execute: async (args) => {
          try {
            if (!args?.path || !args?.action) {
              throw new Error('path and action are required')
            }
            if (args.value !== undefined) {
              args.value = parseIfJsonString(args.value)
            }
            const listPath = resolveNode(this._statefulLayout.stateTree.root, /** @type {string} */(args.path))?.fullKey
            const referentialBefore = this._referentialData()
            const result = editArray.execute(
              this._statefulLayout,
              /** @type {{ path: string, action: 'add'|'remove'|'move', index?: number, from?: number, to?: number, value?: unknown }} */(args),
              this._variantsMemo
            )
            // adding or removing an item shifts the paths of the items after it, so the
            // suggestions memorized for those paths now designate another item; a move
            // takes each item's lists along with it. A list that no longer resolves (a
            // condition hid it) leaves nothing its memorized paths could designate.
            if (listPath !== undefined && !result.moved) {
              if (!resolveNode(this._statefulLayout.stateTree.root, listPath)) this._suggestionsStore.dropUnder(listPath)
              else if (args.action === 'move') this._suggestionsStore.move(listPath, /** @type {number} */(args.from), /** @type {number} */(args.to))
              else this._suggestionsStore.dropUnder(listPath, result.index, args.action === 'add' ? 1 : -1)
            }
            this._retainFresh()
            let actionInfo
            if (args.action === 'add') actionInfo = `added item at index ${result.index}, ${result.itemCount} total`
            else if (args.action === 'move') {
              actionInfo = result.moved
                ? `item ${args.from} is already at ${args.to}, nothing moved, ${result.itemCount} total`
                : `moved item from ${args.from} to ${args.to}, ${result.itemCount} total`
            } else actionInfo = `removed item at index ${result.index}${result.removed ? ` (${result.removed})` : ''}, ${result.itemCount} remaining`
            if (result.itemMarkdown) {
              actionInfo += `\nFields of the new item (activated for edition):\n${result.itemMarkdown}`
            }
            if (this._screen) actionInfo += revealWritten(this._statefulLayout, /** @type {string} */(args.path))
            return {
              content: [{ type: 'text', text: formatMutationResult(result.valid, result.errors, actionInfo, result.otherErrors, result.elsewhere) + coercedLine(result.coerced) + warningLines(this._unpickedWarnings(referentialBefore, editArrayEligible(listPath, args.action === 'add' ? result.index : undefined))) + (result.items ? `\nThe list now:\n${result.items.join('\n')}` : '') }]
            }
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            return {
              content: [{ type: 'text', text: `Error: ${message}` }],
              isError: true
            }
          }
        }
      }
    )

    // with no screen there is no tab to open
    if (!this._screen) tools.splice(tools.findIndex(t => t.name === this._toolName('openSection')), 1)

    return tools
  }

  /**
   * The fill-form guide as an Agent Skill: what an agent loads before using this form's tools. A page
   * publishes it with them (registerTools); a server serving the same tools publishes it its own way (an
   * MCP server as a skill resource).
   * @returns {{ name: string, uri: string, description: string, body: string }}
   */
  getSkill () {
    // The Agent Skills name format (lowercase words joined by hyphens), from the tools' prefix.
    const prefix = this._prefixName
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
    const name = prefix ? `${prefix}-form` : 'form'
    return {
      name,
      uri: `skill://${name}/SKILL.md`,
      description: fillFormSkill.getDescription(this._dataTitle),
      body: fillFormSkill.generateSkill(this._dataTitle, this._prefixName, { guide: this._statefulLayout.compiledLayout.agentGuide, screen: this._screen })
    }
  }

  /**
   * Register the tools on navigator.modelContext, and the form's skill beside them where the model
   * context serves resources (MCP-B's, not the bare WebMCP API).
   * @returns {Promise<void>}
   */
  async registerTools () {
    if (typeof navigator === 'undefined' || !navigator.modelContext) {
      throw new Error('navigator.modelContext is not available')
    }

    const tools = this.getTools()
    for (const tool of tools) {
      log('registering tool:', tool.name)
      // @ts-ignore - complex generic types from webmcp-types
      await navigator.modelContext.registerTool(tool)
      this._registeredTools.push(tool.name)
    }

    const modelContext = /** @type {any} */(navigator.modelContext)
    if (typeof modelContext.registerResource === 'function') {
      const skill = this.getSkill()
      log('registering skill:', skill.uri)
      this._registeredSkill = modelContext.registerResource({
        uri: skill.uri,
        name: skill.name,
        description: skill.description,
        mimeType: 'text/markdown',
        read: async () => ({ contents: [{ uri: skill.uri, mimeType: 'text/markdown', text: skill.body }] })
      })
    }
  }

  /**
   * @returns {Promise<void>}
   */
  async unregisterTools () {
    if (typeof navigator === 'undefined' || !navigator.modelContext) {
      throw new Error('navigator.modelContext is not available')
    }

    for (const name of this._registeredTools) {
      log('unregistering tool:', name)
      await navigator.modelContext.unregisterTool(name)
    }
    this._registeredTools = []
    this._registeredSkill?.unregister()
    this._registeredSkill = null
  }
}
