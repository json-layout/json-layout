import { compile as compileSchema } from '@json-layout/core'
import type { PartialCompileOptions } from '@json-layout/core'
import type { Store, CompileInput, CompileResult } from '../types.ts'

export function compile (input: CompileInput, store: Store): CompileResult {
  const id = input.id ?? store.generateId()
  const options = (input.options ?? {}) as Partial<PartialCompileOptions>

  const compiledLayout = compileSchema(input.schema, options)

  // collect validation errors from compilation
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
