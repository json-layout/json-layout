import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'

import { caseFetch, FIXTURE_BASE_URL } from '../webmcp-eval/remote.js'
import { EvalSession } from '../webmcp-eval/session.js'

const remote = (/** @type {URL} */ url) => url.pathname === '/items' ? ['a'] : undefined

describe('caseFetch', () => {
  it('answers a fixture URL and rejects an unknown one with a 404', async () => {
    const fetch = caseFetch({ remote }, {})
    assert.deepEqual(await fetch('items'), ['a'])
    assert.deepEqual(await fetch(`${FIXTURE_BASE_URL}items?q=x`), ['a'])
    await assert.rejects(fetch('other'), /404 Not Found: other/)
  })

  it('falls back to the given fetch when the case has no remote', () => {
    const f = async () => 1
    assert.equal(caseFetch({}, { fetch: f }), f)
    assert.equal(caseFetch({}), undefined)
  })
})

describe('EvalSession with a remote fixture', () => {
  it('serves getFieldSuggestions from the fixture, offline', async () => {
    const hits = []
    const session = new EvalSession({
      name: 'remote',
      title: 'Remote',
      goal: 'pick',
      schema: {
        type: 'object',
        properties: { f: { type: 'string', layout: { getItems: { url: 'items' } } } }
      },
      data: {},
      remote: (url) => { hits.push(url.href); return remote(url) }
    })
    await session.call('getFieldSuggestions', { path: '/f', query: '' })
    assert.equal(session.calls[0].isError, false, session.calls[0].response)
    assert.deepEqual(hits, [`${FIXTURE_BASE_URL}items`])
    assert.ok(session.calls[0].response.includes('a'), session.calls[0].response)
  })
})
