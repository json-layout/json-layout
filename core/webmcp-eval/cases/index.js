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
 * A document a case starts from.
 *
 * Every one of these was PRODUCED BY AN AGENT through these tools and then kept, rather
 * than written by hand: a starting document invented alongside the case would be a guess
 * about what the form accepts, and a case that begins from an invalid document measures
 * the harness rather than the protocol.
 * @param {string} file
 * @returns {Record<string, unknown>}
 */
function loadData (file) {
  return JSON.parse(readFileSync(join(here, 'data', file), 'utf8'))
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
  data: {}
}

/**
 * What a deployed data-fair app puts in its expression context: it runs under one owner
 * and its dataset pickers query `api/v1/datasets?...&${context.datasetFilter}`. Both
 * goals name public datasets of Grand Poitiers on koumoul.com, so both cases run under
 * that owner. Without the filter the picker answers out of the whole public instance and
 * the named dataset is lost among thousands.
 *
 * The charts schema's picker URL also carried `&sort=createdAt:-1`, which overrode the
 * relevance ordering `q` exists to produce: a query made of a dataset's own exact title
 * returned twelve unrelated datasets and none of them it, which the judge rated a
 * high-severity dead end. Dropped here to match the fix being made in the app itself.
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
  context: grandPoitiersContext
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
  context: grandPoitiersContext
}

/**
 * The page editor of data-fair/portals: the only case with an array the agent must build
 * from empty, and the only one that recurses — a layout element contains elements, without
 * bound. That makes it the only exercise of editArray, and of a 39-branch discriminated
 * union.
 *
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
  compileOptions: { locale: 'fr', xI18n: true, ajvOptions: { discriminator: true } }
}

/**
 * Changing a chart that already works, rather than building one.
 *
 * The four other cases all start from {} and measure construction. This measures the other
 * half, and it is the half a config editor mostly does: the value to change sits five
 * levels down a discriminated union that is ALREADY on the right branch, so nothing has to
 * be activated and there is no error to follow — the agent has to find a setting by
 * reading, not by fixing what the form complains about.
 * @type {EvalCase}
 */
const chartsEdit = {
  name: 'charts-edit',
  title: 'chart configuration',
  goal: 'This chart averages the pollutant values per commune. Show the maximum instead, and move the legend to the bottom.',
  schema: v2compat(loadSchema('app-charts.json'), undefined, 'fr'),
  data: loadData('charts-edit.json'),
  compileOptions: { locale: 'fr', ajvOptions: { discriminator: true } },
  context: { datasetFilter: 'owner=organization:p6Qg1z-aq' }
}

/**
 * Removing part of a page that already exists.
 *
 * The only case that asks an agent to take something away, so the only one that reaches
 * editArray's "remove" action — which no agent had ever called before this case was added,
 * across every run the harness has recorded. Removal is where a wrong index is silently
 * destructive rather than merely wrong, and the page's three elements make the index
 * ambiguous enough to be worth checking.
 * @type {EvalCase}
 */
const portalPageEdit = {
  name: 'portal-page-edit',
  title: 'page configuration',
  goal: 'Delete the "Mentions légales" block from this page, and rename the page to "Données ouvertes".',
  schema: loadSchema('portal-page.json'),
  data: loadData('portal-page-edit.json'),
  compileOptions: { locale: 'fr', xI18n: true, ajvOptions: { discriminator: true } }
}

/**
 * Discriminated unions whose default branch is the wrong one, and which error while you
 * work in them.
 *
 * Every other union in the suite is either already on the branch the goal needs
 * (charts-edit) or chosen from an empty slot with nothing standing against it (charts,
 * portal-page). Adding an indicator here lands on the schema's default, `{"type": "enum"}`,
 * whose `enumOptions.field` is required — so from the moment the item exists the form is
 * invalid and complaining about a branch the goal does not want. Getting anywhere means
 * switching off an erroring default, and then reading what the new branch reports as a
 * to-do list rather than as damage the switch did. It happens twice: the value calculation
 * inside the chosen branch defaults to "Nombre de lignes" and has to become "Valeurs d'une
 * colonne", which reveals a required field of its own.
 *
 * This is app-choropleth-map's shape, and it is where a real session lost itself: it sent
 * the variant index as the string "0", which the tools wrote as data instead of switching
 * — a $oneOf node's value being the object around it, "0" was merged into that object as
 * {"0":"0"} — and then spent fifteen identical calls trying to understand an answer that
 * said "no error here, form is valid" every time. The tools were corrected; the case is
 * here so the shape stays covered rather than remembered.
 *
 * It starts from a configured map rather than from {} because the `datasets` array that
 * gates `joinColumn` is not maintained by the schema: the page consolidates it from the
 * geometries and indicator datasets in a watcher (src/composables/config.ts), and without a
 * page nothing fills it, leaving joinColumn hidden and every values picker below it unable
 * to resolve. The starting document was produced through these tools — outlines chosen from
 * the picker, `datasets` set as the watcher sets it, join column chosen from the schema of
 * the dataset that produced it — so it is a document the form accepts rather than a guess.
 *
 * Vendored on 2026-09-12 from koumoul/app-choropleth-map @ a176b65, src/config/schema.json —
 * the source, whose `#/definitions` refs json-layout resolves itself, rather than the
 * generated public/config-schema.json. The unions carry a `discriminator` keyword but their
 * branches do not put the tag in `required`, which ajv's discriminator support demands, so
 * this is the one app case compiled WITHOUT that option: json-layout resolves the branches
 * from their distinct `const` instead, exactly as the deployed page does. Its layouts use
 * the modern `layout` keyword, so unlike calendar and charts-edit it needs no v2 pass.
 *
 * The goal names a public koumoul.com dataset carrying a commune code and a numeric index,
 * so the join has both halves without credentials.
 * @type {EvalCase}
 */
const choropleth = {
  name: 'choropleth',
  title: 'choropleth map configuration',
  goal: 'This map already outlines the communes. Shade them by their digital fragility index, taking the values from the "Indice de Fragilité Numérique" dataset, and label that indicator "Fragilité numérique".',
  schema: loadSchema('app-choropleth.json'),
  data: loadData('choropleth.json'),
  compileOptions: { locale: 'fr' },
  context: { datasetFilter: '' }
}

/** @type {EvalCase[]} */
export const cases = [contact, calendar, charts, portalPage, chartsEdit, portalPageEdit, choropleth]

/**
 * @param {string} name
 * @returns {EvalCase}
 */
export function getCase (name) {
  const found = cases.find((c) => c.name === name)
  if (!found) throw new Error(`unknown eval case "${name}", available: ${cases.map((c) => c.name).join(', ')}`)
  return found
}
