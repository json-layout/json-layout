import { createStore } from './store.ts'
import { compile } from './tools/compile.ts'
import { createState } from './tools/create-state.ts'
import { describeState } from './tools/describe-state.ts'
import { setData } from './tools/set-data.ts'
import { setFieldValue } from './tools/set-field.ts'
import { getFieldSuggestions } from './tools/get-suggestions.ts'
import { validateState } from './tools/validate.ts'
import { getData } from './tools/get-data.ts'
import type {
  CompileInput, CompileResult,
  CreateStateInput, CreateStateResult,
  DescribeStateInput, DescribeStateResult,
  SetDataInput, SetDataResult,
  SetFieldValueInput, SetFieldValueResult,
  GetFieldSuggestionsInput, GetFieldSuggestionsResult,
  ValidateStateInput, ValidateStateResult,
  GetDataInput, GetDataResult
} from './types.ts'

export interface AgentToolkit {
  compile: (input: CompileInput) => CompileResult
  createState: (input: CreateStateInput) => CreateStateResult
  describeState: (input: DescribeStateInput) => DescribeStateResult
  setData: (input: SetDataInput) => SetDataResult
  setFieldValue: (input: SetFieldValueInput) => SetFieldValueResult
  getFieldSuggestions: (input: GetFieldSuggestionsInput) => Promise<GetFieldSuggestionsResult>
  validateState: (input: ValidateStateInput) => ValidateStateResult
  getData: (input: GetDataInput) => GetDataResult
  destroy: () => void
}

export interface AgentToolkitOptions {
  /** TTL for stored objects in milliseconds (default: 30 minutes) */
  ttlMs?: number
}

export function createAgentToolkit (options?: AgentToolkitOptions): AgentToolkit {
  const store = createStore(options?.ttlMs ?? 30 * 60 * 1000)

  return {
    compile: (input) => compile(input, store),
    createState: (input) => createState(input, store),
    describeState: (input) => describeState(input, store),
    setData: (input) => setData(input, store),
    setFieldValue: (input) => setFieldValue(input, store),
    getFieldSuggestions: (input) => getFieldSuggestions(input, store),
    validateState: (input) => validateState(input, store),
    getData: (input) => getData(input, store),
    destroy: () => store.clear()
  }
}

// Re-export types for consumers
export type {
  CompileInput, CompileResult,
  CreateStateInput, CreateStateResult,
  DescribeStateInput, DescribeStateResult,
  SetDataInput, SetDataResult,
  SetFieldValueInput, SetFieldValueResult,
  GetFieldSuggestionsInput, GetFieldSuggestionsResult,
  ValidateStateInput, ValidateStateResult,
  GetDataInput, GetDataResult,
  ProjectedNode, ProjectedStateTree,
  SuggestionItem,
  Store
} from './types.ts'
