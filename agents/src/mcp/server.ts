import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { compile, createState, describeState, setData, setFieldValue, getFieldSuggestions, validateState, getData, destroy } from '../tools/index.ts'

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

server.tool(
  'compile',
  compile.description,
  compile.inputSchema as any,
  async (params: any) => {
    try {
      return toolResult(await compile.execute(params))
    } catch (err: unknown) {
      return toolError(`Compilation failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
)

server.tool(
  'createState',
  createState.description,
  createState.inputSchema as any,
  async (params: any) => {
    try {
      return toolResult(await createState.execute(params))
    } catch (err: unknown) {
      return toolError(`Create state failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
)

server.tool(
  'describeState',
  describeState.description,
  describeState.inputSchema as any,
  async (params: any) => {
    try {
      return toolResult(await describeState.execute(params))
    } catch (err: unknown) {
      return toolError(`Describe state failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
)

server.tool(
  'setData',
  setData.description,
  setData.inputSchema as any,
  async (params: any) => {
    try {
      return toolResult(await setData.execute(params))
    } catch (err: unknown) {
      return toolError(`Set data failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
)

server.tool(
  'setFieldValue',
  setFieldValue.description,
  setFieldValue.inputSchema as any,
  async (params: any) => {
    try {
      return toolResult(await setFieldValue.execute(params))
    } catch (err: unknown) {
      return toolError(`Set field value failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
)

server.tool(
  'getFieldSuggestions',
  getFieldSuggestions.description,
  getFieldSuggestions.inputSchema as any,
  async (params: any) => {
    try {
      return toolResult(await getFieldSuggestions.execute(params))
    } catch (err: unknown) {
      return toolError(`Get suggestions failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
)

server.tool(
  'validateState',
  validateState.description,
  validateState.inputSchema as any,
  async (params: any) => {
    try {
      return toolResult(await validateState.execute(params))
    } catch (err: unknown) {
      return toolError(`Validation failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
)

server.tool(
  'getData',
  getData.description,
  getData.inputSchema as any,
  async (params: any) => {
    try {
      return toolResult(await getData.execute(params))
    } catch (err: unknown) {
      return toolError(`Get data failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
)

server.tool(
  'destroy',
  destroy.description,
  destroy.inputSchema as any,
  async (params: any) => {
    try {
      return toolResult(await destroy.execute(params))
    } catch (err: unknown) {
      return toolError(`Destroy failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
)

async function main () {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((err) => {
  console.error('MCP server error:', err)
  process.exit(1)
})
