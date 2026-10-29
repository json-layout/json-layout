/**
 * @file A plain JSON API over one eval case, the baseline the form tools are compared with.
 *
 * Same case, same starting document, same recording as EvalSession: only the tools and
 * the prompt differ. The tools are what a well-made JSON API offers — read, replace, patch
 * top-level keys — plus the targeted lookups a real server offers for the case's remote
 * lists (lookups.js), never a generic HTTP client. They are described as completely as a
 * careful API user needs, and writes are validated by the very ajv function the form
 * compiles from the case, so neither arm validates more strictly than the other.
 */

import { compile } from '../src/compile/index.js'
import { createLookupTools } from './lookups.js'
import { DEFAULT_DATA_FAIR_URL } from './session.js'
import { runChecks } from './checks.js'
import { PLAIN_RUNNER_PROMPT } from './prompts.js'

/** @typedef {import('./cases/types.js').EvalCase} EvalCase */
/** @typedef {import('./session.js').RecordedCall} RecordedCall */
/** @typedef {import('./session.js').EvalSessionOptions} EvalSessionOptions */
/** @typedef {import('./session.js').EvalEvidence & { arm: 'plain' }} PlainEvidence */

/**
 * @typedef {object} ApiTool
 * @property {string} name - tool name the runner calls
 * @property {string} description - what the runner reads about the tool
 * @property {Record<string, any>} inputSchema - JSON schema of the arguments
 * @property {(args: Record<string, any>) => Promise<ToolResult>} execute - runs the call
 */

/** @typedef {{ content: { type: 'text', text: string }[], isError: boolean }} ToolResult */

/**
 * Same tolerance as the form tools: some clients send structured arguments as a JSON
 * string, and refusing them would measure the client, not the API.
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
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * Resolve an RFC 6901 JSON pointer.
 * @param {unknown} root
 * @param {string | undefined} pointer
 * @returns {{ found: boolean, value?: unknown }}
 */
export function resolvePointer (root, pointer) {
  if (pointer === undefined || pointer === '') return { found: true, value: root }
  if (!pointer.startsWith('/')) return { found: false }
  let value = root
  for (const raw of pointer.slice(1).split('/')) {
    const key = raw.replace(/~1/g, '/').replace(/~0/g, '~')
    if (Array.isArray(value) && /^(0|[1-9]\d*)$/.test(key) && Number(key) < value.length) value = value[Number(key)]
    else if (isObject(value) && Object.hasOwn(value, key)) value = value[key]
    else return { found: false }
  }
  return { found: true, value }
}

/**
 * A single-level patch, as data-fair's own APIs patch a resource: each top-level key of
 * `patch` replaces the document's key entirely, objects and arrays included, and `null`
 * deletes it. Keys are defined, not assigned, so a `__proto__` key in a patch is stored as
 * data rather than replacing the result's prototype.
 * @param {unknown} target
 * @param {Record<string, unknown>} patch
 * @returns {Record<string, unknown>}
 */
export function patchTopLevel (target, patch) {
  /** @type {Record<string, unknown>} */
  const result = isObject(target) ? { ...target } : {}
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) delete result[key]
    else Object.defineProperty(result, key, { value: structuredClone(value), enumerable: true, writable: true, configurable: true })
  }
  return result
}

/**
 * @param {string} text
 * @param {boolean} [isError]
 * @returns {ToolResult}
 */
const answer = (text, isError = false) => ({ content: [{ type: 'text', text }], isError })

const pathInput = (/** @type {string} */ description) => ({
  type: 'object',
  properties: { path: { type: 'string', description } }
})

/**
 * One line of a 400 answer. ajv's message alone does not say which property is unknown
 * or which values an enum allows; a real API's error names them, so the line does too.
 * @param {import('ajv').ErrorObject} error
 * @returns {string}
 */
function errorLine (error) {
  let line = `${error.instancePath || '(root)'} ${error.message}`
  if (error.params?.additionalProperty !== undefined) line += `: ${error.params.additionalProperty}`
  const missing = error.keyword === 'required' ? error.params?.missingProperty : undefined
  if (missing !== undefined && !String(error.message).includes(missing)) line += `: ${missing}`
  if (Array.isArray(error.params?.allowedValues)) line += `: ${error.params.allowedValues.map((v) => JSON.stringify(v)).join(', ')}`
  return line
}

/**
 * The lines of a 400 answer, from ajv's errors as the form's validate function reports them.
 *
 * json-layout's `errorMessage` keyword replaces errors with its own short texts ("required
 * information", "chose one") and no property, which suits a field under the form's eye but
 * tells an API caller nothing; the errors it wraps are reported instead. A closed list
 * written as `oneOf` of `const` fails once per option ("must be equal to constant") and
 * once on the `oneOf`: those fold into one line listing the allowed values, the generic
 * `oneOf` line dropped.
 * @param {import('ajv').ErrorObject[]} errors
 * @returns {string[]}
 */
export function errorLines (errors) {
  /** @type {import('ajv').ErrorObject[]} */
  const flat = []
  for (const error of errors) {
    if (error.keyword === 'errorMessage' && Array.isArray(error.params?.errors) && error.params.errors.length) flat.push(...error.params.errors)
    else flat.push(error)
  }
  /** @type {Map<string, { instancePath: string, values: unknown[] }>} */
  const enums = new Map()
  for (const error of flat) {
    const oneOf = error.keyword === 'const' && /^(.*\/oneOf)\/\d+\/const$/.exec(error.schemaPath)?.[1]
    if (!oneOf) continue
    const key = `${error.instancePath}\u0000${oneOf}`
    const group = enums.get(key) ?? { instancePath: error.instancePath, values: [] }
    group.values.push(error.params.allowedValue)
    enums.set(key, group)
  }
  /** @type {string[]} */
  const lines = []
  for (const error of flat) {
    if (error.keyword === 'const' && /\/oneOf\/\d+\/const$/.test(error.schemaPath)) continue
    if (error.keyword === 'oneOf') {
      const group = enums.get(`${error.instancePath}\u0000${error.schemaPath}`)
      if (group) {
        lines.push(`${group.instancePath || '(root)'} must be one of the allowed values: ${group.values.map((v) => JSON.stringify(v)).join(', ')}`)
        enums.delete(`${error.instancePath}\u0000${error.schemaPath}`)
        continue
      }
    }
    lines.push(errorLine(error))
  }
  // const failures whose oneOf line was not reported still name their values
  for (const group of enums.values()) {
    lines.push(`${group.instancePath || '(root)'} must be one of the allowed values: ${group.values.map((v) => JSON.stringify(v)).join(', ')}`)
  }
  return [...new Set(lines)]
}

/** What a plain read of the schema may answer whole, in bytes; past it, an outline. */
export const OUTLINE_BUDGET_BYTES = 16_000

/** @param {unknown[] | string[]} keys */
const keyList = (keys) => keys.slice(0, 40).join(', ') + (keys.length > 40 ? ', …' : '')

/**
 * The 404 text of a pointer that resolves to nothing: the deepest level that exists and
 * what it holds, so the caller can correct the path.
 * @param {unknown} root
 * @param {unknown} path
 * @returns {string}
 */
function notFound (root, path) {
  const pointer = typeof path === 'string' ? path : ''
  const parts = pointer.startsWith('/') ? pointer.slice(1).split('/') : []
  let deepest = ''
  let value = root
  for (const part of parts) {
    const next = resolvePointer(value, '/' + part)
    if (!next.found) break
    value = next.value
    deepest += '/' + part
  }
  const keys = isObject(value) ? Object.keys(value) : Array.isArray(value) ? value.map((_, i) => String(i)) : []
  return `404 Not Found: ${pointer}; the deepest existing level is ${deepest || '(root)'} with keys: ${keyList(keys)}`
}

/**
 * An oversized schema, as its outline: each top-level property, `required` and the `$defs`
 * names, with how to read a part.
 * @param {Record<string, any>} schema
 * @returns {string}
 */
function schemaOutline (schema) {
  const lines = [`The schema is too long to be read whole (type ${schema.type ?? 'unspecified'}). Its outline:`, '', 'properties (key, type, title):']
  for (const [key, property] of Object.entries(isObject(schema.properties) ? schema.properties : {})) {
    const p = /** @type {Record<string, any>} */ (isObject(property) ? property : {})
    const type = Array.isArray(p.type) ? p.type.join('|') : (p.type ?? (p.$ref ? `$ref ${p.$ref}` : p.oneOf ? 'oneOf' : p.anyOf ? 'anyOf' : 'unspecified'))
    lines.push(`- ${key}: ${type}${typeof p.title === 'string' ? ` — ${p.title}` : ''}`)
  }
  if (Array.isArray(schema.required)) lines.push('', `required: ${schema.required.join(', ')}`)
  if (isObject(schema.$defs)) lines.push('', `$defs: ${Object.keys(schema.$defs).join(', ')}`)
  lines.push('', 'Read a part with a pointer: /properties/<key>, /$defs/<name>.')
  return lines.join('\n')
}

/** The document tools every case has; its lookups come after them. */
export const API_TOOL_NAMES = ['readDocument', 'readSchema', 'writeDocument', 'patchDocument']

/**
 * The API's description in the runner's prompt: what an API's reference page would say
 * before its endpoints. No procedure, no hint about the goal.
 * @param {string[]} lookups - the case's lookup tools, named as the service offers them
 * @returns {string}
 */
function apiDescription (lookups) {
  const others = lookups.length
    ? `\n\nThe same service also offers ${lookups.length === 1 ? 'a tool' : 'tools'} to look up the other resources the document refers to: ${lookups.join(', ')}.`
    : ''
  return `## The API

The document is stored by an API that offers four tools: readDocument and readSchema read
the document and the JSON schema it must follow, writeDocument replaces the document, and
patchDocument replaces some of its top-level keys.${others}

Every write is validated against the JSON schema and refused with the validation errors
when the document would be invalid. Annotations in the schema meant for editing
interfaces (layout, display conditions, suggestion lists) are not enforced by the API.`
}

export class PlainApiSession {
  /** @type {EvalCase} */
  _case
  /** @type {import('ajv').ValidateFunction} */
  _validate
  /** @type {unknown} */
  _data
  /** @type {ApiTool[]} */
  _tools
  /** @type {string} */
  _prompt
  /** @type {RecordedCall[]} */
  calls = []
  /** @type {string} */
  startedAt = new Date().toISOString()

  /**
   * @param {EvalCase} evalCase
   * @param {EvalSessionOptions} [options]
   */
  constructor (evalCase, options = {}) {
    this._case = evalCase
    const compiled = compile(evalCase.schema, evalCase.compileOptions)
    // the validate function the form's root node uses, so both arms share one ajv setup
    this._validate = compiled.validates[compiled.skeletonTrees[compiled.mainTree].refPointer]
    this.start = structuredClone(evalCase.data)
    this._data = structuredClone(evalCase.data)
    const baseURL = options.dataFairURL ?? process.env.JL_WEBMCP_EVAL_DATA_FAIR ?? DEFAULT_DATA_FAIR_URL
    const lookups = createLookupTools(evalCase, { fetch: options.fetch, baseURL })
    this._tools = [...this._makeTools(), ...lookups]
    // the guide compile hands the form arm, so both read the same domain text
    const guide = compiled.agentGuide?.trim()
    this._prompt = [
      PLAIN_RUNNER_PROMPT,
      apiDescription(lookups.map((t) => t.name)),
      ...(guide ? [`## About this ${evalCase.title}\n\n${guide}`] : [])
    ].join('\n\n')
  }

  /** @returns {ApiTool[]} */
  _makeTools () {
    return [
      {
        name: 'readDocument',
        description: 'Read the stored document as JSON. Pass `path`, a JSON pointer (RFC 6901, e.g. "/address/city" or "/items/0"), to read only the value there; omit it for the whole document. A path that holds no value answers 404 Not Found.',
        inputSchema: pathInput('JSON pointer into the document. Omit for the whole document.'),
        execute: async (args) => this._read(this._data, args?.path)
      },
      {
        name: 'readSchema',
        description: 'Read the JSON schema the API validates the document against, as JSON. Pass `path`, a JSON pointer into the schema (e.g. "/properties" or "/$defs/address"), to read only that part; omit it for the whole schema, which can be long. Besides standard JSON schema keywords, the schema may carry annotations meant for editing interfaces: layout hints, display conditions, URLs listing suggested values. The API does not enforce them when validating.',
        inputSchema: pathInput('JSON pointer into the schema. Omit for the whole schema.'),
        execute: async (args) => this._readSchema(args?.path)
      },
      {
        name: 'writeDocument',
        description: 'Replace the whole document. `document` is the complete new JSON object: every key you leave out is removed. The API validates it against the schema: when valid it is stored and the answer is `200 OK`; otherwise the answer is `400 Bad Request` followed by one line per error (`<JSON pointer> <message>`), and the stored document is left unchanged.',
        inputSchema: {
          type: 'object',
          properties: { document: { type: 'object', description: 'The complete new document.' } },
          required: ['document']
        },
        execute: async (args) => {
          const document = parseIfJsonString(args?.document)
          if (!isObject(document)) return answer('400 Bad Request\ndocument must be a JSON object', true)
          return this._store(document)
        }
      },
      {
        name: 'patchDocument',
        description: 'Change some top-level keys of the document. `patch` is a JSON object: each key given replaces that key\'s current value, `null` removes the key, and keys left out are kept. Array and object fields replace the current value entirely: read it first (readDocument with its path) and send the complete new value. The patched document is validated like writeDocument: `200 OK` when stored, `400 Bad Request` with one line per error otherwise, the stored document then left unchanged.',
        inputSchema: {
          type: 'object',
          properties: { patch: { type: 'object', description: 'The top-level keys to replace, with their complete new values.' } },
          required: ['patch']
        },
        execute: async (args) => {
          const patch = parseIfJsonString(args?.patch)
          if (!isObject(patch)) return answer('400 Bad Request\npatch must be a JSON object', true)
          return this._store(patchTopLevel(this._data, patch))
        }
      }
    ]
  }

  /**
   * @param {unknown} root
   * @param {unknown} path
   * @returns {ToolResult}
   */
  _read (root, path) {
    const resolved = resolvePointer(root, typeof path === 'string' ? path : undefined)
    if (!resolved.found) return answer(notFound(root, path), true)
    return answer(JSON.stringify(resolved.value))
  }

  /**
   * The schema at a pointer; the whole schema, when it exceeds the budget, as an outline.
   * @param {unknown} path
   * @returns {ToolResult}
   */
  _readSchema (path) {
    if ((path === undefined || path === '') && JSON.stringify(this._case.schema).length > OUTLINE_BUDGET_BYTES) {
      return answer(schemaOutline(/** @type {Record<string, any>} */ (this._case.schema)))
    }
    return this._read(this._case.schema, path)
  }

  /**
   * @param {unknown} candidate
   * @returns {ToolResult}
   */
  _store (candidate) {
    // a clone, so a tolerance that edits in place cannot touch the stored document
    const document = this._case.apiAccepts ? this._case.apiAccepts(structuredClone(candidate)) : candidate
    if (!this._validate(document)) {
      const errors = errorLines(this._validate.errors ?? [])
      return answer(['400 Bad Request', ...errors].join('\n'), true)
    }
    this._data = document
    return answer(`200 OK\nstored ${Object.keys(/** @type {object} */ (document)).length} top-level key(s)`)
  }

  /** @returns {ApiTool[]} */
  get tools () { return this._tools }

  /** @returns {string[]} */
  get toolNames () { return this._tools.map((t) => t.name) }

  /**
   * The runner's whole system prompt: the task, the API, and the schema's own guide.
   * @returns {string}
   */
  get prompt () { return this._prompt }

  /** @returns {unknown} */
  get data () { return this._data }

  /** @returns {boolean} */
  get valid () { return !!this._validate(this._data) }

  /**
   * Run one tool call, recording what it cost.
   * @param {string} name
   * @param {Record<string, unknown>} args
   * @returns {Promise<ToolResult>}
   */
  async call (name, args) {
    const tool = this._tools.find((t) => t.name === name)
    const result = tool
      ? await tool.execute(args)
      : answer(`unknown tool "${name}", available: ${this.toolNames.join(', ')}`, true)
    const text = result.content.map((part) => part.text).join('')
    this.calls.push({
      tool: name,
      args,
      response: text,
      outputBytes: Buffer.byteLength(text, 'utf8'),
      isError: !!result.isError
    })
    return result
  }

  /** @returns {number} */
  get totalOutputBytes () {
    return this.calls.reduce((sum, c) => sum + c.outputBytes, 0)
  }

  /** @returns {PlainEvidence} */
  evidence () {
    return {
      case: this._case.name,
      goal: this._case.goal,
      arm: 'plain',
      startedAt: this.startedAt,
      start: this.start,
      calls: this.calls,
      data: this.data,
      checks: runChecks(this._case.checks ?? [], this.data, this.start),
      valid: this.valid,
      metrics: {
        toolCalls: this.calls.length,
        outputBytes: this.totalOutputBytes
      }
    }
  }

  /** @returns {string} */
  report () {
    const lines = [`eval case "${this._case.name}" (plain API) — ${this.calls.length} calls, ${this.totalOutputBytes} bytes, valid=${this.valid}`]
    for (const [i, call] of this.calls.entries()) {
      lines.push(`  ${i + 1}. ${call.tool}${call.isError ? ' (error)' : ''} ${JSON.stringify(call.args)} → ${call.outputBytes}b`)
    }
    return lines.join('\n')
  }
}
