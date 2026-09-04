/**
 * @file Parse and validate a judge's verdict.
 *
 * The judge is a language model, so its output is untrusted text. Validating here means
 * a malformed verdict fails loudly at parse time rather than silently producing an empty
 * friction list that reads as "no problems found".
 */

/**
 * @typedef {object} FrictionPoint
 * @property {number} call - 1-based index of the call that caused the friction
 * @property {string} tool - the tool that was called
 * @property {string} observed - what that call returned, quoted
 * @property {string} inferred - what the agent apparently concluded from it
 * @property {'high'|'medium'|'low'} severity - how badly the response misled the agent
 */

/**
 * @typedef {object} Verdict
 * @property {string} case - the case the judge was given, checked against the case being reported
 * @property {'satisfactory'|'unsatisfactory'} verdict - whether the session found its way through the protocol
 * @property {string} reasoning - one paragraph explaining the verdict
 * @property {FrictionPoint[]} friction - the responses that misled the agent, possibly empty
 */

const VERDICTS = ['satisfactory', 'unsatisfactory']
const SEVERITIES = ['high', 'medium', 'low']

/**
 * @param {string} text
 * @returns {Verdict}
 */
export function parseVerdict (text) {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text)
  const raw = (fenced ? fenced[1] : text).trim()

  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error(`the judge's answer could not be parsed as JSON: ${raw.slice(0, 200)}`)
  }

  if (typeof parsed?.case !== 'string') throw new Error('verdict.case must be the case name')
  if (!VERDICTS.includes(parsed.verdict)) {
    throw new Error(`verdict must be one of ${VERDICTS.join(', ')}, got ${JSON.stringify(parsed.verdict)}`)
  }
  if (typeof parsed.reasoning !== 'string' || !parsed.reasoning.trim()) {
    throw new Error('verdict.reasoning must explain the verdict')
  }
  if (!Array.isArray(parsed.friction)) throw new Error('verdict.friction must be an array')

  for (const [i, point] of parsed.friction.entries()) {
    // Anchoring is what makes a friction point actionable: without a call number nobody
    // can find the response that misled the agent.
    // 1-based, so 0 and negatives are rejected too: `call 0` in the report anchors
    // nothing, and a judge that answered it has not pointed at a call.
    if (!Number.isInteger(point?.call) || point.call < 1) {
      throw new Error(`friction[${i}].call must be the 1-based call number`)
    }
    if (typeof point.tool !== 'string') throw new Error(`friction[${i}].tool must name the tool`)
    if (typeof point.observed !== 'string') throw new Error(`friction[${i}].observed must quote what the tool returned`)
    if (typeof point.inferred !== 'string') throw new Error(`friction[${i}].inferred must say what the agent apparently concluded`)
    if (!SEVERITIES.includes(point.severity)) {
      throw new Error(`friction[${i}].severity must be one of ${SEVERITIES.join(', ')}`)
    }
  }

  return parsed
}
