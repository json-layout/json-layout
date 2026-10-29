import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'

import { compile } from '../src/compile/index.js'
import { StatefulLayout } from '../src/state/index.js'
import { WebMCP } from '../src/webmcp/index.js'
import { coerceForNode } from '../src/webmcp/coerce.js'
import * as setFieldValue from '../src/webmcp/tools/set-field-value.js'
import * as setData from '../src/webmcp/tools/set-data.js'
import * as editArray from '../src/webmcp/tools/edit-array.js'
import { getCase } from '../webmcp-eval/cases/index.js'

/**
 * @param {Record<string, unknown>} [layout]
 * @param {string} [key]
 */
const node = (layout = {}, key = 'x') => /** @type {any} */({ key, layout })

describe('coerceForNode', () => {
  it('writes a number as the text a text field holds', () => {
    assert.deepEqual(coerceForNode(node(), 12345678901234, { type: 'string' }), { value: '12345678901234', coerced: 'number → string' })
    assert.deepEqual(coerceForNode(node(), 1.5, { type: 'string' }), { value: '1.5', coerced: 'number → string' })
  })
  it('leaves what it should not touch', () => {
    assert.deepEqual(coerceForNode(node(), '12', { type: 'string' }), { value: '12' })
    assert.deepEqual(coerceForNode(node(), '', { type: 'number' }), { value: '' })
    assert.deepEqual(coerceForNode(node(), '', { type: 'array', items: { type: 'string' } }), { value: '' })
    assert.deepEqual(coerceForNode(node(), 12, { type: ['string', 'null'] }), { value: 12 })
    assert.deepEqual(coerceForNode(node(), 12, { type: 'number' }), { value: 12 })
    assert.deepEqual(coerceForNode(node(), { a: 1 }, { type: 'string' }), { value: { a: 1 } })
    assert.deepEqual(coerceForNode(node(), { a: 1 }, { type: 'array', items: { type: 'string' } }), { value: { a: 1 } })
    assert.deepEqual(coerceForNode(node(), 1e21, { type: 'string' }), { value: 1e21 })
    assert.deepEqual(coerceForNode(node(), null, { type: 'string' }), { value: null })
  })
  it('never coerces a variant selector or a choice between schemas', () => {
    assert.deepEqual(coerceForNode(node({}, '$oneOf'), 1, { type: 'string' }), { value: 1 })
    assert.deepEqual(coerceForNode(node(), 1, { type: 'string', oneOf: [{ type: 'string' }, { type: 'number' }] }), { value: 1 })
    assert.deepEqual(coerceForNode(node(), 1, { type: 'string', anyOf: [{ properties: {} }] }), { value: 1 })
    // a list of labelled constants is a select, not a choice between schemas
    assert.deepEqual(coerceForNode(node(), 1, { type: 'string', oneOf: [{ const: '1' }, { const: '2' }] }), { value: '1', coerced: 'number → string' })
  })
  it('wraps a single value in a list', () => {
    assert.deepEqual(coerceForNode(node(), 'judo', { type: 'array', items: { type: 'string' } }), { value: ['judo'], coerced: 'single value → list' })
    assert.deepEqual(coerceForNode(node(), 3, { type: 'array', items: { type: 'number' } }), { value: [3], coerced: 'single value → list' })
    assert.deepEqual(coerceForNode(node(), 3, { type: 'array', items: { type: 'string' } }), { value: ['3'], coerced: 'single value → list, number → string' })
    assert.deepEqual(coerceForNode(node(), 'a', { type: 'array', items: { type: 'object' } }), { value: 'a' })
    assert.deepEqual(coerceForNode(node(), ['a'], { type: 'array', items: { type: 'string' } }), { value: ['a'] })
  })
  it('splits a string on the separator of the field', () => {
    const multi = node({ separator: ',' })
    assert.deepEqual(coerceForNode(multi, 'judo, yoga ,danse', { type: 'array', items: { type: 'string' } }), { value: ['judo', 'yoga', 'danse'], coerced: 'split on ","' })
    assert.deepEqual(coerceForNode(multi, 'judo', { type: 'array', items: { type: 'string' } }), { value: ['judo'], coerced: 'single value → list' })
    // a text field joined by its separator keeps its string
    assert.deepEqual(coerceForNode(multi, 'a,b', { type: 'string' }), { value: 'a,b' })
  })
  it('splits a text into the allowed values it lists', () => {
    const items = { type: 'string', oneOf: [{ const: 'judo' }, { const: 'yoga' }, { const: 'a, b' }] }
    const schema = { type: 'array', items }
    assert.deepEqual(coerceForNode(node(), 'judo, yoga', schema), { value: ['judo', 'yoga'], coerced: 'text → list' })
    assert.deepEqual(coerceForNode(node({ separator: ';' }), 'judo; yoga', schema), { value: ['judo', 'yoga'], coerced: 'text → list' })
    assert.deepEqual(coerceForNode(node(), 'judo, yoga', { type: 'array', items: { type: 'string', enum: ['judo', 'yoga'] } }), { value: ['judo', 'yoga'], coerced: 'text → list' })
    // one unknown part: no split
    assert.deepEqual(coerceForNode(node(), 'judo, tennis', schema), { value: ['judo, tennis'], coerced: 'single value → list' })
    // the whole text is an allowed value that holds a comma
    assert.deepEqual(coerceForNode(node(), 'a, b', schema), { value: ['a, b'], coerced: 'single value → list' })
    assert.deepEqual(coerceForNode(node({ separator: ',' }), 'a, b', schema), { value: ['a, b'], coerced: 'single value → list' })
  })
  it('unquotes a JSON-quoted text whose unquoted form is an allowed value', () => {
    const position = { type: 'string', oneOf: [{ const: 'none' }, { const: 'above-footer' }] }
    assert.deepEqual(coerceForNode(node(), '"above-footer"', position), { value: 'above-footer', coerced: 'quoted text → text' })
    assert.deepEqual(coerceForNode(node(), '"b"', { type: 'string', enum: ['a', 'b'] }), { value: 'b', coerced: 'quoted text → text' })
    // a select whose items the layout lists
    const select = node({ items: [{ key: 'a', title: 'A', value: 'a' }, { key: 'b', title: 'B', value: 'b' }] })
    assert.deepEqual(coerceForNode(select, '"a"', { type: 'string' }), { value: 'a', coerced: 'quoted text → text' })
    // the quoted text is itself allowed, the unquoted one is not, or the set is open: untouched
    assert.deepEqual(coerceForNode(node(), '"b"', { type: 'string', enum: ['"b"', 'b'] }), { value: '"b"' })
    assert.deepEqual(coerceForNode(node(), '"c"', { type: 'string', enum: ['a', 'b'] }), { value: '"c"' })
    assert.deepEqual(coerceForNode(node(), '"a"', { type: 'string' }), { value: '"a"' })
    assert.deepEqual(coerceForNode(node(), '"a"', { type: 'string', examples: ['a'] }), { value: '"a"' })
    // items fetched or computed are not a set known when the value is written
    assert.deepEqual(coerceForNode(node({ getItems: { url: 'x' } }), '"a"', { type: 'string' }), { value: '"a"' })
  })
  it('turns the numbers of a list of texts into texts', () => {
    assert.deepEqual(coerceForNode(node(), [1, 'b'], { type: 'array', items: { type: 'string' } }), { value: ['1', 'b'], coerced: 'number → string' })
  })
})

describe('tolerant write tools', () => {
  const evalCase = getCase('data-fair-line')
  const setup = () => {
    const compiled = compile(evalCase.schema)
    const mainTree = compiled.skeletonTrees[compiled.mainTree]
    return new StatefulLayout(compiled, mainTree, { validateOn: 'input' }, {})
  }

  it('setFieldValue stores the digits of a SIRET sent as a number', () => {
    const layout = setup()
    const result = setFieldValue.execute(layout, { path: '/siret', value: 12345678901234 })
    assert.equal(/** @type {any} */(layout.data).siret, '12345678901234')
    assert.deepEqual(result.coerced, ['/siret number → string'])
    assert.equal(result.errors.filter(e => e.path === '/siret').length, 0)
  })
  it('setFieldValue wraps a single value for a multi-valued field', () => {
    const layout = setup()
    const result = setFieldValue.execute(layout, { path: '/activites', value: 'judo' })
    assert.deepEqual(/** @type {any} */(layout.data).activites, ['judo'])
    assert.deepEqual(result.coerced, ['/activites single value → list'])
  })
  it('setFieldValue splits a text listing allowed values', () => {
    const layout = setup()
    const result = setFieldValue.execute(layout, { path: '/activites', value: 'football, judo' })
    assert.deepEqual(/** @type {any} */(layout.data).activites, ['football', 'judo'])
    assert.deepEqual(result.coerced, ['/activites text → list'])
    assert.equal(result.errors.filter(e => e.path === '/activites').length, 0)
  })
  it('setFieldValue unquotes the breadcrumb position of the portal configuration', () => {
    const compiled = compile(getCase('portal-config-multi').schema)
    const layout = new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree], { validateOn: 'input' }, structuredClone(getCase('portal-config-multi').data))
    const result = setFieldValue.execute(layout, { path: '/$comp-5/breadcrumb/position', value: '"above-footer"' })
    assert.equal(/** @type {any} */(layout.data).breadcrumb.position, 'above-footer')
    assert.deepEqual(result.coerced, ['/$comp-5/breadcrumb/position quoted text → text'])
  })
  it('setFieldValue reports nothing when nothing was coerced', () => {
    const layout = setup()
    const result = setFieldValue.execute(layout, { path: '/siret', value: '12345678901234' })
    assert.equal(result.coerced, undefined)
  })
  it('setData coerces each leaf it can place on a field', () => {
    const layout = setup()
    const result = setData.execute(layout, { data: { siret: 12345678901234, activites: 'judo', nom: 'Gymnase' } })
    const data = /** @type {any} */(layout.data)
    assert.equal(data.siret, '12345678901234')
    assert.deepEqual(data.activites, ['judo'])
    assert.equal(data.nom, 'Gymnase')
    assert.deepEqual(result.coerced?.slice().sort(), ['/activites single value → list', '/siret number → string'])
  })
  it('editArray add coerces a scalar item', () => {
    const compiled = compile({ type: 'object', properties: { l: { type: 'array', items: { type: 'string' }, layout: { comp: 'list' } } } })
    const layout = new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree], { validateOn: 'input' }, {})
    const result = editArray.execute(layout, { path: '/l', action: 'add', value: 5 })
    assert.deepEqual(/** @type {any} */(layout.data).l, ['5'])
    assert.deepEqual(result.coerced, ['/l/0 number → string'])
  })
  it('the tool answers with a one-line coerced note', async () => {
    const layout = setup()
    const webmcp = new WebMCP(layout, { screen: false })
    const tool = webmcp.getTools().find(t => t.name === 'setFieldValue')
    const answer = await /** @type {any} */(tool).execute({ path: '/siret', value: 12345678901234 })
    const text = answer.content[0].text
    assert.match(text, /^coerced: \/siret number → string$/m)
  })
})
