import { z } from 'zod'
import { tool } from 'ai'
import { compile as compileSchema } from '@json-layout/core'
import type { PartialCompileOptions } from '@json-layout/core'
import type { Store, CompileInput, CompileResult } from '../types.ts'
import { store } from '../store.ts'
import { validationErrorsSchema } from './schemas.ts'

export function compile (input: CompileInput, store: Store): CompileResult {
  const id = input.id ?? store.generateId()
  const inputOptions = (input.options ?? {}) as Partial<PartialCompileOptions> & { ajvOptions?: Record<string, unknown> }
  const options: Partial<PartialCompileOptions> = {
    ...inputOptions,
    ajvOptions: {
      ...inputOptions.ajvOptions,
      coerceTypes: 'array'
    }
  }

  const compiledLayout = compileSchema(input.schema, options)

  const errors: CompileResult['errors'] = []
  for (const [pointer, messages] of Object.entries(compiledLayout.validationErrors)) {
    if (messages.length > 0) {
      errors.push({ pointer, messages })
    }
  }

  store.setCompiled(id, compiledLayout)

  return {
    id,
    valid: errors.length === 0,
    errors
  }
}

const description = 'Compile a JSON Schema with optional json-layout annotations. Returns compilation errors and stores the compiled layout for use with createState.'

const inputSchema = z.object({
  schema: z.record(z.unknown()).describe('The JSON Schema to compile'),
  options: z.record(z.unknown()).optional().describe('Compile options (locale, components, etc.)'),
  id: z.string().optional().describe('Optional ID for the compiled layout (auto-generated if omitted)')
})

const outputSchema = z.object({
  id: z.string(),
  valid: z.boolean(),
  errors: validationErrorsSchema
})

const execute = async (params: z.infer<typeof inputSchema>) => {
  return compile(params, store)
}

const createTool = () => tool({ description, inputSchema, outputSchema, execute })

export { description, inputSchema, outputSchema, execute, createTool }

export default { description, inputSchema, outputSchema, execute, createTool }
