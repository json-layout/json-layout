/**
 * @file A plain JSON API over one eval case, the baseline the form tools are compared with.
 *
 * Same case, same starting document, same recording as EvalSession: only the tools and
 * the prompt differ. The tools are what a well-made JSON API offers — read, replace,
 * merge-patch, GET — described as completely as a careful API user needs, and writes are
 * validated by the very ajv function the form compiles from the case, so neither arm
 * validates more strictly than the other.
 */

import { compile } from '../src/compile/index.js'
import { caseFetch } from './remote.js'
import { DEFAULT_DATA_FAIR_URL } from './session.js'
import { PLAIN_RUNNER_PROMPT } from './prompts.js'

/** @typedef {import('./cases/types.js').EvalCase} EvalCase */
/** @typedef {import('./session.js').RecordedCall} RecordedCall */
/** @typedef {import('./session.js').EvalSessionOptions} EvalSessionOptions */
/** @typedef {import('./session.js').EvalEvidence & { arm: 'plain', start: unknown }} PlainEvidence */

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
 * RFC 7396 JSON merge patch.
 * @param {unknown} target
 * @param {unknown} patch
 * @returns {unknown}
 */
export function mergePatch (target, patch) {
  if (!isObject(patch)) return structuredClone(patch)
  const result = isObject(target) ? { ...target } : {}
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) delete result[key]
    else result[key] = mergePatch(result[key], value)
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

export const API_TOOL_NAMES = ['readDocument', 'readSchema', 'writeDocument', 'patchDocument', 'httpGet']

/**
 * The API's description in the runner's prompt: what an API's reference page would say
 * before its endpoints. No procedure, no hint about the goal.
 */
const API_DESCRIPTION = `## The API

The document is stored by an API that offers five tools: readDocument and readSchema read
the document and the JSON schema it must follow, writeDocument replaces the document,
patchDocument changes part of it with a JSON merge patch, and httpGet fetches other
resources of the same service, such as the lists of values some schema annotations point
to. The resource at the URL \`context\` (httpGet) holds the values the schema refers to as
\`context\`.

Every write is validated against the JSON schema and refused with the validation errors
when the document would be invalid. Annotations in the schema meant for editing
interfaces (layout, display conditions, suggestion lists) are not enforced by the API.`

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
    const fixtureOrInjected = caseFetch(evalCase, options)
    const baseURL = options.dataFairURL ?? process.env.JL_WEBMCP_EVAL_DATA_FAIR ?? DEFAULT_DATA_FAIR_URL
    this._tools = this._makeTools(fixtureOrInjected, baseURL)
    // the guide compile hands the form arm, so both read the same domain text
    const guide = compiled.agentGuide?.trim()
    this._prompt = [
      PLAIN_RUNNER_PROMPT,
      API_DESCRIPTION,
      ...(guide ? [`## About this ${evalCase.title}\n\n${guide}`] : [])
    ].join('\n\n')
  }

  /**
   * @param {((url: string) => Promise<any>) | undefined} fixtureOrInjected
   * @param {string} baseURL - the data-fair base, for cases without a fixture
   * @returns {ApiTool[]}
   */
  _makeTools (fixtureOrInjected, baseURL) {
    return [
      {
        name: 'readDocument',
        description: 'Read the stored document as JSON. Pass `path`, a JSON pointer (RFC 6901, e.g. "/address/city" or "/items/0"), to read only the value there; omit it for the whole document. A path that holds no value answers 404 Not Found.',
        inputSchema: pathInput('JSON pointer into the document. Omit for the whole document.'),
        execute: async (args) => this._read(this._data, args?.path)
      },
      {
        name: 'readSchema',
        // the URL templates are quoted as the schema spells them
        // eslint-disable-next-line no-template-curly-in-string
        description: 'Read the JSON schema the API validates the document against, as JSON. Pass `path`, a JSON pointer into the schema (e.g. "/properties" or "/$defs/address"), to read only that part; omit it for the whole schema, which can be long. Besides standard JSON schema keywords, the schema may carry annotations meant for editing interfaces: layout hints, display conditions, URLs listing suggested values (possibly with `${...}` templates reading the `context` resource). The API does not enforce them when validating; the URLs can be fetched with httpGet.',
        inputSchema: pathInput('JSON pointer into the schema. Omit for the whole schema.'),
        execute: async (args) => this._read(this._case.schema, args?.path)
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
        description: 'Change part of the document with a JSON merge patch (RFC 7396). `patch` is a JSON object: each key given replaces that key\'s value, nested objects are merged recursively, `null` deletes the key, and an array replaces the existing array whole (to change one item, send the whole array). Keys left out are kept. The patched document is validated like writeDocument: `200 OK` when stored, `400 Bad Request` with one line per error otherwise, the stored document then left unchanged.',
        inputSchema: {
          type: 'object',
          properties: { patch: { type: 'object', description: 'The JSON merge patch.' } },
          required: ['patch']
        },
        execute: async (args) => {
          const patch = parseIfJsonString(args?.patch)
          if (!isObject(patch)) return answer('400 Bad Request\npatch must be a JSON object (RFC 7396 merge patch)', true)
          return this._store(mergePatch(this._data, patch))
        }
      },
      {
        name: 'httpGet',
        // the URL templates are quoted as the schema spells them
        // eslint-disable-next-line no-template-curly-in-string
        description: 'Send an HTTP GET request to the service and answer the JSON body. `url` is relative to the service\'s base URL, like the URLs found in the schema (e.g. "api/v1/datasets?q=bike"); fill in any `${...}` template yourself before sending. The special URL `context` answers the request context: the values the schema\'s templates and conditions refer to as `context`. A failed request answers its HTTP status.',
        inputSchema: {
          type: 'object',
          properties: { url: { type: 'string', description: 'URL relative to the service, or `context`.' } },
          required: ['url']
        },
        execute: async (args) => {
          const url = args?.url
          if (typeof url !== 'string' || !url) return answer('400 Bad Request\nurl is required', true)
          if (url === 'context') return answer(JSON.stringify(this._case.context ?? {}))
          try {
            // a fixture resolves the URL itself: handing it the agent's own spelling keeps
            // the fixture base out of the error texts the agent reads
            if (this._case.remote && fixtureOrInjected) return answer(JSON.stringify(await fixtureOrInjected(url)))
            const absolute = new URL(url, baseURL).href
            if (fixtureOrInjected) return answer(JSON.stringify(await fixtureOrInjected(absolute)))
            const res = await fetch(absolute)
            if (!res.ok) return answer(`${res.status} ${res.statusText}: ${url}`, true)
            return answer(JSON.stringify(await res.json()))
          } catch (err) {
            return answer(err instanceof Error ? err.message : String(err), true)
          }
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
    if (!resolved.found) return answer(`404 Not Found: no value at ${path}`, true)
    return answer(JSON.stringify(resolved.value))
  }

  /**
   * @param {unknown} candidate
   * @returns {ToolResult}
   */
  _store (candidate) {
    const document = this._case.apiAccepts ? this._case.apiAccepts(candidate) : candidate
    if (!this._validate(document)) {
      const errors = (this._validate.errors ?? []).map((e) => `${e.instancePath || '(root)'} ${e.message}`)
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
