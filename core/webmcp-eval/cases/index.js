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

import { v2compat } from './vjsf-compat-v2.js'

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
 * What a deployed data-fair app puts in its expression context: it runs under one owner
 * and its dataset pickers query `api/v1/datasets?...&${context.datasetFilter}`. Both
 * goals name public datasets of Grand Poitiers on koumoul.com, so both cases run under
 * that owner. Without the filter the public instance answers a picker with its twelve
 * newest matches, and the named dataset is never among them.
 */
const grandPoitiersContext = { datasetFilter: 'owner=organization:p6Qg1z-aq' }

/**
 * Real app schema, large band but small enough that getSchema still returns it whole.
 * The pair with `charts` is the point: same band, opposite schema behaviour, which is
 * the evidence that the band alone says nothing about what an agent can read.
 *
 * Written for vjsf v2, so it goes through the same compatibility layer a real page
 * applies; see vjsf-compat-v2.js. The goal names a public koumoul.com dataset that is
 * REST-enabled with an event-name label column, so every part of it is reachable.
 * @type {EvalCase}
 */
const calendar = {
  name: 'calendar',
  title: 'calendar configuration',
  goal: 'Set up the calendar on the "Agenda-manifestations" dataset, use the event name column as the label shown on each event, and turn on crowd sourcing so visitors can propose new events.',
  schema: v2compat(loadSchema('app-calendar.json'), undefined, 'fr'),
  data: {},
  context: grandPoitiersContext,
  expectedComplexity: 'large',
  expectedSchemaFits: true
}

/**
 * Real app schema large enough that getSchema refuses it, so the agent has to navigate
 * by path. The only case that reaches that branch. The goal names a public koumoul.com
 * dataset whose columns carry a commune, a pollutant name and a measured value.
 * @type {EvalCase}
 */
const charts = {
  name: 'charts',
  title: 'chart configuration',
  goal: 'Make a bar chart of the average measured value per commune from the dataset of hourly air pollutant concentrations in Poitiers, title it "Pollution by commune" and put the legend on the right.',
  schema: loadSchema('app-charts.json'),
  data: {},
  context: grandPoitiersContext,
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
