import { strict as assert } from 'assert'
import { compile, StatefulLayout } from '../src'
import { type PartialChildren } from '@json-layout/vocabulary'

describe('stateful layout', () => {
  it('should manage a simple schema with bi-directional data-binding', () => {
    const compiledLayout = compile({
      type: 'object',
      properties: {
        str1: { type: 'string' },
        str2: { type: 'string' },
        int1: { type: 'integer' },
        nb1: { type: 'number' }
      }
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTree, 'write', 1000)
    assert.deepEqual(statefulLayout.stateTree.root.layout.comp, 'section')
    assert.deepEqual(statefulLayout.stateTree.root.data, {})
    assert.ok(statefulLayout.stateTree.root.children)
    assert.equal(statefulLayout.stateTree.root.children.length, 4)
    assert.ok(statefulLayout.stateTree.root.children[0].skeleton.key, 'str1')
    assert.equal(statefulLayout.stateTree.root.children[0].data, undefined)

    // input is meant to be triggered by a UI component on a leaf node
    // and it should bubble up to the root value
    statefulLayout.input(statefulLayout.stateTree.root.children[0], 'test')
    assert.deepEqual(statefulLayout.stateTree.root.data, { str1: 'test' })
    assert.equal(statefulLayout.stateTree.root.children[0].data, 'test')

    // simply set the value to hydrate from the root to the leaves
    statefulLayout.data = { str1: 'test2', str2: 'test3', int1: 11, nb1: 11.11 }
    assert.deepEqual(statefulLayout.stateTree.root.data, { str1: 'test2', str2: 'test3', int1: 11, nb1: 11.11 })
    assert.equal(statefulLayout.stateTree.root.children[0].data, 'test2')
  })

  it('should preserve immutability of nodes', () => {
    const compiledLayout = compile({
      type: 'object',
      properties: {
        str1: { type: 'string' },
        str2: { type: 'string' }
      }
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTree, 'write', 1000)
    const root1 = statefulLayout.stateTree.root
    assert.ok(root1.children)

    // a property is changed
    statefulLayout.input(root1.children[0], 'test')
    const root2 = statefulLayout.stateTree.root
    assert.deepEqual(root2.data, { str1: 'test' })
    assert.notEqual(root1, root2)
    assert.notEqual(root1.data, root2.data)
    assert.notEqual(root1.children[0], root2.children?.[0])
    assert.equal(root1.children[1], root2.children?.[1])

    // the root model is changed with only 1 actual property change
    statefulLayout.data = { str1: 'test', str2: 'test2' }
    const root3 = statefulLayout.stateTree.root
    assert.deepEqual(root3.data, { str1: 'test', str2: 'test2' })
    assert.notEqual(root3, root2)
    assert.equal(root2.children?.[0], root3.children?.[0])
    assert.notEqual(root2.children?.[1], root3.children?.[1])

    // no actual change
    statefulLayout.input(root1.children[0], 'test')
    const root4 = statefulLayout.stateTree.root
    assert.equal(root3, root4)
    assert.equal(root3.data, root4.data)
  })

  it('should manage simple validation of value', () => {
    const compiledLayout = compile({
      type: 'object',
      required: ['str1', 'missingProp'],
      properties: {
        str1: { type: 'string' },
        str2: { type: 'string', pattern: '^$[A-Z]+$' },
        obj1: {
          type: 'object',
          required: ['str1'],
          properties: {
            str1: { type: 'string' }
          }
        }
      }
      /* allOf: [{
        // required: ['str1'],
        properties: {
          str3: { type: 'string', pattern: '^$[A-Z]+$' }
        }
      }] */
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTree, 'write', 1000, { str2: 'test' })
    assert.equal(statefulLayout.stateTree.valid, false)
    assert.equal(statefulLayout.stateTree.root.error, 'must have required property \'missingProp\'')
    assert.equal(statefulLayout.stateTree.root.children?.[0].error, 'required')
    assert.equal(statefulLayout.stateTree.root.children?.[1].error, 'must match pattern "^$[A-Z]+$"')
  })

  it('should use a switch on read/write mode', () => {
    const compiledLayout = compile({
      type: 'object',
      properties: {
        str1: { type: 'string', layout: { switch: [{ if: "mode == 'read'", comp: 'text-field' }, { if: "mode == 'write'", comp: 'textarea' }] } }
      }
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTree, 'write', 1000)
    assert.equal(statefulLayout.stateTree.root.children?.length, 1)
    assert.equal(statefulLayout.stateTree.root.children[0].skeleton.key, 'str1')
    assert.equal(statefulLayout.stateTree.root.children[0].layout.comp, 'textarea')
  })

  it('should use a switch on display width', () => {
    const compiledLayout = compile({
      type: 'object',
      properties: {
        str1: { type: 'string', layout: { switch: [{ if: 'display.mobile', comp: 'text-field' }, { comp: 'textarea' }] } }
      }
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTree, 'write', 2000)
    assert.equal(statefulLayout.stateTree.root.children?.length, 1)
    assert.equal(statefulLayout.stateTree.root.children[0].skeleton.key, 'str1')
    assert.equal(statefulLayout.stateTree.root.children[0].layout.comp, 'textarea')

    statefulLayout.width = 1000
    assert.equal(statefulLayout.stateTree.root.children?.length, 1)
    assert.equal(statefulLayout.stateTree.root.children[0].skeleton.key, 'str1')
    assert.equal(statefulLayout.stateTree.root.children[0].layout.comp, 'text-field')
  })

  it('should manage a oneOf in an object', () => {
    const compiledLayout = compile({
      type: 'object',
      properties: { str1: { type: 'string' } },
      oneOf: [
        { properties: { str2: { type: 'string' } }, required: ['str2'] },
        { properties: { str3: { type: 'string' } }, required: ['str3'] }
      ]
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTree, 'write', 1000)
    assert.ok(!statefulLayout.stateTree.valid)
    assert.ok(!statefulLayout.stateTree.root.error)
    assert.equal(statefulLayout.stateTree.root.children?.length, 2)
    assert.equal(statefulLayout.stateTree.root.children[1].skeleton.key, '$oneOf')
    assert.equal(statefulLayout.stateTree.root.children[1].error, 'chose one')
  })

  it('should manage a allOf in an object', () => {
    const compiledLayout = compile({
      type: 'object',
      properties: { str1: { type: 'string' } },
      allOf: [
        { title: 'allOf 1', properties: { str2: { type: 'string' } }, required: ['str2'] },
        { title: 'allOf 2', properties: { str3: { type: 'string' } }, required: ['str3'] }
      ]
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTree, 'write', 1000)
    assert.ok(!statefulLayout.stateTree.valid)
    assert.ok(!statefulLayout.stateTree.root.error)
    assert.equal(statefulLayout.stateTree.root.children?.length, 3)
    assert.equal(statefulLayout.stateTree.root.children[1].skeleton.key, '$allOf-0')
    assert.ok(!statefulLayout.stateTree.root.children[1].error)
    assert.equal(statefulLayout.stateTree.root.children[1]?.children?.length, 1)
    assert.equal(statefulLayout.stateTree.root.children[1].children[0].error, 'required')
    assert.equal(statefulLayout.stateTree.root.children[2].skeleton.key, '$allOf-1')
    assert.ok(!statefulLayout.stateTree.root.children[2].error)
    assert.equal(statefulLayout.stateTree.root.children[2]?.children?.length, 1)
    assert.equal(statefulLayout.stateTree.root.children[2].children[0].error, 'required')
  })

  it('should manage arrays', () => {
    const compiledLayout = compile({
      type: 'object',
      properties: { arr1: { type: 'array', items: { type: 'string', minLength: 2 } } }
    })
    assert.equal(compiledLayout.skeletonTree.root.children?.length, 1)
    assert.ok(!compiledLayout.skeletonTree.root.children[0].children)
    assert.equal(compiledLayout.skeletonTree.root.children[0].childrenTrees?.length, 1)
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTree, 'write', 1000, {
      arr1: ['Str 1', 'Str 2', 'a']
    })
    const arrNode = statefulLayout.stateTree.root.children?.[0]
    assert.ok(arrNode)
    assert.equal(arrNode.layout.comp, 'list')
    assert.deepEqual(arrNode.data, ['Str 1', 'Str 2', 'a'])

    assert.equal(arrNode.children?.length, 3)
    assert.equal(arrNode.children?.[0].key, 0)
    assert.equal(arrNode.children?.[0].data, 'Str 1')
    assert.equal(arrNode.children?.[0].layout.comp, 'text-field')
    assert.equal(arrNode.children?.[1].key, 1)
    assert.equal(arrNode.children?.[1].data, 'Str 2')

    assert.equal(statefulLayout.stateTree.valid, false)
    assert.equal(arrNode.children?.[2].error, 'must NOT have fewer than 2 characters')

    statefulLayout.input(arrNode.children[0], 'test')
    const arrNode2 = statefulLayout.stateTree.root.children?.[0]
    assert.ok(arrNode2)
    assert.notEqual(arrNode, arrNode2)
    assert.equal(arrNode2.children?.[0].data, 'test')
  })

  it('should manage tuples', () => {
    const compiledLayout = compile({
      type: 'object',
      properties: { arr1: { type: 'array', items: [{ title: 'Str 1', type: 'string' }, { title: 'Str2', type: 'string' }] } }
    })
    assert.equal(compiledLayout.skeletonTree.root.children?.length, 1)
    assert.equal(compiledLayout.skeletonTree.root.children[0].children?.length, 2)
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTree, 'write', 1000, {
      arr1: ['Str 1', 'Str 2']
    })
    const arrNode = statefulLayout.stateTree.root.children?.[0]
    assert.ok(arrNode)
    assert.equal(arrNode.layout.comp, 'section')
    assert.deepEqual(arrNode.data, ['Str 1', 'Str 2'])
    assert.equal(arrNode.children?.length, 2)
    assert.equal(arrNode.children?.[0].key, 0)
    assert.equal(arrNode.children?.[0].data, 'Str 1')
    assert.equal(arrNode.children?.[0].layout.comp, 'text-field')
    assert.equal(arrNode.children?.[1].key, 1)
    assert.equal(arrNode.children?.[1].data, 'Str 2')

    statefulLayout.input(arrNode.children[0], 'test')
    const arrNode2 = statefulLayout.stateTree.root.children?.[0]
    assert.ok(arrNode2)
    assert.notEqual(arrNode, arrNode2)
    assert.equal(arrNode2.children?.[0].data, 'test')
  })

  it('should fill default values', () => {
    const compiledLayout = compile({
      type: 'object',
      properties: {
        str1: { type: 'string', default: 'String 1' },
        obj1: { type: 'object', properties: { str2: { type: 'string', default: 'String 2' } } },
        obj2: { type: 'object', properties: { str3: { type: 'string' } } },
        str4: { type: 'string', const: 'String 4' }
      }
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTree, 'write', 1000)

    // console.log(JSON.stringify(statefulLayout.data, null, 2))
    assert.deepEqual(statefulLayout.data, {
      str1: 'String 1',
      obj1: {
        str2: 'String 2'
      },
      obj2: {},
      str4: 'String 4'
    }
    )
  })

  it('should use children info for ordering', () => {
    const compiledLayout = compile({
      type: 'object',
      layout: ['str2', 'str1'],
      properties: {
        str1: { type: 'string' },
        str2: { type: 'string' }
      }
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTree, 'write', 1000)
    assert.equal(statefulLayout.stateTree.root.children?.[0]?.key, 'str2')
    assert.equal(statefulLayout.stateTree.root.children?.[1]?.key, 'str1')
  })

  it('should accept wrapper composite children', () => {
    const layout: PartialChildren = [{ comp: 'section', title: 'Sec 1', children: ['nb1'] }, { comp: 'section', title: 'Sec 2', children: ['nb2'] }]
    const compiledLayout = compile({
      type: 'object',
      layout,
      properties: { nb1: { type: 'number' }, nb2: { type: 'number' } }
    })
    const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTree, 'write', 1000)
    assert.equal(statefulLayout.stateTree.root.children?.length, 2)
    assert.equal(statefulLayout.stateTree.root.children[0].key, '$comp-0')
    assert.equal(statefulLayout.stateTree.root.children[0].children?.length, 1)
    assert.equal(statefulLayout.stateTree.root.children[0].children[0].key, 'nb1')
    assert.equal(statefulLayout.stateTree.root.children[1].key, '$comp-1')
    assert.equal(statefulLayout.stateTree.root.children[1].children?.length, 1)
    assert.equal(statefulLayout.stateTree.root.children[1].children[0].key, 'nb2')

    statefulLayout.input(statefulLayout.stateTree.root.children[0].children[0], 10)
    assert.deepEqual(statefulLayout.data, { nb1: 10 })
    assert.equal(statefulLayout.stateTree.root.children[0].children[0].data, 10)
  })
})
