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
import * as fillFormSkill from './tools/fill-form-skill.js'

/** @typedef {import('@mcp-b/webmcp-types').ToolDescriptor} ToolDescriptor */

const log = debug('jl:webmcp')

/**
 * @typedef {object} WebMCPOptions
 * @property {string} [prefixName] - Prefix for all tool names
 * @property {string} [dataTitle] - Title used in descriptions (default: 'form')
 * @property {object} [schema] - The original JSON schema
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

  /**
   * @readonly
   * @type {string}
   */
  _skill

  /**
   * @readonly
   * @type {object | null}
   */
  _schema = null

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
    this._skill = fillFormSkill.generateSkill(this._dataTitle, this._prefixName, !!this._schema, this._statefulLayout)
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
    const tools = [
      {
        name: this._toolName('fillFormSkill'),
        description: fillFormSkill.getDescription(dataTitle),
        outputSchema: { type: 'string' },
        execute: async (args) => {
          try {
            return {
              content: [{ type: 'text', text: this._skill }]
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
        name: this._toolName('getData'),
        description: getData.getDescription(dataTitle),
        inputSchema: getData.inputSchema,
        outputSchema: getData.outputSchema,
        execute: async (args) => {
          try {
            const result = getData.execute(this._statefulLayout, args || {})
            return {
              content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
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
        outputSchema: setData.outputSchema,
        execute: async (args) => {
          try {
            if (!args?.data) {
              throw new Error('data is required')
            }
            const result = setData.execute(
              this._statefulLayout,
              /** @type {{ data: unknown }} */(args)
            )
            return {
              content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
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
        description: describeState.getDescription(dataTitle),
        inputSchema: describeState.inputSchema,
        outputSchema: describeState.outputSchema,
        execute: async (args) => {
          try {
            const result = describeState.execute(this._statefulLayout, args || {})
            return {
              content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
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
            const result = setFieldValue.execute(
              this._statefulLayout,
              /** @type {{ path: string, value: unknown }} */(args)
            )
            return {
              content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
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
              content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
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
    ]

    if (this._schema) {
      tools.push({
        name: this._toolName('getSchema'),
        description: `Get the the JSON schema that governs "${dataTitle}" form.`,
        outputSchema: {
          type: 'object',
          properties: {
            jsonSchema: {},
          }
        },
        execute: async (args) => {
          return {
            jsonSchema: this._schema
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
