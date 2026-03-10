import { z } from 'zod'
import { tool } from 'ai'
import { compile as compileSchema } from '@json-layout/core'
import type { PartialCompileOptions } from '@json-layout/core'
import type { Store, CompileInput, CompileResult, GetSchemaContext } from '../types.ts'
import { validationErrorsSchema } from './schemas.ts'

export function compile (
  input: CompileInput,
  store: Store,
  getSchema: GetSchemaContext
): CompileResult {
  const { path, options } = input

  const inputOptions = (options ?? {}) as Partial<PartialCompileOptions> & { ajvOptions?: Record<string, unknown> }
  const compileOptions: Partial<PartialCompileOptions> = {
    ...inputOptions,
    ajvOptions: {
      ...inputOptions.ajvOptions,
      coerceTypes: 'array'
    }
  }

  const cached = store.getCompiledByPath(path)

  const result = getSchema(path, cached?.updateDate)

  if (!result) {
    if (!cached) {
      throw new Error(`no compiled layout found for path: ${path}`)
    }
    return {
      id: path,
      valid: true,
      errors: [],
      recompiled: false,
      updateDate: cached.updateDate
    }
  }

  const { schema, updateDate } = result
  const compiledLayout = compileSchema(schema, compileOptions)

  const errors: CompileResult['errors'] = []
  for (const [pointer, messages] of Object.entries(compiledLayout.validationErrors)) {
    if (messages.length > 0) {
      errors.push({ pointer, messages })
    }
  }

  store.setCompiledByPath(path, compiledLayout, updateDate)

  return {
    id: path,
    valid: errors.length === 0,
    errors,
    recompiled: true,
    updateDate
  }
}

const description = 'Compile a JSON Schema from a path. Uses getSchema to fetch the schema and caches the compiled layout.'

const inputSchema = z.object({
  path: z.string().describe('Path/identifier for the schema'),
  options: z.record(z.unknown()).optional().describe('Compile options (locale, components, etc.)')
})

const outputSchema = z.object({
  id: z.string(),
  valid: z.boolean(),
  errors: validationErrorsSchema,
  recompiled: z.boolean(),
  updateDate: z.number()
})

interface CompileExecuteContext {
  store: Store
  getSchema: GetSchemaContext
}

const execute = (params: z.infer<typeof inputSchema>, context: CompileExecuteContext) => {
  return compile(params, context.store, context.getSchema)
}

const createTool = (context: CompileExecuteContext) => tool({
  description,
  inputSchema,
  outputSchema,
  execute: (params) => execute(params, context)
})

export { description, inputSchema, outputSchema, execute, createTool }

export default { description, inputSchema, outputSchema, execute, createTool }
