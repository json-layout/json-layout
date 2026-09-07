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
 * Real app schema large enough that getSchema refuses it whole. Note this describes the
 * schema, not the runs: no runner has yet called getSchema on it, because the guide
 * tells large-form agents to prefer describeState. Whether that advice is right is one
 * of the things the harness exists to find out, not something it presumes.
 *
 * The goal names a public koumoul.com dataset whose columns carry a commune, a pollutant
 * name and a measured value.
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

/**
 * The page editor of data-fair/portals, and the only case that reproduces a shipped
 * WebMCP configuration exactly: that page hands WebMCP no schema, so it has no getSchema
 * tool and its guide points at describeState instead — `withSchema: false` reproduces
 * that, and flipping it is how the harness measures whether shipping the schema would
 * earn its bundle size.
 *
 * It is also the only case with an array the agent must build from empty, and the only
 * one that recurses: a layout element contains elements, without bound. That makes it
 * the only exercise of editArray, and of a 39-branch discriminated union.
 *
 * Vendored on 2026-09-07 from data-fair/portals @ 19f3a68c, by loading every
 * `api/types/<name>/schema.{js,ts}` module, indexing them by $id, and inlining each external
 * `$ref` into `$defs` — rewriting refs relative to the document each subtree came from,
 * since a nested `#/$defs/color` belongs to its own schema and not to the root. Refresh
 * by repeating that against a newer checkout.
 *
 * Compiled with xI18n: without it the schema's x-i18n-* keywords leave the state tree
 * unable to settle and every editArray call fails with "too many iterations in
 * updateState". The markdown component the page registers through a vjsf plugin is not
 * registered here, so markdown fields fall back to a plain text field.
 * @type {EvalCase}
 */
const portalPage = {
  name: 'portal-page',
  title: 'page configuration',
  goal: 'Title the page "Nos données ouvertes", then add a two column section with a text block in each column: "Bienvenue" on the left and "Contactez-nous" on the right.',
  schema: loadSchema('portal-page.json'),
  data: {},
  compileOptions: { locale: 'fr', xI18n: true, ajvOptions: { discriminator: true } },
  withSchema: false,
  expectedComplexity: 'large',
  expectedSchemaFits: false
}

/** @type {EvalCase[]} */
export const cases = [contact, calendar, charts, portalPage]

/**
 * @param {string} name
 * @returns {EvalCase}
 */
export function getCase (name) {
  const found = cases.find((c) => c.name === name)
  if (!found) throw new Error(`unknown eval case "${name}", available: ${cases.map((c) => c.name).join(', ')}`)
  return found
}
