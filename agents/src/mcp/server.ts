import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { createStore } from '../store.ts'
import { compile } from '../tools/compile.ts'
import { createState } from '../tools/create-state.ts'
import { describeState } from '../tools/describe-state.ts'
import { setData } from '../tools/set-data.ts'
import { setFieldValue } from '../tools/set-field.ts'
import { getFieldSuggestions } from '../tools/get-suggestions.ts'
import { validateState } from '../tools/validate.ts'
import { getData } from '../tools/get-data.ts'

const store = createStore()

function toolResult (data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
}

function toolError (message: string) {
  return { content: [{ type: 'text' as const, text: message }], isError: true as const }
}

const server = new McpServer({
  name: 'json-layout',
  version: '0.1.0'
})

// --- compile ---
server.tool(
  'compile',
  'Compile a JSON Schema with optional json-layout annotations. Returns compilation errors and stores the compiled layout for use with createState.',
  {
    schema: z.record(z.unknown()).describe('The JSON Schema to compile'),
    options: z.record(z.unknown()).optional().describe('Compile options (locale, components, etc.)'),
    id: z.string().optional().describe('Optional ID for the compiled layout (auto-generated if omitted)')
  },
  async ({ schema, options, id }) => {
    try {
      return toolResult(compile({ schema, options, id }, store))
    } catch (err: unknown) {
      return toolError(`Compilation failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
)

// --- createState ---
server.tool(
  'createState',
  'Create a StatefulLayout from a compiled layout. Returns the initial state tree projected for agent consumption.',
  {
    compiledId: z.string().describe('ID of a previously compiled layout'),
    data: z.unknown().optional().describe('Initial data to populate the form'),
    options: z.record(z.unknown()).optional().describe('StatefulLayout options (readOnly, validateOn, etc.)')
  },
  async ({ compiledId, data, options }) => {
    try {
      return toolResult(createState({ compiledId, data, options }, store))
    } catch (err: unknown) {
      return toolError(`Create state failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
)

// --- describeState ---
server.tool(
  'describeState',
  'Describe the current state tree. Optionally focus on a subtree by path to reduce output size.',
  {
    stateId: z.string().describe('ID of the stateful layout'),
    path: z.string().optional().describe('Path to a specific node (e.g. "/address/city"). Omit for full tree.')
  },
  async ({ stateId, path }) => {
    try {
      return toolResult(describeState({ stateId, path }, store))
    } catch (err: unknown) {
      return toolError(`Describe state failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
)

// --- setData ---
server.tool(
  'setData',
  'Set the entire form data at once (bulk update). Returns the updated state tree and validation errors.',
  {
    stateId: z.string().describe('ID of the stateful layout'),
    data: z.unknown().describe('The complete data object to set')
  },
  async ({ stateId, data }) => {
    try {
      return toolResult(setData({ stateId, data }, store))
    } catch (err: unknown) {
      return toolError(`Set data failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
)

// --- setFieldValue ---
server.tool(
  'setFieldValue',
  'Set the value of a specific field by path. For oneOf nodes, pass the variant index as value to switch variants.',
  {
    stateId: z.string().describe('ID of the stateful layout'),
    path: z.string().describe('Path to the field (e.g. "/name", "/items/0/quantity")'),
    value: z.unknown().describe('The value to set')
  },
  async ({ stateId, path, value }) => {
    try {
      return toolResult(setFieldValue({ stateId, path, value }, store))
    } catch (err: unknown) {
      return toolError(`Set field value failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
)

// --- getFieldSuggestions ---
server.tool(
  'getFieldSuggestions',
  'Get available options for a select/autocomplete/combobox field. Supports query-based filtering.',
  {
    stateId: z.string().describe('ID of the stateful layout'),
    path: z.string().describe('Path to the field'),
    query: z.string().optional().describe('Search query to filter suggestions')
  },
  async ({ stateId, path, query }) => {
    try {
      return toolResult(await getFieldSuggestions({ stateId, path, query }, store))
    } catch (err: unknown) {
      return toolError(`Get suggestions failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
)

// --- validateState ---
server.tool(
  'validateState',
  'Trigger full form validation and return all errors with their paths, plus the current data.',
  {
    stateId: z.string().describe('ID of the stateful layout')
  },
  async ({ stateId }) => {
    try {
      return toolResult(validateState({ stateId }, store))
    } catch (err: unknown) {
      return toolError(`Validation failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
)

// --- getData ---
server.tool(
  'getData',
  'Get the current form data and validity status.',
  {
    stateId: z.string().describe('ID of the stateful layout')
  },
  async ({ stateId }) => {
    try {
      return toolResult(getData({ stateId }, store))
    } catch (err: unknown) {
      return toolError(`Get data failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
)

// --- Start server ---
async function main () {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((err) => {
  console.error('MCP server error:', err)
  process.exit(1)
})
