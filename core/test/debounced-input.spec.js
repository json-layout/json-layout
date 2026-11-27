import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { compile, StatefulLayout } from '../src/index.js'

// a list edited in a dialog, whose items have a oneOf that the data alone does not resolve:
// the branch chosen in the dialog leaves the tree when the item is deactivated
const schema = {
  type: 'array',
  layout: { listEditMode: 'dialog' },
  items: {
    type: 'object',
    properties: { name: { type: 'string' } },
    oneOfLayout: { emptyData: true },
    oneOf: [
      { title: 'Case 1', required: ['str1'], properties: { str1: { type: 'string' } } },
      { title: 'Case 2', required: ['str2'], properties: { str2: { type: 'string', default: 'def' } } },
      { title: 'Case 3', required: ['str3'], properties: { str3: { type: 'string' } } }
    ]
  }
}

describe('debounced input and changes of the state tree', () => {
  /**
   * @param {import('node:test').TestContext} t
   * @param {unknown} [data]
   * @param {object} [itemsSchema]
   */
  const init = async (t, data = [{ str1: 'val1' }, {}], itemsSchema = schema) => {
    t.mock.timers.enable({ apis: ['setTimeout'] })
    const compiledLayout = await compile(itemsSchema)
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], {}, data)
    /** @param {string} fullKey */
    const getNode = (fullKey) => {
      const node = statefulLayout.stateTree.root.fullKey === fullKey
        ? statefulLayout.stateTree.root
        // @ts-ignore
        : statefulLayout._lastCreateStateTreeContext.nodesMap.get(fullKey)
      assert.ok(node, `node ${fullKey} not found`)
      return /** @type {import('../src/index.js').StateNode} */(node)
    }
    /** @param {string} fullKey */
    const hasNode = (fullKey) => {
      // @ts-ignore
      return statefulLayout._lastCreateStateTreeContext.nodesMap.has(fullKey)
    }
    return { statefulLayout, getNode, hasNode }
  }

  /**
   * open the second item in the dialog, choose a oneOf branch and type in its field without waiting for the debounce
   * @param {Awaited<ReturnType<typeof init>>} ctx
   */
  const typeInDialog = ({ statefulLayout, getNode }) => {
    statefulLayout.activateItem(getNode(''), 1)
    statefulLayout.activateItem(getNode('/1/$oneOf'), 2)
    const field = getNode('/1/$oneOf/2/str3')
    assert.equal(field.options.debounceInputMs, 300)
    statefulLayout.input(field, 'typed')
    assert.deepEqual(statefulLayout.data, [{ str1: 'val1' }, {}])
    return field
  }

  it('should apply a pending input when the edited item is deactivated', async (t) => {
    const ctx = await init(t)
    const { statefulLayout, hasNode } = ctx
    typeInDialog(ctx)

    statefulLayout.deactivateItem(statefulLayout.stateTree.root)
    assert.deepEqual(statefulLayout.data, [{ str1: 'val1' }, { str3: 'typed' }])
    assert.ok(hasNode('/1/$oneOf/2/str3'))

    t.mock.timers.tick(300)
    assert.deepEqual(statefulLayout.data, [{ str1: 'val1' }, { str3: 'typed' }])
  })

  it('should accept a blur from the field of a deactivated item and keep working', async (t) => {
    const ctx = await init(t)
    const { statefulLayout, getNode } = ctx
    const field = typeInDialog(ctx)

    statefulLayout.deactivateItem(statefulLayout.stateTree.root)
    // the fields of the closed dialog are unmounted afterwards and may emit a blur
    statefulLayout.blur(field)
    assert.deepEqual(statefulLayout.data, [{ str1: 'val1' }, { str3: 'typed' }])

    statefulLayout.activateItem(getNode(''), 0)
    statefulLayout.input(getNode('/0/$oneOf/0/str1'), 'val2')
    t.mock.timers.tick(300)
    assert.deepEqual(statefulLayout.data, [{ str1: 'val2' }, { str3: 'typed' }])
  })

  it('should ignore the default data of a blurred node that left the tree', async (t) => {
    const ctx = await init(t)
    const { statefulLayout, getNode, hasNode } = ctx
    statefulLayout.activateItem(getNode(''), 1)
    statefulLayout.activateItem(getNode('/1/$oneOf'), 1)
    assert.deepEqual(statefulLayout.data, [{ str1: 'val1' }, { str2: 'def' }])
    // the default value is not applied again while the field is being edited
    statefulLayout.input(getNode('/1/$oneOf/1/str2'), null)
    t.mock.timers.tick(300)
    assert.deepEqual(statefulLayout.data, [{ str1: 'val1' }, {}])
    const field = getNode('/1/$oneOf/1/str2')

    statefulLayout.deactivateItem(statefulLayout.stateTree.root)
    assert.ok(!hasNode('/1/$oneOf/1/str2'))
    statefulLayout.blur(field)
    assert.deepEqual(statefulLayout.data, [{ str1: 'val1' }, {}])
  })

  it('should drop a pending input whose node was removed by data set from outside', async (t) => {
    const ctx = await init(t)
    const { statefulLayout, getNode } = ctx
    typeInDialog(ctx)

    statefulLayout.data = [{ str1: 'val1' }]
    t.mock.timers.tick(300)
    assert.deepEqual(statefulLayout.data, [{ str1: 'val1' }])

    // the dropped input does not break the following ones
    statefulLayout.input(getNode('/0/$oneOf/0/str1'), 'val2')
    t.mock.timers.tick(300)
    assert.deepEqual(statefulLayout.data, [{ str1: 'val2' }])
  })

  it('should apply a pending input on top of data set from outside when its node is still there', async (t) => {
    const ctx = await init(t, [{ str1: 'val1' }, { str3: 'val3' }])
    const { statefulLayout, getNode } = ctx
    statefulLayout.activateItem(getNode(''), 1)
    statefulLayout.input(getNode('/1/$oneOf/2/str3'), 'typed')

    statefulLayout.data = [{ str1: 'other' }, { str3: 'val3' }]
    t.mock.timers.tick(300)
    assert.deepEqual(statefulLayout.data, [{ str1: 'other' }, { str3: 'typed' }])
  })

  it('should keep a pending input from an item when the whole list is input', async (t) => {
    // an item is added
    let ctx = await init(t)
    typeInDialog(ctx)
    let list = ctx.statefulLayout.stateTree.root
    ctx.statefulLayout.input(list, [.../** @type {unknown[]} */(list.data), undefined])
    assert.deepEqual(ctx.statefulLayout.data, [{ str1: 'val1' }, { str3: 'typed' }, {}])
    t.mock.timers.tick(300)
    assert.deepEqual(ctx.statefulLayout.data, [{ str1: 'val1' }, { str3: 'typed' }, {}])

    // another item is removed, the edited item moves
    t.mock.timers.reset()
    ctx = await init(t)
    typeInDialog(ctx)
    list = ctx.statefulLayout.stateTree.root
    ctx.statefulLayout.input(list, /** @type {unknown[]} */(list.data).slice(1))
    assert.deepEqual(ctx.statefulLayout.data, [{ str3: 'typed' }])
    t.mock.timers.tick(300)
    assert.deepEqual(ctx.statefulLayout.data, [{ str3: 'typed' }])
  })

  it('should keep a pending input when another item is activated', async (t) => {
    const ctx = await init(t)
    const { statefulLayout, getNode } = ctx
    typeInDialog(ctx)

    statefulLayout.activateItem(getNode(''), 0)
    assert.deepEqual(statefulLayout.data, [{ str1: 'val1' }, { str3: 'typed' }])
    t.mock.timers.tick(300)
    assert.deepEqual(statefulLayout.data, [{ str1: 'val1' }, { str3: 'typed' }])
  })

  it('should keep a pending input from a sibling field when another oneOf branch is activated', async (t) => {
    const ctx = await init(t)
    const { statefulLayout, getNode } = ctx
    statefulLayout.activateItem(getNode(''), 0)
    statefulLayout.input(getNode('/0/name'), 'typed')

    statefulLayout.activateItem(getNode('/0/$oneOf'), 2)
    assert.deepEqual(statefulLayout.data, [{ name: 'typed' }, {}])
    t.mock.timers.tick(300)
    assert.deepEqual(statefulLayout.data, [{ name: 'typed' }, {}])
  })

  it('should not replace a typed text by the default on the stale blur of a closed dialog', async (t) => {
    const { statefulLayout, getNode } = await init(t, [{ str: 'a' }, { str: 'b' }], {
      type: 'array',
      layout: { listEditMode: 'dialog' },
      items: { type: 'object', properties: { str: { type: 'string', default: 'def' } } }
    })
    statefulLayout.activateItem(getNode(''), 1)
    statefulLayout.input(getNode('/1/str'), '')
    t.mock.timers.tick(300)
    const field = getNode('/1/str')

    statefulLayout.input(field, 'typed')
    statefulLayout.deactivateItem(getNode(''))
    statefulLayout.blur(field)
    t.mock.timers.tick(300)
    assert.deepEqual(statefulLayout.data, [{ str: 'a' }, { str: 'typed' }])
  })
})
