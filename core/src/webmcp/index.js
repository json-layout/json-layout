/**
 * @file WebMCP integration for JSON Layout StatefulLayout
 * @description Provides MCP tool descriptors that work with browser's navigator.modelContext
 */

import debug from 'debug'

import * as describeState from './tools/describe-state.js'
import * as setFieldValue from './tools/set-field-value.js'
import * as setData from './tools/set-data.js'
import * as getData from './tools/get-data.js'
import * as getFieldSuggestions from './tools/get-field-suggestions.js'
import * as editArray from './tools/edit-array.js'
import * as fillFormSkill from './tools/fill-form-skill.js'
import { formatMutationResult, formatSuggestions } from './project.js'

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
 * @property {object} [schema] - The original JSON schema
 * @property {boolean} [includeFillFormSkill] - Include the fillFormSkill tool (default: false)
 * @property {boolean} [includeSubAgent] - Include a subagent_ tool wrapping all form tools (default: false)
 */

/**
 * @param {import('../state/index.js').StatefulLayout} statefulLayout
 * @returns {"small"|"medium"|"large"}
 */
function getComplexity (statefulLayout) {
  const nbNormalizedLayouts = Object.keys(statefulLayout.compiledLayout.normalizedLayouts).length
  if (nbNormalizedLayouts > 50) return 'large'
  if (nbNormalizedLayouts > 15) return 'medium'
  return 'small'
}

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

  /**
   * @readonly
   * @type {"small"|"medium"|"large"}
   */
  _complexity

  /**
   * @readonly
   * @type {object | null}
   */
  _schema = null

  /**
   * @readonly
   * @type {boolean}
   */
  _includeFillFormSkill = false

  /**
   * @readonly
   * @type {boolean}
   */
  _includeSubAgent = false

  /**
   * @type {string[]}
   */
  _registeredTools = []

  /**
   * @param {import('../state/index.js').StatefulLayout} statefulLayout
   * @param {WebMCPOptions} [options]
   */
  constructor (statefulLayout, options = {}) {
    this._statefulLayout = statefulLayout
    this._prefixName = options.prefixName || ''
    this._dataTitle = options.dataTitle || 'form'
    this._schema = options.schema || null
    this._includeFillFormSkill = options.includeFillFormSkill || false
    this._includeSubAgent = options.includeSubAgent || false
    this._complexity = getComplexity(statefulLayout)
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
    const complexity = this._complexity

    /** @type {ToolDescriptor[]} */
    const tools = []

    if (this._includeFillFormSkill) {
      const skill = fillFormSkill.generateSkill(dataTitle, this._prefixName, !!this._schema, this._statefulLayout)
      tools.push({
        name: this._toolName('fillFormSkill'),
        description: fillFormSkill.getDescription(dataTitle),
        outputSchema: { type: 'string' },
        execute: async (args) => {
          try {
            return {
              content: [{ type: 'text', text: skill }]
            }
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err)
            return {
              content: [{ type: 'text', text: `Error: ${message}` }],
              isError: true
            }
          }
        }
      })
    }

    tools.push(
      {
        name: this._toolName('getData'),
        description: `Get current "${dataTitle}" data and validity status. Call this first to see what data already exists.`,
        inputSchema: getData.inputSchema,
        outputSchema: getData.outputSchema,
        execute: async (args) => {
          try {
            const result = getData.execute(this._statefulLayout, args || {})
            return {
              content: [{ type: 'text', text: JSON.stringify(result) }],
              structuredContent: result
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
        description: setData.getDescription(dataTitle, complexity),
        inputSchema: setData.inputSchema,
        outputSchema: setData.outputSchema,
        execute: async (args) => {
          try {
            if (!args?.data) {
              throw new Error('data is required')
            }
            args.data = parseIfJsonString(args.data)
            const result = setData.execute(
              this._statefulLayout,
              /** @type {{ data: unknown }} */(args)
            )
            return {
              content: [{ type: 'text', text: formatMutationResult(result.valid, result.errors) }],
              structuredContent: result
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
        description: describeState.getDescription(dataTitle, complexity),
        inputSchema: describeState.inputSchema,
        outputSchema: describeState.outputSchema,
        execute: async (args) => {
          try {
            const result = describeState.execute(this._statefulLayout, args || {})
            const text = describeState.toMarkdown(this._statefulLayout, args || {})
            return {
              content: [{ type: 'text', text }],
              structuredContent: result
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
        outputSchema: setFieldValue.outputSchema,
        execute: async (args) => {
          try {
            if (!args?.path) {
              throw new Error('path is required')
            }
            args.value = parseIfJsonString(args.value)
            const result = setFieldValue.execute(
              this._statefulLayout,
              /** @type {{ path: string, value: unknown }} */(args)
            )
            const fieldInfo = `${result.field.path} (${result.field.type}) = ${JSON.stringify(result.field.data)}`
            return {
              content: [{ type: 'text', text: formatMutationResult(result.valid, result.errors, fieldInfo) }],
              structuredContent: result
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
        description: `Get allowed values for a dropdown or autocomplete field in "${dataTitle}". Required when describeState shows "suggestions" for a field. Pass the returned value directly to setFieldValue or include it in setData.`,
        inputSchema: getFieldSuggestions.inputSchema,
        outputSchema: getFieldSuggestions.outputSchema,
        execute: async (args) => {
          try {
            if (!args?.path) {
              throw new Error('path is required')
            }
            const result = await getFieldSuggestions.execute(
              this._statefulLayout,
              /** @type {{ path: string, query?: string }} */(args)
            )
            return {
              content: [{ type: 'text', text: formatSuggestions(result.items) }],
              structuredContent: result
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
        outputSchema: editArray.outputSchema,
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
              /** @type {{ path: string, action: 'add'|'remove', index?: number, value?: unknown }} */(args)
            )
            const actionInfo = args.action === 'add'
              ? `added item, ${result.itemCount} total`
              : `removed item, ${result.itemCount} remaining`
            return {
              content: [{ type: 'text', text: formatMutationResult(result.valid, result.errors, actionInfo) }],
              structuredContent: result
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

    if (this._schema) {
      tools.push({
        name: this._toolName('getSchema'),
        description: `Get the JSON schema that governs the "${dataTitle}" form.`,
        outputSchema: {
          type: 'object',
          description: 'The JSON schema definition'
        },
        execute: async (args) => {
          return {
            content: [{ type: 'text', text: JSON.stringify(this._schema) }],
            structuredContent: this._schema
          }
        }
      })
    }

    if (this._includeSubAgent) {
      const toolNames = tools.map(t => t.name)
      const prompt = fillFormSkill.generateSkill(dataTitle, this._prefixName, !!this._schema, this._statefulLayout)
      tools.push({
        name: `subagent_${this._toolName('form')}`,
        description: `Delegate a form-filling task for "${dataTitle}" to a specialized sub-agent`,
        inputSchema: {
          type: 'object',
          properties: {
            task: { type: 'string', description: 'The task to delegate to this sub-agent' }
          },
          required: ['task']
        },
        execute: async () => {
          return {
            content: [{ type: 'text', text: JSON.stringify({ prompt, tools: toolNames }) }],
            structuredContent: { prompt, tools: toolNames }
          }
        }
      })
    }

    return tools
  }

  /**
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
  }
}
