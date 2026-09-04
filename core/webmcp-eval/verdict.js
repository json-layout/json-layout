/**
 * @file Parse and validate a judge's verdict.
 *
 * The judge is a language model, so its output is untrusted text. Validating here means
 * a malformed verdict fails loudly at parse time rather than silently producing an empty
 * friction list that reads as "no problems found".
 */

/** @typedef {import('./cases/types.js').EvalCase} EvalCase */

const VERDICTS = ['satisfactory', 'unsatisfactory']
const SEVERITIES = ['high', 'medium', 'low']

/**
 * @param {string} text
 * @returns {object}
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
    if (!Number.isInteger(point?.call)) throw new Error(`friction[${i}].call must be the 1-based call number`)
    if (typeof point.tool !== 'string') throw new Error(`friction[${i}].tool must name the tool`)
    if (typeof point.observed !== 'string') throw new Error(`friction[${i}].observed must quote what the tool returned`)
    if (typeof point.inferred !== 'string') throw new Error(`friction[${i}].inferred must say what the agent apparently concluded`)
    if (!SEVERITIES.includes(point.severity)) {
      throw new Error(`friction[${i}].severity must be one of ${SEVERITIES.join(', ')}`)
    }
  }

  return parsed
}
