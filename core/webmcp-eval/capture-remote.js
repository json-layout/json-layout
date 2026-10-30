/**
 * @file One-off capture of the remote lists a case's pickers request, for serving offline.
 *
 * Run by hand, never by tests: `node webmcp-eval/capture-remote.js calendar`. It drives an
 * EvalSession over the live data-fair instance (`JL_WEBMCP_EVAL_DATA_FAIR`, koumoul.com by
 * default) through the pickers the goal needs, the way an agent would, and records every
 * response under `cases/data/<case>-remote/`: one JSON file per URL, and `index.json`
 * mapping each URL's key (see `remoteKey`) to its file. The case's `remote` serves them.
 *
 * Responses are kept whole: the dataset object a picker stores carries the dataset's whole
 * column schema, and that size is part of what the case measures. Only the columns' sample
 * values are replaced (see `anonymizeCapture`): they hold the personal data of real records.
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { EvalSession } from './session.js'
import { getCase } from './cases/index.js'
import { anonymizeCapture, remoteKey } from './remote.js'

const here = dirname(fileURLToPath(import.meta.url))

/**
 * @typedef {object} CaptureStep
 * @property {string} file - basename of the response, stable across captures
 * @property {(session: EvalSession) => Promise<void>} run - the calls that make the form request it
 */

/**
 * @param {EvalSession} session
 * @param {string} path
 * @param {string} query
 */
async function suggest (session, path, query) {
  const result = await session.call('getFieldSuggestions', { path, query })
  if (result.isError) throw new Error(`getFieldSuggestions ${path} "${query}": ${result.content[0].text}`)
  return result.content[0].text
}

/**
 * @param {EvalSession} session
 * @param {Record<string, unknown>} args
 */
async function set (session, args) {
  const result = await session.call('setFieldValue', args)
  if (result.isError) throw new Error(`setFieldValue ${JSON.stringify(args)}: ${result.content[0].text}`)
}

/** @type {Record<string, CaptureStep[]>} */
const captures = {
  calendar: [
    { file: 'datasets', run: (s) => suggest(s, '/$allOf-0/datasets/0', '').then(() => {}) },
    { file: 'datasets-agenda', run: (s) => suggest(s, '/$allOf-0/datasets/0', 'agenda').then(() => {}) },
    {
      file: 'datasets-agenda-manifestations',
      run: async (s) => {
        const text = await suggest(s, '/$allOf-0/datasets/0', 'Agenda-manifestations')
        // one suggestion per line: "- [<index>] <title> (<href>) — apply with ..."
        const match = /^- \[(\d+)\] Agenda-manifestations \(/m.exec(text)
        if (!match) throw new Error(`"Agenda-manifestations" not among the suggestions:\n${text}`)
        await set(s, { path: '/$allOf-0/datasets/0', suggestionIndex: Number(match[1]) })
      }
    },
    { file: 'agenda-manifestations-schema', run: (s) => suggest(s, '/$allOf-1/labelField', '').then(() => {}) },
    {
      file: 'contribs-datasets',
      run: async (s) => {
        await set(s, { path: '/$allOf-3/crowdSourcing', value: true })
        await suggest(s, '/$allOf-3/contribsDataset', '')
      }
    }
  ]
}

/**
 * URLs no picker requests but an agent writing them by hand plausibly does, fetched
 * directly once the steps ran: the chosen dataset's schema without `calculated=false`.
 * @type {Record<string, (session: EvalSession) => { file: string, url: string }[]>}
 */
const extraURLs = {
  calendar: (session) => {
    const href = /** @type {any} */ (session.data).datasets?.[0]?.href
    return href ? [{ file: 'agenda-manifestations-schema-all', url: `${href}/schema` }] : []
  }
}

/** Capture the case named on the command line. */
async function main () {
  const name = process.argv[2]
  if (!name || !captures[name]) throw new Error(`usage: capture-remote.js <case>, available: ${Object.keys(captures).join(', ')}`)
  const evalCase = getCase(name)
  /** @type {{ url: string, body: unknown }[]} */
  let requested = []
  const session = new EvalSession({ ...evalCase, remote: undefined }, {
    fetch: async (/** @type {string} */ url) => {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${url}`)
      const body = await res.json()
      requested.push({ url, body })
      return body
    }
  })
  const dir = join(here, 'cases', 'data', `${name}-remote`)
  mkdirSync(dir, { recursive: true })
  /** @type {Record<string, string>} */
  const index = {}
  /**
   * @param {string} file
   * @param {{ url: string, body: unknown }[]} responses
   */
  const store = (file, responses) => {
    for (const [i, { url, body }] of responses.entries()) {
      const key = remoteKey(new URL(url))
      if (index[key]) continue
      const basename = `${file}${i ? `-${i}` : ''}.json`
      writeFileSync(join(dir, basename), JSON.stringify(anonymizeCapture(body)) + '\n')
      index[key] = basename
      console.log(`${key} → ${basename}`)
    }
  }
  for (const step of captures[name]) {
    requested = []
    await step.run(session)
    if (!requested.length) throw new Error(`step ${step.file} requested nothing`)
    store(step.file, requested)
  }
  for (const { file, url } of extraURLs[name]?.(session) ?? []) {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${url}`)
    store(file, [{ url, body: await res.json() }])
  }
  writeFileSync(join(dir, 'index.json'), JSON.stringify(index, null, 2) + '\n')
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
