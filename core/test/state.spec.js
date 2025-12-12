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

  const defaultOptions = { debounceInputMs: 0 }

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
        const compiledLayout = compileSrc(schema, options)
        const code = (await serialize(compiledLayout)) + '\nexport default compiledLayout;'
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
      const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions)
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
      const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions)
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
      // node has changed, but not options or messages which are immutable too
      assert.equal(root2.children?.[1].options, root3.children?.[1].options)
      assert.equal(root2.children?.[1].messages, root3.children?.[1].messages)

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
          str1: { type: 'string' }
        }
      })
      const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions, { str2: 'test' })
      assert.equal(statefulLayout.stateTree.valid, false)
      assert.equal(statefulLayout.stateTree.root.error, 'must have required property missingProp')
    })

    it('should merge info from references', async () => {
      const compiledLayout = await compile({
        type: 'object',
        properties: {
          testRef: {
            title: 'Test ref',
            $ref: '#/$defs/test'
          }
        },
        $defs: {
          test: {
            type: 'object',
            title: 'Test',
            properties: {
              str1: { type: 'string' }
            }
          }
        }
      })
      const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions, { str2: 'test' })
      assert.equal(statefulLayout.stateTree.root.children?.[0].layout.title, 'Test ref')
    })

    it('should use a switch on read/write mode', async () => {
      const compiledLayout = await compile({
        type: 'object',
        properties: {
          str1: { type: 'string', layout: { switch: [{ if: 'options.readOnly', comp: 'text-field' }, { if: '!options.readOnly', comp: 'textarea' }] } }
        }
      })
      const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions)
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
      const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], { ...defaultOptions, width: 2000 })
      assert.equal(statefulLayout.stateTree.root.children?.length, 1)
      assert.equal(statefulLayout.stateTree.root.children[0].skeleton.key, 'str1')
      assert.equal(statefulLayout.stateTree.root.children[0].layout.comp, 'textarea')

      statefulLayout.options = { width: 1000 }
      assert.equal(statefulLayout.stateTree.root.children?.length, 1)
      assert.equal(statefulLayout.stateTree.root.children[0].skeleton.key, 'str1')
      assert.equal(statefulLayout.stateTree.root.children[0].layout.comp, 'text-field')
    })

    it('should use a switch on data', async () => {
      const compiledLayout = await compile({
        type: 'object',
        properties: {
          str1: { type: 'string', enum: ['short', 'long'] },
          str2: {
            type: 'string',
            layout: {
              switch: [
                { if: { expr: 'parent.data?.str1 === "short"', pure: false }, comp: 'text-field' },
                { if: { expr: 'parent.data?.str1 === "long"', pure: false }, comp: 'textarea' },
                { comp: 'none' }
              ]
            }
          }
        }
      })
      const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions)
      assert.equal(statefulLayout.stateTree.root.children?.length, 2)
      assert.equal(statefulLayout.stateTree.root.children[0].key, 'str1')
      assert.equal(statefulLayout.stateTree.root.children[0].layout.comp, 'select')
      assert.equal(statefulLayout.stateTree.root.children[1].key, 'str2')
      assert.equal(statefulLayout.stateTree.root.children[1].layout.comp, 'none')
      statefulLayout.input(statefulLayout.stateTree.root.children[0], 'short')
      assert.equal(statefulLayout.stateTree.root.children[1].layout.comp, 'text-field')
      statefulLayout.input(statefulLayout.stateTree.root.children[0], 'long')
      assert.equal(statefulLayout.stateTree.root.children[1].layout.comp, 'textarea')
    })

    it('should manage a simple responsive grid', async () => {
      const compiledLayout = await compile({
        type: 'object',
        properties: {
          str1: { type: 'string', layout: { cols: 6 } },
          str2: { type: 'string', layout: { cols: { lg: 6 } } }
        }
      })
      const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], { ...defaultOptions, width: 1000 })
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
      const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], { ...defaultOptions, width: 1000 })
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
      const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions)
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
      const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions)
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
      const mainTree = compiledLayout.skeletonTrees[compiledLayout.mainTree]
      const root = compiledLayout.skeletonNodes[mainTree.root]
      assert.equal(root.children?.length, 1)
      const children = root.children.map(c => compiledLayout.skeletonNodes[c])
      assert.ok(!children[0].children)
      assert.equal(children[0].childrenTrees?.length, 1)
      const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions, {
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

    it('should manage tuples', async () => {
      const compiledLayout = await compile({
        type: 'object',
        properties: { arr1: { type: 'array', items: [{ title: 'Str 1', type: 'string' }, { title: 'Str2', type: 'string' }] } }
      })
      const mainTree = compiledLayout.skeletonTrees[compiledLayout.mainTree]
      const root = compiledLayout.skeletonNodes[mainTree.root]
      assert.equal(root.children?.length, 1)
      const children = root.children.map(c => compiledLayout.skeletonNodes[c])
      assert.equal(children[0].children?.length, 2)
      const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions, {
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
      const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions, {})
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
      const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions, {})
      assert.equal(statefulLayout.stateTree.root.children?.[0]?.key, 'str2')
      assert.equal(statefulLayout.stateTree.root.children?.[1]?.key, 'str1')
    })

    it('should accept wrapper composite children', async () => {
      const layout = [{
        comp: 'card',
        title: 'Sec 1',
        props: { variant: 'outlined' },
        children: ['nb1']
      }, {
        title: 'Sec 2',
        children: ['nb2']
      }]
      const compiledLayout = await compile({
        type: 'object',
        layout,
        properties: { nb1: { type: 'number' }, nb2: { type: 'number' } }
      })
      const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions, {})
      assert.equal(statefulLayout.stateTree.root.children?.length, 2)
      assert.equal(statefulLayout.stateTree.root.children[0].key, '$comp-1')
      assert.equal(statefulLayout.stateTree.root.children[0].layout.comp, 'card')
      assert.deepEqual(statefulLayout.stateTree.root.children[0].props, { variant: 'outlined' })
      assert.equal(statefulLayout.stateTree.root.children[0].children?.length, 1)
      assert.equal(statefulLayout.stateTree.root.children[0].children[0].key, 'nb1')
      assert.equal(statefulLayout.stateTree.root.children[1].key, '$comp-2')
      assert.equal(statefulLayout.stateTree.root.children[1].layout.comp, 'section')
      assert.equal(statefulLayout.stateTree.root.children[1].children?.length, 1)
      assert.equal(statefulLayout.stateTree.root.children[1].children[0].key, 'nb2')

      statefulLayout.input(statefulLayout.stateTree.root.children[0].children[0], 10)
      assert.deepEqual(statefulLayout.data, { nb1: 10 })
      assert.equal(statefulLayout.stateTree.root.children[0].children[0].data, 10)
    })

    it('should accept wrapper composite children with ifs', async () => {
      const layout = [{ comp: 'section', title: 'Sec 1', children: [{ key: 'nb1', if: '!readOnly' }] }]
      const compiledLayout = await compile({
        type: 'object',
        layout,
        properties: { nb1: { type: 'number' }, nb2: { type: 'number' } }
      })
      const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions, {})
      assert.equal(statefulLayout.stateTree.root.children?.length, 1)
      assert.equal(statefulLayout.stateTree.root.children[0].key, '$comp-1')
      assert.equal(statefulLayout.stateTree.root.children[0].children?.length, 1)
      assert.equal(statefulLayout.stateTree.root.children[0].children[0].key, 'nb1')
      assert.equal(statefulLayout.stateTree.root.children[0].children[0].layout.comp, 'number-field')
      statefulLayout.options = { ...defaultOptions, readOnly: true }
      assert.equal(statefulLayout.stateTree.root.children?.length, 1)
      assert.equal(statefulLayout.stateTree.root.children[0].key, '$comp-1')
      assert.equal(statefulLayout.stateTree.root.children[0].children?.length, 1)
      assert.equal(statefulLayout.stateTree.root.children[0].children[0].key, 'nb1')
      assert.equal(statefulLayout.stateTree.root.children[0].children[0].layout.comp, 'none')
      // assert.equal(statefulLayout.stateTree.root.children[0].children?.length, 0)
    })

    it('merge options going down the state tree', async () => {
      const compiledLayout = await compile({ type: 'object', layout: { options: { opt1: 'Opt 1' } }, properties: { str1: { type: 'string', layout: { options: { opt2: 'Opt 2' } } } } })
      const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], { ...defaultOptions, opt0: 'Opt 0', opt2: 'Opt 0/2' }, {})
      assert.deepEqual(statefulLayout.stateTree.root.options, {
        opt0: 'Opt 0',
        opt2: 'Opt 0/2',
        opt1: 'Opt 1',
        context: {},
        width: 1000,
        readOnly: false,
        summary: false,
        density: 'default',
        indent: false,
        titleDepth: 2,
        initialValidation: 'withData',
        removeAdditional: 'error',
        defaultOn: 'empty',
        validateOn: 'input',
        updateOn: 'input',
        debounceInputMs: 0,
        messages: i18n.en,
        autofocus: false,
        readOnlyPropertiesMode: 'show',
        fetchBaseURL: '/',
        fetchOptions: {},
        noStateCache: false,
        fetch: statefulLayout.stateTree.root.options.fetch,
        onData: statefulLayout.stateTree.root.options.onData,
        onUpdate: statefulLayout.stateTree.root.options.onUpdate,
        onAutofocus: statefulLayout.stateTree.root.options.onAutofocus
      })
      assert.deepEqual(statefulLayout.stateTree.root.children?.[0].options, {
        opt0: 'Opt 0',
        opt2: 'Opt 2',
        opt1: 'Opt 1',
        context: {},
        width: 1000,
        readOnly: false,
        summary: false,
        density: 'default',
        indent: false,
        titleDepth: 2,
        initialValidation: 'withData',
        removeAdditional: 'error',
        defaultOn: 'empty',
        validateOn: 'input',
        updateOn: 'input',
        debounceInputMs: 0,
        messages: i18n.en,
        autofocus: false,
        readOnlyPropertiesMode: 'show',
        fetchOptions: {},
        fetchBaseURL: '/',
        noStateCache: false,
        fetch: statefulLayout.stateTree.root.options.fetch,
        onData: statefulLayout.stateTree.root.children?.[0].options.onData,
        onUpdate: statefulLayout.stateTree.root.children?.[0].options.onUpdate,
        onAutofocus: statefulLayout.stateTree.root.children?.[0].options.onAutofocus
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
          obj3: { type: 'object', properties: { str1: { type: 'string' } } },
          nb1: { type: 'integer' }
        }
      })
      const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions, {})
      assert.deepEqual(statefulLayout.data, {
        obj3: {}
      })

      assert.equal(statefulLayout.stateTree.root.children?.length, 6)
      statefulLayout.input(statefulLayout.stateTree.root.children[0], 'Str 1')
      statefulLayout.input(statefulLayout.stateTree.root.children[1], 'Str 2')
      assert.equal(statefulLayout.stateTree.root.children[2].children?.length, 1)
      statefulLayout.input(statefulLayout.stateTree.root.children[2].children[0], 'Str 1')
      assert.equal(statefulLayout.stateTree.root.children[3].children?.length, 1)
      statefulLayout.input(statefulLayout.stateTree.root.children[3].children[0], 'Str 1')
      statefulLayout.input(statefulLayout.stateTree.root.children[5], 1)
      assert.deepEqual(statefulLayout.data, {
        str1: 'Str 1',
        str2: 'Str 2',
        obj1: { str1: 'Str 1' },
        obj2: { str1: 'Str 1' },
        obj3: {},
        nb1: 1
      })

      statefulLayout.input(statefulLayout.stateTree.root.children[0], '')
      statefulLayout.input(statefulLayout.stateTree.root.children[1], '')
      statefulLayout.input(statefulLayout.stateTree.root.children[2].children[0], '')
      statefulLayout.input(statefulLayout.stateTree.root.children[3].children[0], '')
      statefulLayout.input(statefulLayout.stateTree.root.children[5], undefined)
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
              if: 'summary',
              children: ['str1']
            }]
          },
          properties: {
            str1: { type: 'string' },
            str2: { type: 'string' }
          }
        }
      })
      const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions, [{ str1: 'Str 1', str2: 'Str 2' }])
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
      const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions, [{ str1: 'test1' }, { str2: 'test1' }])
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

    it('should manage a complex allOf/oneOf schema with tabs', async () => {
      const compiledLayout = await compile({
        type: 'object',
        layout: 'tabs',
        required: ['datasetMode', 'message'],
        allOf: [{
          title: 'Dataset',
          oneOf: [{
            title: 'Create a dataset',
            required: ['dataset'],
            properties: {
              datasetMode: { type: 'string', const: 'create', title: 'Action' },
              dataset: {
                type: 'object',
                required: ['title'],
                properties: {
                  id: { type: 'string' },
                  title: { type: 'string', default: 'Hello world ' }
                }
              }
            }
          }, {
            title: 'Update a dataset',
            required: ['dataset'],
            properties: {
              datasetMode: { type: 'string', const: 'update' },
              dataset: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  title: { type: 'string' }
                }
              }
            }
          }]
        }, {
          title: 'Content',
          properties: {
            message: { type: 'string', default: 'world !' }
          }
        }]
      })
      const statefulLayout = new StatefulLayout(compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree], defaultOptions)
      assert.equal(statefulLayout.stateTree.root.layout.comp, 'tabs')
      assert.equal(statefulLayout.stateTree.root.children?.length, 2)
      assert.equal(statefulLayout.stateTree.root.children[0].layout.comp, 'section')
      assert.equal(statefulLayout.stateTree.root.children[0].layout.title, 'Dataset')
      assert.equal(statefulLayout.stateTree.root.children[0].children?.length, 1)
      assert.equal(statefulLayout.stateTree.root.children[0].children[0].layout.comp, 'one-of-select')
      assert.equal(statefulLayout.stateTree.root.children[1].layout.comp, 'section')
      assert.equal(statefulLayout.stateTree.root.children[1].layout.title, 'Content')
    })
  })
}
