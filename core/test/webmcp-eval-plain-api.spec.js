import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'

import { patchTopLevel, PlainApiSession } from '../webmcp-eval/plain-api.js'
import { getCase } from '../webmcp-eval/cases/index.js'
import { FIXTURE_BASE_URL } from '../webmcp-eval/remote.js'

/** @typedef {import('../webmcp-eval/cases/types.js').EvalCase} EvalCase */

/**
 * @param {Partial<EvalCase>} [overrides]
 * @returns {EvalCase}
 */
const makeCase = (overrides = {}) => ({
  name: 'plain',
  title: 'record',
  goal: 'edit the record',
  schema: {
    type: 'object',
    'x-agent-guide': 'Records hold a short code and a list of tags.',
    properties: {
      a: { type: 'string', maxLength: 5 },
      b: { type: 'number' },
      tags: { type: 'array', items: { type: 'string' } }
    }
  },
  data: { a: 'x', b: 1 },
  context: { owner: 'org1' },
  expectedComplexity: 'small',
  expectedSchemaFits: true,
  ...overrides
})

/** @param {any} result */
const text = (result) => result.content.map((/** @type {any} */ p) => p.text).join('')

describe('PlainApiSession', () => {
  it('exposes the four API tools and nothing else, no generic HTTP client', () => {
    const session = new PlainApiSession(makeCase())
    assert.deepEqual(session.toolNames, ['readDocument', 'readSchema', 'writeDocument', 'patchDocument'])
    assert.ok(!session.toolNames.includes('httpGet'))
    for (const tool of session.tools) {
      assert.ok(tool.description.length > 40, `${tool.name} needs a real description`)
      assert.equal(tool.inputSchema.type, 'object')
    }
  })

  it('reads the whole document and the value at a pointer', async () => {
    const session = new PlainApiSession(makeCase())
    assert.deepEqual(JSON.parse(text(await session.call('readDocument', {}))), { a: 'x', b: 1 })
    assert.deepEqual(JSON.parse(text(await session.call('readDocument', { path: '/a' }))), 'x')
    const missing = await session.call('readDocument', { path: '/nope' })
    assert.equal(missing.isError, true)
    assert.match(text(missing), /404/)
  })

  it('reads the raw schema at a pointer', async () => {
    const session = new PlainApiSession(makeCase())
    const result = await session.call('readSchema', { path: '/properties' })
    assert.deepEqual(Object.keys(JSON.parse(text(result))), ['a', 'b', 'tags'])
  })

  it('refuses an invalid write with a 400 and leaves the document unchanged', async () => {
    const session = new PlainApiSession(makeCase())
    const result = await session.call('writeDocument', { document: { a: 'too long', b: 'nan' } })
    assert.equal(result.isError, true)
    const lines = text(result).split('\n')
    assert.equal(lines[0], '400 Bad Request')
    assert.ok(lines.includes('/a must NOT have more than 5 characters'), text(result))
    assert.ok(lines.includes('/b must be number'), text(result))
    assert.deepEqual(session.data, { a: 'x', b: 1 })
    assert.equal(session.valid, true)
  })

  it('names the unknown property in an additionalProperties refusal', async () => {
    const session = new PlainApiSession(makeCase({
      schema: { type: 'object', additionalProperties: false, properties: { a: { type: 'string' } } },
      data: {}
    }))
    const result = await session.call('writeDocument', { document: { a: 'x', zz: 1 } })
    assert.equal(result.isError, true)
    assert.ok(text(result).split('\n').includes('(root) must NOT have additional properties: zz'), text(result))
  })

  it('lists the allowed values in an enum refusal', async () => {
    const session = new PlainApiSession(makeCase({
      schema: { type: 'object', properties: { color: { type: 'string', enum: ['red', 'blue'] } } },
      data: {}
    }))
    const result = await session.call('patchDocument', { patch: { color: 'green' } })
    assert.equal(result.isError, true)
    assert.ok(text(result).split('\n').includes('/color must be equal to one of the allowed values: "red", "blue"'), text(result))
  })

  it('stores a valid write, given as an object or as a JSON string', async () => {
    const session = new PlainApiSession(makeCase())
    const result = await session.call('writeDocument', { document: '{"a": "y"}' })
    assert.equal(result.isError, false)
    assert.match(text(result), /^200 OK\nstored 1 top-level key/)
    assert.deepEqual(session.data, { a: 'y' })
    assert.deepEqual(session.start, { a: 'x', b: 1 }, 'the starting document is a copy')
  })

  it('applies a single-level patch, null deleting a key', async () => {
    const session = new PlainApiSession(makeCase())
    const result = await session.call('patchDocument', { patch: { a: null, tags: ['t'] } })
    assert.equal(result.isError, false, text(result))
    assert.deepEqual(session.data, { b: 1, tags: ['t'] })
  })

  it('replaces a nested object whole rather than merging into it', async () => {
    const session = new PlainApiSession(makeCase({
      schema: { type: 'object', properties: { address: { type: 'object' }, b: { type: 'number' } } },
      data: { address: { city: 'Nantes', street: '1 rue X' }, b: 1 }
    }))
    const result = await session.call('patchDocument', { patch: { address: { city: 'Rennes', zip: null } } })
    assert.equal(result.isError, false, text(result))
    assert.deepEqual(session.data, { address: { city: 'Rennes', zip: null }, b: 1 })
    const description = session.tools.find((t) => t.name === 'patchDocument')?.description ?? ''
    assert.match(description, /Array and object fields replace the current value entirely: read it first/)
    assert.ok(!/merge patch|7396|recursive/i.test(description), description)
  })

  it('refuses a patch that is not an object', async () => {
    const session = new PlainApiSession(makeCase())
    const result = await session.call('patchDocument', { patch: [] })
    assert.equal(result.isError, true)
    assert.match(text(result), /^400 Bad Request/)
    assert.deepEqual(session.data, { a: 'x', b: 1 })
  })

  it('adds the case\'s lookups to its tools, served from the case fixture and recorded', async () => {
    const session = new PlainApiSession(getCase('data-fair-line'), { fetch: async () => { throw new Error('the network must not be reached') } })
    assert.deepEqual(session.toolNames, ['readDocument', 'readSchema', 'writeDocument', 'patchDocument', 'get_field_values'])
    const result = await session.call('get_field_values', { datasetId: 'communes', fieldKey: 'nom', q: 'Sébastien' })
    assert.equal(result.isError, false, text(result))
    assert.ok(JSON.parse(text(result)).results.some((/** @type {any} */ c) => c.code === '44190'), text(result))
    assert.equal(session.calls[0].tool, 'get_field_values')
    const unknown = await new PlainApiSession({ ...getCase('data-fair-line'), remote: () => undefined })
      .call('get_field_values', { datasetId: 'communes', fieldKey: 'nom', q: 'Nantes' })
    assert.equal(unknown.isError, true)
    assert.match(text(unknown), /404/)
    assert.ok(!text(unknown).includes(FIXTURE_BASE_URL), 'the fixture base stays out of what the runner reads')
  })

  it('looks up against the data-fair base when the case has no fixture', async () => {
    /** @type {string[]} */
    const urls = []
    const session = new PlainApiSession(getCase('charts'), {
      dataFairURL: 'https://df.test/data-fair/',
      fetch: async (/** @type {string} */ url) => { urls.push(url); return { count: 0, results: [] } }
    })
    assert.deepEqual(JSON.parse(text(await session.call('list_account_datasets', {}))), { count: 0, results: [] })
    assert.ok(urls[0].startsWith('https://df.test/data-fair/api/v1/datasets?'), urls[0])
  })

  it('applies the case\'s input tolerance before validating', async () => {
    const evalCase = makeCase({
      apiAccepts: (doc) => {
        const d = /** @type {any} */ (doc)
        return typeof d.tags === 'string' ? { ...d, tags: d.tags.split(',').map((/** @type {string} */ s) => s.trim()) } : d
      }
    })
    const refused = new PlainApiSession(makeCase())
    assert.equal((await refused.call('patchDocument', { patch: { tags: 'a, b' } })).isError, true)
    const session = new PlainApiSession(evalCase)
    const result = await session.call('patchDocument', { patch: { tags: 'a, b' } })
    assert.equal(result.isError, false, text(result))
    assert.deepEqual(session.data, { a: 'x', b: 1, tags: ['a', 'b'] })
  })

  it('names each missing property in a 400, under the form\'s short error messages', async () => {
    const session = new PlainApiSession(getCase('contact'))
    const partial = text(await session.call('writeDocument', { document: { name: 'Ada Lovelace' } }))
    assert.match(partial, /^400 Bad Request\n/)
    assert.match(partial, /email/)
    assert.ok(!partial.includes('required information'), partial)
    const empty = /** @type {string[]} */ (text(await session.call('writeDocument', { document: {} })).split('\n').slice(1))
    assert.equal(empty.length, 2, empty.join('\n'))
    assert.ok(empty.some((line) => line.includes('name')) && empty.some((line) => line.includes('email')), empty.join('\n'))
  })

  it('lists the allowed values of a closed list in one line', async () => {
    const session = new PlainApiSession(getCase('data-fair-line'))
    const result = await session.call('patchDocument', { patch: { activites: ['judo', 'ju-jitsu'], type_lieu: 'dojo' } })
    const lines = /** @type {string[]} */ (text(result).split('\n'))
    const activites = lines.filter((line) => line.startsWith('/activites/1'))
    assert.equal(activites.length, 1, lines.join('\n'))
    for (const value of ['football', 'judo', 'yoga', 'handisport']) assert.ok(activites[0].includes(`"${value}"`), activites[0])
    assert.equal(lines.filter((line) => line.startsWith('/type_lieu')).length, 1, lines.join('\n'))
    assert.ok(lines.find((line) => line.startsWith('/type_lieu'))?.includes('"salle polyvalente"'))
    assert.ok(!lines.some((line) => /must be equal to constant|exactly one schema|chose one/.test(line)), lines.join('\n'))
  })

  it('stores a __proto__ key of a patch as data', () => {
    const merged = /** @type {any} */ (patchTopLevel({ a: 1 }, JSON.parse('{"__proto__": {"polluted": true}, "b": {"__proto__": {"x": 1}}}')))
    assert.equal(Object.getPrototypeOf(merged), Object.prototype)
    assert.equal(merged.polluted, undefined)
    assert.ok(Object.hasOwn(merged, '__proto__'))
    assert.deepEqual(Object.keys(merged), ['a', '__proto__', 'b'])
    assert.ok(Object.hasOwn(merged.b, '__proto__'), 'a nested value keeps its own __proto__ key as data')
    assert.equal(merged.b.x, undefined)
    assert.equal(/** @type {any} */ ({}).polluted, undefined)
  })

  it('hands the input tolerance a copy, so a refused write leaves the stored document as it was', async () => {
    // a patch copies the top level only: the stored array is shared with the candidate
    const evalCase = makeCase({
      data: { a: 'x', b: 1, tags: ['t'] },
      apiAccepts: (doc) => {
        const d = /** @type {any} */ (doc)
        d.tags.push('added')
        d.a = 'far too long a code'
        return d
      }
    })
    const session = new PlainApiSession(evalCase)
    const result = await session.call('patchDocument', { patch: { b: 2 } })
    assert.equal(result.isError, true)
    assert.deepEqual(session.data, { a: 'x', b: 1, tags: ['t'] })
  })

  it('prompts with the API and the schema guide, never the form tools', () => {
    const session = new PlainApiSession(makeCase())
    assert.ok(session.prompt.includes('Records hold a short code and a list of tags.'))
    for (const name of ['readDocument', 'readSchema', 'writeDocument', 'patchDocument']) {
      assert.ok(session.prompt.includes(name), `prompt should name ${name}`)
    }
    for (const forbidden of ['describeState', 'setFieldValue', 'getFieldSuggestions', 'eval', 'plain', 'httpGet', 'context', 'merge patch', 'lookup']) {
      assert.ok(!session.prompt.toLowerCase().includes(forbidden.toLowerCase()), `prompt must not mention ${forbidden}`)
    }
    for (const tool of session.tools) {
      assert.ok(!/eval|plain/i.test(tool.description), `${tool.name} description must not mention the harness`)
    }
  })

  it('names the case\'s lookups in its prompt, and only those', () => {
    const line = new PlainApiSession(getCase('data-fair-line')).prompt
    assert.ok(line.includes('get_field_values'))
    for (const absent of ['list_account_datasets', 'describe_dataset', 'list_portal_pages', 'httpGet']) assert.ok(!line.includes(absent), absent)
    const calendar = new PlainApiSession(getCase('calendar')).prompt
    assert.ok(calendar.includes('list_account_datasets') && calendar.includes('describe_dataset'))
    for (const tool of new PlainApiSession(getCase('calendar')).tools) {
      assert.ok(!/eval|plain|httpGet/i.test(tool.description), `${tool.name} description must not mention the harness or a removed tool`)
    }
  })

  it('records calls and produces evidence tagged with its arm', async () => {
    const session = new PlainApiSession(makeCase())
    await session.call('readDocument', {})
    await session.call('nope', {})
    const evidence = session.evidence()
    assert.equal(evidence.arm, 'plain')
    assert.equal(evidence.case, 'plain')
    assert.deepEqual(evidence.start, { a: 'x', b: 1 })
    assert.equal(evidence.metrics.toolCalls, 2)
    assert.equal(evidence.calls[1].isError, true)
    assert.match(session.report(), /2 calls/)
  })
})
