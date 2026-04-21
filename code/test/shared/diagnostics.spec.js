import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { compile, StatefulLayout } from '@json-layout/core'
import { jsonFormatAdapter } from '../../src/json/adapter.js'
import { collectDiagnostics } from '../../src/shared/diagnostics.js'

const defaultOptions = { debounceInputMs: 0, initialValidation: 'always' }

describe('collectDiagnostics', () => {
  it('returns one diagnostic per invalid leaf, with a resolvable text range', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        age: { type: 'integer', minimum: 0 },
        email: { type: 'string', format: 'email' }
      }
    })
    const statefulLayout = new StatefulLayout(
      compiledLayout,
      compiledLayout.skeletonTrees[compiledLayout.mainTree],
      defaultOptions,
      { age: -1, email: 'not-an-email' }
    )
    const text = JSON.stringify({ age: -1, email: 'not-an-email' }, null, 2)
    const diags = collectDiagnostics(statefulLayout, text, jsonFormatAdapter)
    assert.ok(diags.length >= 2, `expected >= 2 diagnostics, got ${diags.length}`)
    const paths = diags.map(d => d.path)
    assert.ok(paths.includes('/age'), `missing /age in ${JSON.stringify(paths)}`)
    assert.ok(paths.includes('/email'), `missing /email in ${JSON.stringify(paths)}`)
    for (const d of diags) {
      assert.equal(d.severity, 'error')
      assert.equal(typeof d.message, 'string')
      assert.ok(d.from <= d.to)
      assert.ok(d.from >= 0 && d.to <= text.length)
    }
  })

  it('returns [] when the data is valid', async () => {
    const compiledLayout = await compile({
      type: 'object',
      properties: { name: { type: 'string' } }
    })
    const statefulLayout = new StatefulLayout(
      compiledLayout,
      compiledLayout.skeletonTrees[compiledLayout.mainTree],
      defaultOptions,
      { name: 'ok' }
    )
    const diags = collectDiagnostics(statefulLayout, '{"name": "ok"}', jsonFormatAdapter)
    assert.deepEqual(diags, [])
  })

  it('drops diagnostics whose path does not resolve in the text', async () => {
    // StatefulLayout has an error at /age; we pass text that does not contain `age`.
    // pathToRange returns null → diagnostic must be filtered out.
    const compiledLayout = await compile({
      type: 'object',
      required: ['age'],
      properties: { age: { type: 'integer' } }
    })
    const statefulLayout = new StatefulLayout(
      compiledLayout,
      compiledLayout.skeletonTrees[compiledLayout.mainTree],
      defaultOptions,
      { age: 'not a number' }
    )
    const skewedText = '{}'
    const diags = collectDiagnostics(statefulLayout, skewedText, jsonFormatAdapter)
    // Expect no diagnostics targeted at /age (the /age key is not in `{}`).
    assert.ok(!diags.some(d => d.path === '/age'), `did not expect /age diagnostic on skewed text: ${JSON.stringify(diags)}`)
  })
})
