/**
 * @file Eval cases: forms an agent is asked to fill through the WebMCP tools.
 *
 * Each case is a schema and a goal phrased as a user would phrase it. There is
 * deliberately no expected result: a run is judged by reading its transcript, not by
 * comparing its data to a blob written by whoever wrote the case. The declared band and
 * schema-fit are assertions about the case itself, checked in CI so a case cannot drift
 * into claiming a branch it never reaches.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** @typedef {import('./types.js').EvalCase} EvalCase */

const here = dirname(fileURLToPath(import.meta.url))

/**
 * @param {string} file
 * @returns {Record<string, unknown>}
 */
function loadSchema (file) {
  return JSON.parse(readFileSync(join(here, 'schemas', file), 'utf8'))
}

/**
 * Small hand-written control. Fast, and the only case whose shape is fully under our
 * control, which makes it the one to reach for when debugging the harness itself.
 * @type {EvalCase}
 */
const contact = {
  name: 'contact',
  title: 'contact form',
  goal: 'Fill in the contact form for Ada Lovelace, born in 1815, email ada@analytical.org, who prefers to be contacted by email.',
  schema: {
    type: 'object',
    title: 'Contact',
    required: ['name', 'email'],
    properties: {
      name: { type: 'string', title: 'Full name' },
      birthYear: { type: 'integer', title: 'Year of birth', minimum: 1800, maximum: 2100 },
      email: { type: 'string', title: 'Email', format: 'email' },
      contactMethod: { type: 'string', title: 'Preferred contact method', enum: ['email', 'phone', 'post'] }
    }
  },
  data: {},
  expectedComplexity: 'small',
  expectedSchemaFits: true
}

/**
 * Real app schema, large band but small enough that getSchema still returns it whole.
 * The pair with `charts` is the point: same band, opposite schema behaviour, which is
 * the evidence that the band alone says nothing about what an agent can read.
 * @type {EvalCase}
 */
const calendar = {
  name: 'calendar',
  title: 'calendar configuration',
  goal: 'Set up the calendar on the events dataset, use the event name column as the label shown on each event, and turn on crowd sourcing so visitors can propose new events.',
  schema: loadSchema('app-calendar.json'),
  data: {},
  expectedComplexity: 'large',
  expectedSchemaFits: true
}

/**
 * Real app schema large enough that getSchema refuses it, so the agent has to navigate
 * by path. The only case that reaches that branch.
 * @type {EvalCase}
 */
const charts = {
  name: 'charts',
  title: 'chart configuration',
  goal: 'Make a bar chart of the average PM10 level per city from the air quality dataset, title it "PM10 by city" and put the legend on the right.',
  schema: loadSchema('app-charts.json'),
  data: {},
  expectedComplexity: 'large',
  expectedSchemaFits: false
}

/** @type {EvalCase[]} */
export const cases = [contact, calendar, charts]

/**
 * @param {string} name
 * @returns {EvalCase}
 */
export function getCase (name) {
  const found = cases.find((c) => c.name === name)
  if (!found) throw new Error(`unknown eval case "${name}", available: ${cases.map((c) => c.name).join(', ')}`)
  return found
}
