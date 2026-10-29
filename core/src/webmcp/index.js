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
import { formatMutationResult, formatSuggestions, projectSuggestions, abbreviateValue, formatVisibilityDiff, suggestionsBlocked, suggestionsSource } from './project.js'
import { resolveNode } from './resolve.js'
import { SuggestionsStore } from './suggestions-store.js'
import { VariantsMemo } from './variants-memo.js'

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
            const result = setData.execute(
              this._statefulLayout,
              /** @type {{ data: unknown, merge?: boolean }} */(args)
            )
            // the whole data was replaced, what a memorized path designates may have changed
            this._suggestionsStore.clear()
            const warnings = []
            if (result.removed.length) {
              warnings.push(`removed ${result.removed.length} key(s) not present in the data you passed: ${result.removed.join(', ')} — pass merge=true to keep them`)
            }
            if (result.unknownKeys.length) {
              warnings.push(`${result.unknownKeys.length} key(s) match no field of this form and were ignored by it: ${result.unknownKeys.join(', ')} — check for a typo with describeState`)
            }
            const visibilityInfo = result.visibility ? formatVisibilityDiff(result.visibility).replace(/^\n/, '') : ''
            const stored = result.written.length ? `stored ${result.written.length} key(s): ${result.written.join(', ')}` : ''
            const text = [formatMutationResult(result.valid, result.errors), ...(stored ? [stored] : []), ...(visibilityInfo ? [visibilityInfo] : []), ...warnings].join('\n')
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
            this._suggestionsStore.retainFresh((path, cacheKey) => {
              const node = resolveNode(this._statefulLayout.stateTree.root, path)
              return !!node && node.itemsCacheKey === cacheKey
            })
            let fieldInfo = `${result.field.path} (${result.field.type}) = ${abbreviateValue(result.field.data)}`
            if (result.visibility) fieldInfo += formatVisibilityDiff(result.visibility)
            if (result.activatedMarkdown) {
              fieldInfo += `\nFields of the activated variant:\n${result.activatedMarkdown}`
            }
            if (this._screen) fieldInfo += revealWritten(this._statefulLayout, result.field.path)
            return {
              content: [{ type: 'text', text: formatMutationResult(result.valid, result.errors, fieldInfo, result.otherErrors) }]
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
              this._suggestionsStore
            )
            const suggestions = projectSuggestions(result.items, result.baseIndex)
            // An empty answer has two causes the agent must tell apart: a query that
            // matched nothing, and a list whose request could not be built because another
            // field is still empty. Only the second is a reason to go somewhere else.
            const node = resolveNode(this._statefulLayout.stateTree.root, /** @type {any} */(args).path)
            const blockedOn = node && suggestionsBlocked(node) ? suggestionsSource(node) : undefined
            return {
              content: [{ type: 'text', text: formatSuggestions(suggestions, blockedOn) }]
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
            const result = editArray.execute(
              this._statefulLayout,
              /** @type {{ path: string, action: 'add'|'remove', index?: number, value?: unknown }} */(args),
              this._variantsMemo
            )
            // adding or removing an item shifts the paths of the items after it, so the
            // suggestions memorized for those paths now designate another item
            this._suggestionsStore.clear()
            let actionInfo = args.action === 'add'
              ? `added item at index ${result.index}, ${result.itemCount} total`
              : `removed item at index ${result.index}, ${result.itemCount} remaining`
            if (result.itemMarkdown) {
              actionInfo += `\nFields of the new item (activated for edition):\n${result.itemMarkdown}`
            }
            if (this._screen) actionInfo += revealWritten(this._statefulLayout, /** @type {string} */(args.path))
            return {
              content: [{ type: 'text', text: formatMutationResult(result.valid, result.errors, actionInfo, result.otherErrors) }]
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
