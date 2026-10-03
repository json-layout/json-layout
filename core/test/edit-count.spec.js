import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'

import { compile } from '../src/compile/index.js'
import { StatefulLayout } from '../src/state/index.js'
import * as setFieldValue from '../src/webmcp/tools/set-field-value.js'
import * as setData from '../src/webmcp/tools/set-data.js'
import * as editArray from '../src/webmcp/tools/edit-array.js'
import { waitForSettled } from './utils/wait-for.js'

// A form fills defaults into its data as soon as it opens. An application that saves
// every data event as a draft then saves a change nobody made: the portals editor marked
// every newly created portal as having unpublished changes. editCount counts the edits
// applied to the data (a person's input, a form tool), not what the form produced itself
// (defaults, items fetched for a list, data set from outside): an application saves when
// it moved.

const schema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    display: { type: 'string', default: 'card' },
    links: { type: 'array', items: { type: 'object', properties: { label: { type: 'string' } } } }
  }
}

/** @param {unknown} [data] */
const open = (data) => {
  const compiledLayout = compile(schema)
  /** @type {any[]} */
  const events = []
  const layout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], {
    onData: (data) => { events.push(data) }
  }, data)
  return { layout, events }
}

/**
 * @param {StatefulLayout} layout
 * @param {string} key
 */
const nodeOf = (layout, key) => {
  const node = layout.stateTree.root.children?.find(c => c.key === key)
  if (!node) throw new Error(`no node ${key}`)
  return node
}

describe('edit count of a stateful layout', () => {
  it('stays at 0 while the form fills its defaults', () => {
    const { layout, events } = open({ title: 'Portal' })
    assert.equal(events.at(-1).display, 'card')
    assert.equal(layout.editCount, 0)
  })

  it('stays at 0 while a list fills itself from its items', async () => {
    // the portals editor's topics list, filled from the account's topics, counted as an edit
    const compiledLayout = compile({
      type: 'object',
      properties: { topics: { type: 'array', layout: { comp: 'list', items: ['sport', 'culture'] }, items: { type: 'string' } } }
    })
    const layout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], {}, {})
    await waitForSettled(layout)
    assert.deepEqual(/** @type {any} */(layout.data).topics, ['sport', 'culture'])
    assert.equal(layout.editCount, 0)
  })

  it('moves once per input, when it reaches the data', () => {
    const { layout } = open({ title: 'Portal' })
    // a text field is debounced: the input reaches the data when the person leaves it
    layout.input(nodeOf(layout, 'title'), 'Portal renamed')
    assert.equal(layout.editCount, 0)
    layout.blur(nodeOf(layout, 'title'))
    assert.equal(layout.editCount, 1)
    assert.equal(/** @type {any} */(layout.data).title, 'Portal renamed')
  })

  it('does not move when data is set from outside, defaults it gets included', () => {
    const { layout, events } = open({ title: 'Portal' })
    layout.data = { title: 'Other' }
    assert.equal(events.at(-1).display, 'card')
    assert.equal(layout.editCount, 0)
  })

  it('moves when inputData replaces the whole data', () => {
    const { layout } = open({ title: 'Portal' })
    layout.inputData({ title: 'Replaced' })
    assert.equal(/** @type {any} */(layout.data).title, 'Replaced')
    assert.equal(layout.editCount, 1)
  })

  it('moves for each form tool edit', () => {
    const { layout } = open({ title: 'Portal' })
    setFieldValue.execute(layout, { path: '/title', value: 'By a tool' })
    assert.equal(layout.editCount, 1)
    editArray.execute(layout, { path: '/links', action: 'add', value: { label: 'a' } })
    assert.equal(layout.editCount, 2)
    setData.execute(layout, { data: { title: 'Whole data by a tool' } })
    assert.equal(layout.editCount, 3)
  })
})
