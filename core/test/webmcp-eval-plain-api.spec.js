import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'

import { mergePatch, PlainApiSession } from '../webmcp-eval/plain-api.js'
import { getCase } from '../webmcp-eval/cases/index.js'
import { fixturePath, FIXTURE_BASE_URL } from '../webmcp-eval/remote.js'

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
  it('exposes the five API tools and nothing else', () => {
    const session = new PlainApiSession(makeCase())
    assert.deepEqual(session.toolNames, ['readDocument', 'readSchema', 'writeDocument', 'patchDocument', 'httpGet'])
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

  it('applies a merge patch, null deleting a key', async () => {
    const session = new PlainApiSession(makeCase())
    const result = await session.call('patchDocument', { patch: { a: null, tags: ['t'] } })
    assert.equal(result.isError, false, text(result))
    assert.deepEqual(session.data, { b: 1, tags: ['t'] })
  })

  it('refuses a patch that is not an object', async () => {
    const session = new PlainApiSession(makeCase())
    const result = await session.call('patchDocument', { patch: [] })
    assert.equal(result.isError, true)
    assert.match(text(result), /^400 Bad Request/)
    assert.deepEqual(session.data, { a: 'x', b: 1 })
  })

  it('answers the context resource', async () => {
    const session = new PlainApiSession(makeCase())
    const result = await session.call('httpGet', { url: 'context' })
    assert.deepEqual(JSON.parse(text(result)), { owner: 'org1' })
  })

  it('answers fixture URLs and a 404 for unknown ones', async () => {
    const session = new PlainApiSession(makeCase({
      remote: (url) => fixturePath(url) === '/api/items' ? { results: [url.searchParams.get('q')] } : undefined
    }))
    assert.deepEqual(JSON.parse(text(await session.call('httpGet', { url: 'api/items?q=z' }))), { results: ['z'] })
    const unknown = await session.call('httpGet', { url: 'unknown' })
    assert.equal(unknown.isError, true)
    assert.match(text(unknown), /404/)
    assert.ok(!text(unknown).includes(FIXTURE_BASE_URL), 'the fixture base stays out of what the runner reads')
  })

  it('fetches against the data-fair base when the case has no fixture', async () => {
    /** @type {string[]} */
    const urls = []
    const session = new PlainApiSession(makeCase(), {
      dataFairURL: 'https://df.test/data-fair/',
      fetch: async (/** @type {string} */ url) => { urls.push(url); return { ok: 1 } }
    })
    assert.deepEqual(JSON.parse(text(await session.call('httpGet', { url: 'api/v1/datasets' }))), { ok: 1 })
    assert.deepEqual(urls, ['https://df.test/data-fair/api/v1/datasets'])
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

  it('prompts with the API and the schema guide, never the form tools', () => {
    const session = new PlainApiSession(makeCase())
    assert.ok(session.prompt.includes('Records hold a short code and a list of tags.'))
    for (const name of ['readDocument', 'readSchema', 'writeDocument', 'patchDocument', 'httpGet', 'context']) {
      assert.ok(session.prompt.includes(name), `prompt should name ${name}`)
    }
    for (const forbidden of ['describeState', 'setFieldValue', 'getFieldSuggestions', 'eval', 'plain']) {
      assert.ok(!session.prompt.toLowerCase().includes(forbidden.toLowerCase()), `prompt must not mention ${forbidden}`)
    }
    for (const tool of session.tools) {
      assert.ok(!/eval|plain/i.test(tool.description), `${tool.name} description must not mention the harness`)
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
