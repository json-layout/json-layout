import { describe, it, beforeEach } from 'node:test'
import { strict as assert } from 'node:assert'
import { writeFileSync, existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { compile as compileSrc, StatefulLayout, i18n } from '../src/index.js'
import { serialize } from '../src/compile/serialize.js'
// import Debug from 'debug'

// const debug = Debug('test')

for (const compileMode of ['runtime', 'build-time']) {
// for (const compileMode of ['build-time']) {
  /** @type {typeof compileSrc} */
  let compile

  describe(`stateful layout with compilation at ${compileMode}`, () => {
    /** @type {string} */
    let currentTest
    beforeEach((test) => {
      currentTest = test.name
    })
    if (compileMode === 'runtime') {
      compile = compileSrc
    } else {
      compile = /** @type {typeof compileSrc} */async (schema, options = {}) => {
        const compiledLayout = compileSrc(schema, { ...options, code: true })
        const code = serialize(compiledLayout) + '\nexport default compiledLayout;'
        const filePath = resolve(`tmp/${currentTest?.replace(/\W/g, '_')}.js`)
        if (existsSync(filePath) && readFileSync(filePath, 'utf8') === code) {
          // nothing todo, prevent infinite reloading of nodejs in watch mode
        } else {
          writeFileSync(filePath, code)
        }
        return (await import(filePath)).default
      }
    }

    it('should manage a simple schema with bi-directional data-binding', async () => {
      const compiledLayout = await compile({
        type: 'object',
        properties: {
          str1: { type: 'string' },
          str2: { type: 'string' },
          int1: { type: 'integer' },
          nb1: { type: 'number' }
        }
      })
      const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTree, {})
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

    it('should preserve immutability of nodes', async () => {
      const compiledLayout = await compile({
        type: 'object',
        properties: {
          str1: { type: 'string' },
          str2: { type: 'string' }
        }
      })
      const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTree, {})
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

    it('should manage simple validation of value', async () => {
      const compiledLayout = await compile({
        type: 'object',
        required: ['str1', 'missingProp'],
        properties: {
          str1: { type: 'string' },
          str2: { type: 'string', pattern: '^[A-Z]+$' },
          obj1: {
            type: 'object',
            required: ['str1'],
            properties: {
              str1: { type: 'string' }
            }
          }
        }
      })
      const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTree, {}, { str2: 'test' })
      assert.equal(statefulLayout.stateTree.valid, false)
      assert.equal(statefulLayout.stateTree.root.error, 'must have required property missingProp')
      assert.equal(statefulLayout.stateTree.root.children?.[0].data, undefined)
      assert.equal(statefulLayout.stateTree.root.children?.[1].error, 'must match pattern "^[A-Z]+$"')

      statefulLayout.input(statefulLayout.stateTree.root.children?.[1], 'TEST')
      assert.equal(statefulLayout.stateTree.root.children?.[1].error, undefined)
    })

    it('should use a switch on read/write mode', async () => {
      const compiledLayout = await compile({
        type: 'object',
        properties: {
          str1: { type: 'string', layout: { switch: [{ if: 'options.readOnly', comp: 'text-field' }, { if: '!options.readOnly', comp: 'textarea' }] } }
        }
      })
      const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTree, {})
      assert.equal(statefulLayout.stateTree.root.children?.length, 1)
      assert.equal(statefulLayout.stateTree.root.children[0].skeleton.key, 'str1')
      assert.equal(statefulLayout.stateTree.root.children[0].layout.comp, 'textarea')
    })

    it('should use a switch on display width', async () => {
      const compiledLayout = await compile({
        type: 'object',
        properties: {
          str1: { type: 'string', layout: { switch: [{ if: 'display.mobile', comp: 'text-field' }, { comp: 'textarea' }] } }
        }
      })
      const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTree, { width: 2000 })
      assert.equal(statefulLayout.stateTree.root.children?.length, 1)
      assert.equal(statefulLayout.stateTree.root.children[0].skeleton.key, 'str1')
      assert.equal(statefulLayout.stateTree.root.children[0].layout.comp, 'textarea')

      statefulLayout.options = { width: 1000 }
      assert.equal(statefulLayout.stateTree.root.children?.length, 1)
      assert.equal(statefulLayout.stateTree.root.children[0].skeleton.key, 'str1')
      assert.equal(statefulLayout.stateTree.root.children[0].layout.comp, 'text-field')
    })

    it('should manage a simple responsive grid', async () => {
      const compiledLayout = await compile({
        type: 'object',
        properties: {
          str1: { type: 'string', layout: { cols: 6 } },
          str2: { type: 'string', layout: { cols: { lg: 6 } } }
        }
      })
      const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTree, { width: 1000 })
      assert.equal(statefulLayout.stateTree.root.options.width, 1000)
      assert.equal(statefulLayout.stateTree.root.cols, 12)
      assert.equal(statefulLayout.stateTree.root.children?.length, 2)
      assert.equal(statefulLayout.stateTree.root.children[0].width, 500)
      assert.equal(statefulLayout.stateTree.root.children[0].cols, 6)
      assert.equal(statefulLayout.stateTree.root.children[1].width, 1000)
      assert.equal(statefulLayout.stateTree.root.children[1].cols, 12)
      statefulLayout.options = { width: 2000 }
      assert.equal(statefulLayout.stateTree.root.children[0].width, 1000)
      assert.equal(statefulLayout.stateTree.root.children[0].cols, 6)
      assert.equal(statefulLayout.stateTree.root.children[1].width, 1000)
      assert.equal(statefulLayout.stateTree.root.children[1].cols, 6)
    })

    it('should manage a simple responsive grid from parent layout', async () => {
      const compiledLayout = await compile({
        type: 'object',
        layout: [{ key: 'str1', cols: 6 }, { key: 'str2', cols: { lg: 6 } }],
        properties: {
          str1: { type: 'string' },
          str2: { type: 'string' }
        }
      })
      const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTree, { width: 1000 })
      assert.equal(statefulLayout.stateTree.root.options.width, 1000)
      assert.equal(statefulLayout.stateTree.root.cols, 12)
      assert.equal(statefulLayout.stateTree.root.children?.length, 2)
      assert.equal(statefulLayout.stateTree.root.children[0].width, 500)
      assert.equal(statefulLayout.stateTree.root.children[0].cols, 6)
      assert.equal(statefulLayout.stateTree.root.children[1].width, 1000)
      assert.equal(statefulLayout.stateTree.root.children[1].cols, 12)
      statefulLayout.options = { width: 2000 }
      assert.equal(statefulLayout.stateTree.root.children[0].width, 1000)
      assert.equal(statefulLayout.stateTree.root.children[0].cols, 6)
      assert.equal(statefulLayout.stateTree.root.children[1].width, 1000)
      assert.equal(statefulLayout.stateTree.root.children[1].cols, 6)
    })

    it('should manage a oneOf in an object', async () => {
      const compiledLayout = await compile({
        type: 'object',
        properties: { str1: { type: 'string' } },
        oneOf: [
          { properties: { str2: { type: 'string' } }, required: ['str2'] },
          { properties: { str3: { type: 'string' } }, required: ['str3'] }
        ]
      })
      const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTree, {})
      assert.ok(!statefulLayout.stateTree.valid)
      assert.ok(!statefulLayout.stateTree.root.error)
      assert.equal(statefulLayout.stateTree.root.children?.length, 2)
      assert.equal(statefulLayout.stateTree.root.children[1].skeleton.key, '$oneOf')
      assert.equal(statefulLayout.stateTree.root.children[1].error, 'chose one')
    })

    it('should manage a allOf in an object', async () => {
      const compiledLayout = await compile({
        type: 'object',
        properties: { str1: { type: 'string' } },
        allOf: [
          { title: 'allOf 1', properties: { str2: { type: 'string' } }, required: ['str2'] },
          { title: 'allOf 2', properties: { str3: { type: 'string' } }, required: ['str3'] }
        ]
      })
      const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTree, {})
      assert.ok(!statefulLayout.stateTree.valid)
      assert.ok(!statefulLayout.stateTree.root.error)
      assert.equal(statefulLayout.stateTree.root.children?.length, 3)
      assert.equal(statefulLayout.stateTree.root.children[1].skeleton.key, '$allOf-0')
      assert.ok(!statefulLayout.stateTree.root.children[1].error)
      assert.equal(statefulLayout.stateTree.root.children[1]?.children?.length, 1)
      assert.equal(statefulLayout.stateTree.root.children[1].children[0].error, 'required information')
      assert.equal(statefulLayout.stateTree.root.children[2].skeleton.key, '$allOf-1')
      assert.ok(!statefulLayout.stateTree.root.children[2].error)
      assert.equal(statefulLayout.stateTree.root.children[2]?.children?.length, 1)
      assert.equal(statefulLayout.stateTree.root.children[2].children[0].error, 'required information')
    })

    it('should manage arrays of strings as comboboxes', async () => {
      const compiledLayout = await compile({
        type: 'object',
        properties: { arr1: { type: 'array', items: { type: 'string', minLength: 2 } } }
      })
      assert.equal(compiledLayout.skeletonTree.root.children?.length, 1)
      assert.ok(!compiledLayout.skeletonTree.root.children[0].children)
      assert.equal(compiledLayout.skeletonTree.root.children[0].childrenTrees?.length, 1)
      const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTree, {}, {
        arr1: ['Str 1', 'Str 2', 'a']
      })
      const arrNode = statefulLayout.stateTree.root.children?.[0]
      assert.ok(arrNode)
      assert.equal(arrNode.layout.comp, 'combobox')
      assert.deepEqual(arrNode.data, ['Str 1', 'Str 2', 'a'])
      assert.ok(!arrNode.children)
      assert.equal(statefulLayout.stateTree.valid, false)
      assert.equal(arrNode.error, 'must NOT be shorter than 2 characters')

      statefulLayout.input(arrNode, ['test'])
      assert.equal(statefulLayout.stateTree.valid, true)
    })

    it('should manage arrays as lists', async () => {
      const compiledLayout = await compile({
        type: 'object',
        properties: { arr1: { type: 'array', layout: 'list', items: { type: 'string', minLength: 2 } } }
      })
      assert.equal(compiledLayout.skeletonTree.root.children?.length, 1)
      assert.ok(!compiledLayout.skeletonTree.root.children[0].children)
      assert.equal(compiledLayout.skeletonTree.root.children[0].childrenTrees?.length, 1)
      const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTree, {}, {
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
      assert.equal(arrNode.children?.[2].error, 'must NOT be shorter than 2 characters')

      statefulLayout.input(arrNode.children[0], 'test')
      const arrNode2 = statefulLayout.stateTree.root.children?.[0]
      assert.ok(arrNode2)
      assert.notEqual(arrNode, arrNode2)
      assert.equal(arrNode2.children?.[0].data, 'test')
    })

    it('should manage tuples', async () => {
      const compiledLayout = await compile({
        type: 'object',
        properties: { arr1: { type: 'array', items: [{ title: 'Str 1', type: 'string' }, { title: 'Str2', type: 'string' }] } }
      })
      assert.equal(compiledLayout.skeletonTree.root.children?.length, 1)
      assert.equal(compiledLayout.skeletonTree.root.children[0].children?.length, 2)
      const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTree, {}, {
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

    it('should manage empty tuples', async () => {
      const compiledLayout = await compile({
        type: 'object',
        properties: { arr1: { type: 'array', items: [{ title: 'Str 1', type: 'string' }, { title: 'Str2', type: 'string' }] } }
      })
      const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTree, {}, {})
      const arrNode = statefulLayout.stateTree.root.children?.[0]
      assert.ok(arrNode)
      assert.equal(arrNode.data, undefined)
      assert.equal(arrNode.layout.comp, 'section')
      assert.equal(arrNode.children?.length, 2)
      statefulLayout.input(arrNode.children[0], 'test')
      const arrNode2 = statefulLayout.stateTree.root.children?.[0]
      assert.ok(arrNode2)
      assert.notEqual(arrNode, arrNode2)
      assert.ok(!arrNode2.error)
      assert.equal(arrNode2.children?.[0].data, 'test')
    })

    it('should use children info for ordering', async () => {
      const compiledLayout = await compile({
        type: 'object',
        layout: ['str2', 'str1'],
        properties: {
          str1: { type: 'string' },
          str2: { type: 'string' }
        }
      })
      const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTree, {}, {})
      assert.equal(statefulLayout.stateTree.root.children?.[0]?.key, 'str2')
      assert.equal(statefulLayout.stateTree.root.children?.[1]?.key, 'str1')
    })

    it('should accept wrapper composite children', async () => {
      const layout = [{ comp: 'section', title: 'Sec 1', children: ['nb1'] }, { comp: 'section', title: 'Sec 2', children: ['nb2'] }]
      const compiledLayout = await compile({
        type: 'object',
        layout,
        properties: { nb1: { type: 'number' }, nb2: { type: 'number' } }
      })
      const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTree, {}, {})
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

    it('merge options going down the state tree', async () => {
      const compiledLayout = await compile({ type: 'object', layout: { options: { opt1: 'Opt 1' } }, properties: { str1: { type: 'string', layout: { options: { opt2: 'Opt 2' } } } } })
      const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTree, { opt0: 'Opt 0', opt2: 'Opt 0/2' }, {})
      assert.deepEqual(statefulLayout.stateTree.root.options, {
        opt0: 'Opt 0',
        opt2: 'Opt 0/2',
        opt1: 'Opt 1',
        context: {},
        width: 1000,
        readOnly: false,
        summary: false,
        titleDepth: 2,
        initialValidation: 'withData',
        removeAdditional: 'error',
        defaultOn: 'empty',
        validateOn: 'input',
        messages: i18n.en,
        autofocus: false
      })
      assert.deepEqual(statefulLayout.stateTree.root.children?.[0].options, {
        opt0: 'Opt 0',
        opt2: 'Opt 2',
        opt1: 'Opt 1',
        context: {},
        width: 1000,
        readOnly: false,
        summary: false,
        titleDepth: 2,
        initialValidation: 'withData',
        removeAdditional: 'error',
        defaultOn: 'empty',
        validateOn: 'input',
        messages: i18n.en,
        autofocus: false
      })
    })

    it('should manage empty data differently if it is required or not', async () => {
      const compiledLayout = await compile({
        type: 'object',
        required: ['str2', 'obj3'],
        properties: {
          str1: { type: 'string' },
          str2: { type: 'string' },
          obj1: { type: 'object', properties: { str1: { type: 'string' } } },
          obj2: { type: 'object', required: ['str1'], properties: { str1: { type: 'string' } } },
          obj3: { type: 'object', properties: { str1: { type: 'string' } } }
        }
      })
      const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTree, {}, {})
      assert.deepEqual(statefulLayout.data, {
        obj3: {}
      })

      assert.equal(statefulLayout.stateTree.root.children?.length, 5)
      statefulLayout.input(statefulLayout.stateTree.root.children[0], 'Str 1')
      statefulLayout.input(statefulLayout.stateTree.root.children[1], 'Str 2')
      assert.equal(statefulLayout.stateTree.root.children[2].children?.length, 1)
      statefulLayout.input(statefulLayout.stateTree.root.children[2].children[0], 'Str 1')
      assert.equal(statefulLayout.stateTree.root.children[3].children?.length, 1)
      statefulLayout.input(statefulLayout.stateTree.root.children[3].children[0], 'Str 1')
      assert.deepEqual(statefulLayout.data, {
        str1: 'Str 1',
        str2: 'Str 2',
        obj3: {},
        obj1: { str1: 'Str 1' },
        obj2: { str1: 'Str 1' }
      })

      statefulLayout.input(statefulLayout.stateTree.root.children[0], '')
      statefulLayout.input(statefulLayout.stateTree.root.children[1], '')
      statefulLayout.input(statefulLayout.stateTree.root.children[2].children[0], '')
      statefulLayout.input(statefulLayout.stateTree.root.children[3].children[0], '')
      assert.deepEqual(statefulLayout.data, {
        obj3: {}
      })
    })

    it('should add readOnly and summary options to array items', async () => {
      const compiledLayout = await compile({
        type: 'array',
        items: {
          type: 'object',
          layout: {
            switch: [{
              if: 'options.summary',
              children: ['str1']
            }]
          },
          properties: {
            str1: { type: 'string' },
            str2: { type: 'string' }
          }
        }
      })
      const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTree, {}, [{ str1: 'Str 1', str2: 'Str 2' }])
      assert.equal(statefulLayout.stateTree.root.children?.length, 1)
      assert.deepEqual(statefulLayout.stateTree.root.children[0].data, { str1: 'Str 1', str2: 'Str 2' })
      assert.equal(statefulLayout.stateTree.root.children[0].options.summary, true)
      assert.equal(statefulLayout.stateTree.root.children[0].options.readOnly, true)
      assert.equal(statefulLayout.stateTree.root.children[0]?.children?.length, 1)
      assert.equal(statefulLayout.stateTree.root.children[0]?.children[0].key, 'str1')
    })

    it('should manage active element in an array', async () => {
      const compiledLayout = await compile({
        type: 'array',
        items: {
          type: 'object',
          properties: {
            str1: { type: 'string' }
          }
        }
      })
      const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTree, {}, [{ str1: 'test1' }, { str2: 'test1' }])
      assert.equal(statefulLayout.stateTree.root.children?.[0].options.readOnly, true)
      assert.equal(statefulLayout.stateTree.root.children?.[0].options.summary, true)
      assert.equal(statefulLayout.stateTree.root.children?.[1].options.readOnly, true)
      assert.equal(statefulLayout.stateTree.root.children?.[1].options.summary, true)

      statefulLayout.activateItem(statefulLayout.stateTree.root, 0)
      assert.equal(statefulLayout.stateTree.root.children?.[0].options.readOnly, false)
      assert.equal(statefulLayout.stateTree.root.children?.[0].options.summary, false)
      assert.equal(statefulLayout.stateTree.root.children?.[1].options.readOnly, true)
      assert.equal(statefulLayout.stateTree.root.children?.[1].options.summary, true)
    })

    it('should manage active element in a oneOf', async () => {
      const compiledLayout = await compile({
        type: 'object',
        oneOf: [{
          properties: {
            key: { type: 'string', const: 'key1' },
            str1: { type: 'string' }
          }
        }, {
          properties: {
            key: { type: 'string', const: 'key2' },
            str2: { type: 'string' },
            str3: { type: 'string', const: 'string 3' }
          }
        }, {
          properties: {
            key: { type: 'string', const: 'key3' },
            str3: { type: 'string' }
          }
        }]
      })
      const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTree, {}, { key: 'key2' })
      assert.equal(statefulLayout.stateTree.root.children?.[0].key, '$oneOf')
      assert.equal(statefulLayout.stateTree.root.children?.[0].children?.length, 1)
      assert.equal(statefulLayout.stateTree.root.children?.[0].children?.[0].key, 1)
      assert.deepEqual(statefulLayout.stateTree.root.data, { key: 'key2', str3: 'string 3' })
      assert.deepEqual(statefulLayout.stateTree.root.children?.[0].data, { key: 'key2', str3: 'string 3' })
      assert.deepEqual(statefulLayout.stateTree.root.children?.[0].children?.[0].data, { key: 'key2', str3: 'string 3' })

      assert.ok(statefulLayout.stateTree.root.children?.[0].children?.[0].children?.[1])
      statefulLayout.input(statefulLayout.stateTree.root.children?.[0].children?.[0].children?.[1], 'string 2')

      assert.deepEqual(statefulLayout.stateTree.root.data, { key: 'key2', str2: 'string 2', str3: 'string 3' })
      assert.deepEqual(statefulLayout.stateTree.root.children?.[0].data, { key: 'key2', str2: 'string 2', str3: 'string 3' })
      assert.deepEqual(statefulLayout.stateTree.root.children?.[0].children?.[0].data, { key: 'key2', str2: 'string 2', str3: 'string 3' })

      statefulLayout.activateItem(statefulLayout.stateTree.root.children?.[0], 2)

      // TODO: additional properties should be removed
      assert.equal(statefulLayout.stateTree.root.data.key, 'key3')
      assert.equal(statefulLayout.stateTree.root.children?.[0].data.key, 'key3')
      assert.equal(statefulLayout.stateTree.root.children?.[0].children?.[0].data.key, 'key3')
    })

    it('should manage a nullable type', async () => {
      const compiledLayout = await compile({
        type: 'object',
        properties: {
          str1: { type: ['string', 'null'] }
        }
      })
      const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTree, {})
      assert.deepEqual(statefulLayout.stateTree.root.layout.comp, 'section')
      assert.deepEqual(statefulLayout.stateTree.root.data, { str1: null })
      assert.ok(statefulLayout.stateTree.root.children)
      assert.equal(statefulLayout.stateTree.root.children.length, 1)
      assert.ok(statefulLayout.stateTree.root.children[0].skeleton.key, 'str1')
      assert.equal(statefulLayout.stateTree.root.children[0].data, null)

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
  })
}
