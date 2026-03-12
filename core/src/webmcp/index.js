/**
 * @file WebMCP integration for JSON Layout StatefulLayout
 * @description Provides MCP tool descriptors that work with browser's navigator.modelContext
 */

import debug from 'debug'

import {
  describeState,
  describeStateSchema,
  setFieldValue,
  setFieldValueSchema,
  setData,
  setDataSchema,
  getData,
  getDataSchema,
  validateState,
  validateStateSchema,
  getFieldSuggestions,
  getFieldSuggestionsSchema,
  skillFetcher,
  skillFetcherSchema
} from './tools/index.js'

/** @typedef {import('@mcp-b/webmcp-types').ToolDescriptor} ToolDescriptor */

const log = debug('jl:webmcp')

/**
 * @typedef {object} WebMCPOptions
 * @property {string} [prefixName] - Prefix for all tool names
 * @property {string} [dataTitle] - Title used in descriptions (default: 'form')
 */

const outputSchemas = {
  describeState: {
    type: 'object',
    properties: {
      state: {
        type: 'object',
        description: 'Projected state tree or single node'
      },
      valid: {
        type: 'boolean'
      },
      errors: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  },
  setFieldValue: {
    type: 'object',
    properties: {
      state: { type: 'object' },
      valid: { type: 'boolean' },
      errors: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  },
  setData: {
    type: 'object',
    properties: {
      state: { type: 'object' },
      valid: { type: 'boolean' },
      errors: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  },
  getData: {
    type: 'object',
    properties: {
      data: {},
      valid: { type: 'boolean' }
    }
  },
  validateState: {
    type: 'object',
    properties: {
      valid: { type: 'boolean' },
      errors: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            message: { type: 'string' }
          }
        }
      },
      data: {}
    }
  },
  getFieldSuggestions: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            value: {},
            title: { type: 'string' },
            key: { type: 'string' }
          }
        }
      }
    }
  },
  skillFetcher: {
    type: 'object',
    properties: {
      content: { type: 'string' }
    }
  }
}

const toolDescriptions = {
  describeState: (/** @type {string} */ dataTitle) => `Describe the current ${dataTitle} state tree. Optionally focus on a subtree by path to reduce output size.`,
  setFieldValue: () => 'Set the value of a specific field by path. For oneOf nodes, pass the variant index as value to switch variants.',
  setData: (/** @type {string} */ dataTitle) => `Bulk-set the ${dataTitle} data. Use for initial fill or replacing all data at once.`,
  getData: (/** @type {string} */ dataTitle) => `Get the current ${dataTitle} data and validity status.`,
  validateState: (/** @type {string} */ dataTitle) => `Validate the entire ${dataTitle} and return validation status and any errors.`,
  getFieldSuggestions: () => 'Get available options for a select/autocomplete/combobox field. Supports query-based filtering.',
  skillFetcher: (/** @type {string} */ dataTitle) => `Get guidance on how to interact with the ${dataTitle} using the available tools.`
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
        name: this._toolName('describeState'),
        description: toolDescriptions.describeState(dataTitle),
        inputSchema: describeStateSchema,
        outputSchema: outputSchemas.describeState,
        execute: async (args) => {
          try {
            const result = describeState(this._statefulLayout, args || {})
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
        description: toolDescriptions.setFieldValue(),
        inputSchema: setFieldValueSchema,
        outputSchema: outputSchemas.setFieldValue,
        execute: async (args) => {
          try {
            if (!args?.path) {
              throw new Error('path is required')
            }
            const result = setFieldValue(this._statefulLayout, /** @type {{ path: string, value: unknown }} */(args))
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
        description: toolDescriptions.setData(dataTitle),
        inputSchema: setDataSchema,
        outputSchema: outputSchemas.setData,
        execute: async (args) => {
          try {
            if (!args?.data) {
              throw new Error('data is required')
            }
            const result = setData(this._statefulLayout, /** @type {{ data: unknown }} */(args))
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
        name: this._toolName('getData'),
        description: toolDescriptions.getData(dataTitle),
        inputSchema: getDataSchema,
        outputSchema: outputSchemas.getData,
        execute: async (args) => {
          try {
            const result = getData(this._statefulLayout, args || {})
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
        name: this._toolName('validateState'),
        description: toolDescriptions.validateState(dataTitle),
        inputSchema: validateStateSchema,
        outputSchema: outputSchemas.validateState,
        execute: async (args) => {
          try {
            const result = validateState(this._statefulLayout, args || {})
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
        description: toolDescriptions.getFieldSuggestions(),
        inputSchema: getFieldSuggestionsSchema,
        outputSchema: outputSchemas.getFieldSuggestions,
        execute: async (args) => {
          try {
            if (!args?.path) {
              throw new Error('path is required')
            }
            const result = await getFieldSuggestions(this._statefulLayout, /** @type {{ path: string, query?: string }} */(args))
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
        name: this._toolName('skillFetcher'),
        description: toolDescriptions.skillFetcher(dataTitle),
        inputSchema: skillFetcherSchema,
        outputSchema: outputSchemas.skillFetcher,
        execute: async (args) => {
          try {
            const result = skillFetcher({ dataTitle: this._dataTitle }, args || {})
            return {
              content: [{ type: 'text', text: result.content }]
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
