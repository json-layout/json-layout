/**
 * @file The tool surfaces a case can be run under, and how to build one.
 *
 * Every arm has the same surface — `tools`, `toolNames`, `prompt`, `call`, `data`,
 * `valid`, `start`, `evidence()`, `report()` — so the launcher and the stdio server
 * treat them alike. `runnable` / `notRunnableReason` are only present on an arm that
 * can refuse a case (a session arm over an auto-save form).
 */

import { EvalSession, evidenceName } from './session.js'
import { PlainApiSession } from './plain-api.js'
import { FormSessionArm } from './session-arm.js'

/** @typedef {import('./cases/types.js').EvalCase} EvalCase */

/** `form` is the default and the one whose evidence names predate the others. */
export const ARMS = ['form', 'session', 'plain']

export { evidenceName }

/**
 * The MCP server name each arm is served under, the one place it is decided: it becomes
 * every tool name the runner sees (mcp__<name>__<tool>) and the server's own
 * `serverInfo.name`, so it names what the arm is — a page's form, a server's record form,
 * a document API — and never the evaluation, nor an arm's name.
 * @type {Record<string, string>}
 */
export const MCP_SERVER_NAMES = { form: 'page-form', session: 'record-form', plain: 'document-api' }

/**
 * @param {string} [arm] - defaults to `form`
 * @returns {string}
 */
export function mcpServerName (arm = 'form') {
  const name = MCP_SERVER_NAMES[arm]
  if (!name) throw new Error(`unknown arm "${arm}", available: ${ARMS.join(', ')}`)
  return name
}

/**
 * @param {EvalCase} evalCase
 * @param {string} arm
 * @returns {Promise<any>}
 */
export async function createArm (evalCase, arm) {
  if (arm === 'form') return new EvalSession(evalCase)
  if (arm === 'plain') return new PlainApiSession(evalCase)
  if (arm === 'session') return await FormSessionArm.create(evalCase)
  throw new Error(`unknown arm "${arm}", available: ${ARMS.join(', ')}`)
}

/**
 * Claude Code caps MCP output at 25,000 tokens; round 2 saw 95 KB responses cut, so a
 * conservative 2.4 bytes/token: a call past this was likely cut off.
 */
export const TRUNCATION_BYTES = 60_000

/** @typedef {'read-state'|'read-schema'|'write'|'lookup'|'other'} CallKind */

const FORM_KINDS = {
  describeState: 'read-state',
  getData: 'read-state',
  setData: 'write',
  setFieldValue: 'write',
  editArray: 'write',
  saveForm: 'write',
  getFieldSuggestions: 'lookup'
}

const PLAIN_KINDS = {
  readDocument: 'read-state',
  readSchema: 'read-schema',
  writeDocument: 'write',
  patchDocument: 'write',
  list_account_datasets: 'lookup',
  describe_dataset: 'lookup',
  get_field_values: 'lookup',
  list_portal_pages: 'lookup'
}

/**
 * What a tool call is for, so the cost of an arm can be read by kind of work.
 * @param {string} arm
 * @param {string} toolName
 * @returns {CallKind}
 */
export function callKind (arm, toolName) {
  const map = /** @type {Record<string, CallKind>} */(arm === 'plain' ? PLAIN_KINDS : FORM_KINDS)
  return Object.hasOwn(map, toolName) ? map[toolName] : 'other'
}
