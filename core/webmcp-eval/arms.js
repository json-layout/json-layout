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
