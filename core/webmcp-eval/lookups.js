/**
 * @file The targeted lookup tools a plain API offers next to the document, one catalogue for
 * every case.
 *
 * An agent never gets a plain HTTP client: a server hands it targeted tools that build their
 * own requests. These are modelled loosely on data-fair's MCP tools (list_account_datasets,
 * describe_dataset, get_field_values) and on a portal's pages listing. A case names the ones
 * a real server would offer for its remote lists (`lookups`), and each reads the very source
 * the form's pickers read: the case fixture when it has one, else the live data-fair base,
 * under the case's owner filter (`context.datasetFilter`), or the case's `context.pages`.
 */

import { caseFetch } from './remote.js'

/** @typedef {import('./cases/types.js').EvalCase} EvalCase */
/** @typedef {import('./cases/types.js').LookupName} LookupName */
/** @typedef {import('./plain-api.js').ApiTool} ApiTool */
/** @typedef {import('./plain-api.js').ToolResult} ToolResult */

/** @type {LookupName[]} */
export const LOOKUP_NAMES = ['list_account_datasets', 'describe_dataset', 'get_field_values', 'list_portal_pages']

/**
 * The columns of a referential a line column picks its value from, as its search answers
 * them: data-fair's master-data single search returns an `output` (the code) and a label
 * spelled "code (name)".
 */
const REFERENTIAL_COLUMNS = ['code', 'nom']

/**
 * @param {string} text
 * @param {boolean} [isError]
 * @returns {ToolResult}
 */
const answer = (text, isError = false) => ({ content: [{ type: 'text', text }], isError })

/**
 * @param {unknown} value
 * @param {number} fallback
 * @param {number} max
 * @returns {number}
 */
function sizeOf (value, fallback, max) {
  const size = typeof value === 'string' ? Number(value) : value
  return typeof size === 'number' && Number.isInteger(size) && size > 0 ? Math.min(size, max) : fallback
}

/**
 * GET a service URL, answering the parsed JSON body: from the case fixture when there is
 * one (handed the URL as written, so the fixture base stays out of error texts), else
 * against the data-fair base, through the injected fetch or the network.
 * @param {EvalCase} evalCase
 * @param {{ fetch?: Function, baseURL: string }} options
 * @returns {(url: string) => Promise<any>}
 */
function serviceGet (evalCase, options) {
  const fixtureOrInjected = caseFetch(evalCase, { fetch: options.fetch })
  return async (url) => {
    if (evalCase.remote && fixtureOrInjected) return fixtureOrInjected(url)
    const absolute = new URL(url, options.baseURL).href
    if (fixtureOrInjected) return fixtureOrInjected(absolute)
    const res = await fetch(absolute)
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${url}`)
    return res.json()
  }
}

/**
 * Run a lookup, its failures answered as error text.
 * @param {() => Promise<unknown>} run
 * @returns {Promise<ToolResult>}
 */
async function attempt (run) {
  try {
    const value = await run()
    if (typeof value === 'string') return answer(value, true)
    return answer(JSON.stringify(value))
  } catch (err) {
    return answer(err instanceof Error ? err.message : String(err), true)
  }
}

/**
 * The query string of a dataset listing, the case's owner filter appended as the app's own
 * pickers append it.
 * @param {EvalCase} evalCase
 * @param {Record<string, string>} params
 * @returns {string}
 */
function withOwnerFilter (evalCase, params) {
  const query = new URLSearchParams(params).toString()
  const filter = evalCase.context?.datasetFilter
  return typeof filter === 'string' && filter ? `${query}&${filter}` : query
}

/**
 * The referential datasets the case's columns pick from: a column whose `x-master` names
 * `dataset:<id>` and whose suggestions come from `x-fromUrl`.
 * @param {EvalCase} evalCase
 * @returns {Map<string, Record<string, any>>} the picking column's schema, by dataset id
 */
function referentials (evalCase) {
  /** @type {Map<string, Record<string, any>>} */
  const found = new Map()
  const properties = /** @type {Record<string, any>} */ (evalCase.schema.properties ?? {})
  for (const property of Object.values(properties)) {
    const service = property?.['x-master']?.remoteService
    if (typeof service === 'string' && service.startsWith('dataset:') && typeof property['x-fromUrl'] === 'string') {
      found.set(service.slice('dataset:'.length), property)
    }
  }
  return found
}

/**
 * A dataset id as a schema writes it (`dataset:<id>`) or as a listing gives it (`<id>`).
 * @param {string} id
 * @returns {string}
 */
const bareId = (id) => id.startsWith('dataset:') ? id.slice('dataset:'.length) : id

/**
 * The 404 of an unknown dataset, naming the ids the case's remote data knows.
 * @param {EvalCase} evalCase
 * @param {string} id
 * @returns {string}
 */
function unknownDataset (evalCase, id) {
  const known = [...referentials(evalCase).keys()]
  return `404 Not Found: no dataset ${JSON.stringify(id)}${known.length ? `; known ids: ${known.join(', ')}` : ''}`
}

/**
 * @param {EvalCase} evalCase
 * @param {(url: string) => Promise<any>} get
 * @returns {Record<LookupName, ApiTool>}
 */
function catalogue (evalCase, get) {
  const datasetId = { type: 'string', description: 'The exact dataset id, from the "id" field of list_account_datasets results. Not the title or slug.' }
  const pages = /** @type {Record<string, any[]> | undefined} */ (evalCase.context?.pages)
  return {
    list_account_datasets: {
      name: 'list_account_datasets',
      description: 'List the datasets of the account, with optional full-text search. Without `q` it lists all of them, page by page (`count` is the total): a keyword can miss a dataset worded differently. Answers `{ count, results }`, each result with the dataset\'s `id`, `title`, `href` (its URL in the API) and `isRest` (true for an editable dataset whose lines are written through the API), plus its `slug`, `summary`, `status` and `count` (number of lines) when known. Use describe_dataset for its columns.',
      inputSchema: {
        type: 'object',
        properties: {
          q: { type: 'string', description: 'Keywords for full-text search (simple terms, not sentences).' },
          size: { type: 'integer', description: 'Number of results, 10 by default, 50 at most.' }
        }
      },
      execute: (args) => attempt(async () => {
        /** @type {Record<string, string>} */
        const params = {}
        if (typeof args?.q === 'string' && args.q) params.q = args.q
        params.size = String(sizeOf(args?.size, 10, 50))
        params.select = 'title,isRest,summary,status,count'
        const listing = await get(`api/v1/datasets?${withOwnerFilter(evalCase, params)}`)
        return {
          count: listing?.count ?? 0,
          results: (listing?.results ?? []).map((/** @type {any} */ d) => {
            /** @type {Record<string, unknown>} */
            const result = { id: d.id }
            if (d.slug !== undefined) result.slug = d.slug
            result.title = d.title
            result.href = d.href
            result.isRest = d.isRest === true
            for (const key of ['summary', 'status', 'count']) if (d[key] !== undefined) result[key] = d[key]
            return result
          })
        }
      })
    },
    describe_dataset: {
      name: 'describe_dataset',
      description: 'Describe a dataset: its `id`, `title`, `href` (its URL in the API) and `isRest` (true for an editable dataset), and its `schema`, the list of its columns as the API describes them: each with its `key`, `type`, and when it has them its `format`, `title`, `x-originalName`, `x-refersTo` (the URI of the concept the column holds, e.g. a label, a start date), `x-concept`, `enum` and other annotations. Calculated columns are left out. An unknown id answers 404 Not Found.',
      inputSchema: { type: 'object', properties: { datasetId }, required: ['datasetId'] },
      execute: (args) => attempt(async () => {
        const given = args?.datasetId
        if (typeof given !== 'string' || !given) return '400 Bad Request\ndatasetId is required'
        const id = bareId(given)
        /** @type {any} */
        let dataset
        try {
          dataset = await get(`api/v1/datasets/${encodeURIComponent(id)}`)
        } catch (err) {
          if (evalCase.remote && /^404\b/.test(err instanceof Error ? err.message : '')) return unknownDataset(evalCase, id)
          throw err
        }
        return {
          id: dataset.id,
          title: dataset.title,
          href: dataset.href,
          isRest: dataset.isRest === true,
          // the columns whole, as the pickers store them, calculated ones left out as their `calculated=false` does
          schema: (Array.isArray(dataset.schema) ? dataset.schema : []).filter((/** @type {any} */ c) => !c['x-calculated'])
        }
      })
    },
    get_field_values: {
      name: 'get_field_values',
      description: 'Search the values of a column of a referential dataset, the datasets the document\'s columns pick their values from: such a column names its referential in `x-master.remoteService` as `dataset:<id>`. `q` matches every word in the name or the start of the code, accents and case ignored. Answers `{ count, results }`, `count` being the number of matches and each result a line of the referential with its `code` (the value a column stores) and its `nom`, sorted on the code. An unknown dataset answers 404 Not Found, an unknown column 400 Bad Request with the columns.',
      inputSchema: {
        type: 'object',
        properties: {
          datasetId: { type: 'string', description: 'The referential\'s id, as `x-master.remoteService` names it after `dataset:`.' },
          fieldKey: { type: 'string', description: 'The column searched: `code` or `nom`.' },
          q: { type: 'string', description: 'Text the values must match.' },
          size: { type: 'integer', description: 'Number of results, 10 at most.' }
        },
        required: ['datasetId', 'fieldKey']
      },
      execute: (args) => attempt(async () => {
        const given = args?.datasetId
        if (typeof given !== 'string' || !given) return '400 Bad Request\ndatasetId is required'
        const id = bareId(given)
        const column = referentials(evalCase).get(id)
        if (!column) return unknownDataset(evalCase, id)
        if (!REFERENTIAL_COLUMNS.includes(/** @type {string} */ (args?.fieldKey))) {
          return `400 Bad Request\nunknown column ${JSON.stringify(args?.fieldKey)}, the columns are: ${REFERENTIAL_COLUMNS.join(', ')}`
        }
        const q = typeof args?.q === 'string' ? args.q : ''
        const body = await get(column['x-fromUrl'].replace('{q}', encodeURIComponent(q)))
        const items = /** @type {any[]} */ (body?.[column['x-itemsProp'] ?? 'results'] ?? [])
        const results = items.map((item) => {
          const code = item[column['x-itemKey'] ?? 'output']
          const label = String(item[column['x-itemTitle'] ?? 'label'] ?? '')
          const nom = /^\S+ \((.*)\)$/.exec(label)?.[1] ?? label
          return { code, nom }
        })
        return { count: body?.total ?? results.length, results: results.slice(0, sizeOf(args?.size, 10, 10)) }
      })
    },
    list_portal_pages: {
      name: 'list_portal_pages',
      description: `List the pages of the portal, grouped by type: answers an object with one list per type (${Object.keys(pages ?? {}).join(', ') || 'none'}), each page with its \`slug\`, its \`title\` and, when it has one, its \`titleBackOffice\` (the title the back-office shows). Pass \`type\` to list the pages of one type only.`,
      inputSchema: {
        type: 'object',
        properties: { type: { type: 'string', description: 'Keep the pages of this type only.' } }
      },
      execute: (args) => attempt(async () => {
        const type = typeof args?.type === 'string' && args.type ? args.type : undefined
        return Object.fromEntries(Object.entries(structuredClone(pages ?? {}))
          .filter(([pageType]) => type === undefined || pageType === type))
      })
    }
  }
}

/**
 * The lookups a case declares, as tools of its plain API.
 * @param {EvalCase} evalCase
 * @param {{ fetch?: Function, baseURL: string }} options - `fetch` replaces the network
 *   when the case has no fixture, and returns the parsed body; `baseURL` is the data-fair base
 * @returns {ApiTool[]}
 */
export function createLookupTools (evalCase, options) {
  const names = evalCase.lookups ?? []
  for (const name of names) {
    if (!LOOKUP_NAMES.includes(name)) throw new Error(`unknown lookup "${name}", available: ${LOOKUP_NAMES.join(', ')}`)
  }
  if (!names.length) return []
  const tools = catalogue(evalCase, serviceGet(evalCase, options))
  return names.map((name) => tools[name])
}
