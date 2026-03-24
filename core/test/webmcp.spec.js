import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'

import { compile } from '../src/compile/index.js'
import { StatefulLayout } from '../src/state/index.js'
import { WebMCP } from '../src/webmcp/index.js'

import * as describeState from '../src/webmcp/tools/describe-state.js'
import * as setFieldValue from '../src/webmcp/tools/set-field-value.js'
import * as setData from '../src/webmcp/tools/set-data.js'
import * as getData from '../src/webmcp/tools/get-data.js'
import * as getFieldSuggestions from '../src/webmcp/tools/get-field-suggestions.js'
import * as editArray from '../src/webmcp/tools/edit-array.js'
import * as fillFormSkill from '../src/webmcp/tools/fill-form-skill.js'

import { projectStateTree, projectFieldResult, collectErrors } from '../src/webmcp/project.js'
import { resolveNode } from '../src/webmcp/resolve.js'

const simpleSchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    age: { type: 'number' },
    email: { type: 'string', format: 'email' }
  },
  required: ['name']
}

const arraySchema = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' }
        }
      }
    }
  }
}

describe('webmcp project functions', () => {
  it('should project state tree with new shape', () => {
    const compiled = compile(simpleSchema)
    const mainTree = compiled.skeletonTrees[compiled.mainTree]
    const layout = new StatefulLayout(compiled, mainTree, { validateOn: 'input' }, { name: 'Alice' })

    const projected = projectStateTree(layout.stateTree, layout)

    assert.equal(projected.valid, true)
    assert.equal(projected.root.path, '')
    assert.equal(projected.root.type, 'section')
    assert.ok(!('key' in projected.root), 'key should not be in projected node')
    assert.ok(!('comp' in projected.root), 'comp should not be in projected node')
    assert.equal(/** @type {any[]} */(projected.root.children).length, 3)

    const children = /** @type {any[]} */(projected.root.children)
    const nameNode = children.find((c) => c.path === '/name')
    assert.ok(nameNode)
    assert.equal(nameNode.type, 'text')
    assert.equal(nameNode.data, 'Alice')
    assert.equal(nameNode.required, true)
  })

  it('should project field result (slim)', () => {
    const compiled = compile(simpleSchema)
    const mainTree = compiled.skeletonTrees[compiled.mainTree]
    const layout = new StatefulLayout(compiled, mainTree, { validateOn: 'input' }, { name: 'Alice' })

    const node = resolveNode(layout.stateTree.root, '/name')
    assert.ok(node)

    const result = projectFieldResult(node, layout)
    assert.equal(result.path, '/name')
    assert.equal(result.type, 'text')
    assert.equal(result.data, 'Alice')
    assert.equal(result.error, undefined)
  })

  it('should collect errors', () => {
    const compiled = compile(simpleSchema)
    const mainTree = compiled.skeletonTrees[compiled.mainTree]
    const layout = new StatefulLayout(compiled, mainTree, { validateOn: 'input' }, {})

    layout.validate()

    const errors = collectErrors(layout.stateTree.root)

    assert.equal(errors.length, 1)
    assert.equal(errors[0].path, '/name')
    assert.equal(errors[0].message, 'required information')
  })

  it('should include modified flag when savedData is provided', () => {
    const compiled = compile(simpleSchema)
    const mainTree = compiled.skeletonTrees[compiled.mainTree]
    const savedData = { name: 'Alice' }
    const layout = new StatefulLayout(compiled, mainTree, { validateOn: 'input' }, { name: 'Bob' }, savedData)

    const projected = projectStateTree(layout.stateTree, layout)
    const nameNode = /** @type {any[]} */(projected.root.children).find((c) => c.path === '/name')
    assert.equal(nameNode.modified, true)

    const ageNode = /** @type {any[]} */(projected.root.children).find((c) => c.path === '/age')
    assert.equal(ageNode.modified, undefined)
  })

  it('should not include childError in projected nodes', () => {
    const compiled = compile(simpleSchema)
    const mainTree = compiled.skeletonTrees[compiled.mainTree]
    const layout = new StatefulLayout(compiled, mainTree, { validateOn: 'input' }, {})
    layout.validate()

    const projected = projectStateTree(layout.stateTree, layout)
    assert.ok(!('childError' in projected.root), 'childError should not be in projected node')
  })
})

describe('webmcp resolveNode', () => {
  it('should resolve root', () => {
    const compiled = compile(simpleSchema)
    const mainTree = compiled.skeletonTrees[compiled.mainTree]
    const layout = new StatefulLayout(compiled, mainTree, {}, { name: 'Alice' })

    const node = resolveNode(layout.stateTree.root, '/')

    assert.equal(node, layout.stateTree.root)
  })

  it('should resolve nested path', () => {
    const compiled = compile(simpleSchema)
    const mainTree = compiled.skeletonTrees[compiled.mainTree]
    const layout = new StatefulLayout(compiled, mainTree, {}, { name: 'Alice' })

    const node = resolveNode(layout.stateTree.root, '/name')

    assert.ok(node)
    assert.equal(node.key, 'name')
  })
})

describe('webmcp tool functions', () => {
  it('should describeState return full tree', () => {
    const compiled = compile(simpleSchema)
    const mainTree = compiled.skeletonTrees[compiled.mainTree]
    const layout = new StatefulLayout(compiled, mainTree, { validateOn: 'input' }, { name: 'Alice' })

    const result = describeState.execute(layout, {})

    assert.equal(result.valid, true)
    const state = /** @type {any} */(result.state)
    assert.equal(state.root.path, '')
    assert.equal(result.errors.length, 0)
  })

  it('should describeState by path', () => {
    const compiled = compile(simpleSchema)
    const mainTree = compiled.skeletonTrees[compiled.mainTree]
    const layout = new StatefulLayout(compiled, mainTree, { validateOn: 'input' }, { name: 'Alice' })

    const result = describeState.execute(layout, { path: '/name' })

    assert.equal(result.valid, true)
    const state = /** @type {any} */(result.state)
    assert.equal(state.path, '/name')
    assert.equal(state.data, 'Alice')
  })

  it('should setFieldValue return slim response', () => {
    const compiled = compile(simpleSchema)
    const mainTree = compiled.skeletonTrees[compiled.mainTree]
    const layout = new StatefulLayout(compiled, mainTree, { validateOn: 'input' }, {})

    const result = setFieldValue.execute(layout, { path: '/name', value: 'Bob' })

    assert.ok(result.field)
    assert.equal(result.field.path, '/name')
    assert.equal(result.field.data, 'Bob')
    assert.equal(result.field.type, 'text')
    assert.equal(typeof result.valid, 'boolean')
    assert.ok(Array.isArray(result.errors))
    assert.ok(!('state' in result), 'should not return full state tree')
  })

  it('should setData return slim response', () => {
    const compiled = compile(simpleSchema)
    const mainTree = compiled.skeletonTrees[compiled.mainTree]
    const layout = new StatefulLayout(compiled, mainTree, { validateOn: 'input' }, {})

    const result = setData.execute(layout, { data: { name: 'Charlie', age: 30 } })

    const data = /** @type {any} */(layout.data)
    assert.equal(data.name, 'Charlie')
    assert.equal(data.age, 30)
    assert.equal(result.valid, true)
    assert.ok(Array.isArray(result.errors))
    assert.ok(!('state' in result), 'should not return full state tree')
  })

  it('should getData', () => {
    const compiled = compile(simpleSchema)
    const mainTree = compiled.skeletonTrees[compiled.mainTree]
    const layout = new StatefulLayout(compiled, mainTree, { validateOn: 'input' }, { name: 'Alice', age: 25 })

    const result = getData.execute(layout, {})

    const data = /** @type {any} */(result.data)
    assert.equal(data.name, 'Alice')
    assert.equal(data.age, 25)
    assert.equal(result.valid, true)
  })

  it('should use fillFormSkill', () => {
    const compiled = compile(simpleSchema)
    const mainTree = compiled.skeletonTrees[compiled.mainTree]
    const layout = new StatefulLayout(compiled, mainTree, {}, {})

    const result = fillFormSkill.generateSkill('test-form', '', false, layout)
    assert.ok(result.includes('JSON Test-form Form-Filling Guide'))
  })

  it('should editArray add item', () => {
    const compiled = compile(arraySchema)
    const mainTree = compiled.skeletonTrees[compiled.mainTree]
    const layout = new StatefulLayout(compiled, mainTree, { validateOn: 'input' }, { items: [{ name: 'a' }, { name: 'b' }] })

    const result = editArray.execute(layout, { path: '/items', action: 'add', value: { name: 'c' } })

    assert.equal(result.itemCount, 3)
    assert.equal(typeof result.valid, 'boolean')
    assert.ok(Array.isArray(result.errors))
  })

  it('should editArray remove item', () => {
    const compiled = compile(arraySchema)
    const mainTree = compiled.skeletonTrees[compiled.mainTree]
    const layout = new StatefulLayout(compiled, mainTree, { validateOn: 'input' }, { items: [{ name: 'a' }, { name: 'b' }, { name: 'c' }] })

    const result = editArray.execute(layout, { path: '/items', action: 'remove', index: 1 })

    assert.equal(result.itemCount, 2)
  })

  it('should editArray reject non-array node', () => {
    const compiled = compile(simpleSchema)
    const mainTree = compiled.skeletonTrees[compiled.mainTree]
    const layout = new StatefulLayout(compiled, mainTree, { validateOn: 'input' }, { name: 'Alice' })

    assert.throws(() => {
      editArray.execute(layout, { path: '/name', action: 'add', value: 'x' })
    }, /not an array/)
  })

  it('should editArray reject remove from empty array', () => {
    const compiled = compile(arraySchema)
    const mainTree = compiled.skeletonTrees[compiled.mainTree]
    const layout = new StatefulLayout(compiled, mainTree, { validateOn: 'input' }, { items: [] })

    assert.throws(() => {
      editArray.execute(layout, { path: '/items', action: 'remove' })
    }, /empty array/)
  })
})

describe('webmcp tool schemas', () => {
  it('should have valid describeStateSchema', () => {
    assert.equal(describeState.inputSchema.type, 'object')
    assert.ok(describeState.inputSchema.properties.path)
  })

  it('should have valid setFieldValueSchema', () => {
    assert.equal(setFieldValue.inputSchema.type, 'object')
    assert.ok(setFieldValue.inputSchema.properties.path)
    assert.ok(setFieldValue.inputSchema.properties.value)
    assert.deepEqual(setFieldValue.inputSchema.required, ['path', 'value'])
  })

  it('should have valid setDataSchema', () => {
    assert.equal(setData.inputSchema.type, 'object')
    assert.ok(setData.inputSchema.properties.data)
    assert.deepEqual(setData.inputSchema.required, ['data'])
  })

  it('should have valid getDataSchema', () => {
    assert.equal(getData.inputSchema.type, 'object')
    assert.deepEqual(Object.keys(getData.inputSchema.properties), [])
  })

  it('should have valid getFieldSuggestionsSchema', () => {
    assert.equal(getFieldSuggestions.inputSchema.type, 'object')
    assert.ok(getFieldSuggestions.inputSchema.properties.path)
    assert.ok(getFieldSuggestions.inputSchema.properties.query)
    assert.deepEqual(getFieldSuggestions.inputSchema.required, ['path'])
  })

  it('should have valid editArraySchema', () => {
    assert.equal(editArray.inputSchema.type, 'object')
    assert.ok(editArray.inputSchema.properties.path)
    assert.ok(editArray.inputSchema.properties.action)
    assert.deepEqual(editArray.inputSchema.required, ['path', 'action'])
  })
})

describe('webmcp WebMCP class', () => {
  it('should create WebMCP instance', () => {
    const compiled = compile(simpleSchema)
    const mainTree = compiled.skeletonTrees[compiled.mainTree]
    const layout = new StatefulLayout(compiled, mainTree, {}, {})

    const webmcp = new WebMCP(layout, { prefixName: 'test_', dataTitle: 'custom-form' })

    assert.equal(webmcp._prefixName, 'test_')
    assert.equal(webmcp._dataTitle, 'custom-form')
    assert.equal(webmcp._registeredTools.length, 0)
  })

  it('should not include fillFormSkill by default', () => {
    const compiled = compile(simpleSchema)
    const mainTree = compiled.skeletonTrees[compiled.mainTree]
    const layout = new StatefulLayout(compiled, mainTree, {}, {})

    const webmcp = new WebMCP(layout)
    const tools = webmcp.getTools()

    assert.ok(!tools.find((t) => t.name === 'fillFormSkill'))
  })

  it('should include fillFormSkill when opted in', () => {
    const compiled = compile(simpleSchema)
    const mainTree = compiled.skeletonTrees[compiled.mainTree]
    const layout = new StatefulLayout(compiled, mainTree, {}, {})

    const webmcp = new WebMCP(layout, { includeFillFormSkill: true })
    const tools = webmcp.getTools()

    assert.ok(tools.find((t) => t.name === 'fillFormSkill'))
  })

  it('should generate tool names with prefix', () => {
    const compiled = compile(simpleSchema)
    const mainTree = compiled.skeletonTrees[compiled.mainTree]
    const layout = new StatefulLayout(compiled, mainTree, {}, {})

    const webmcp = new WebMCP(layout, { prefixName: 'myform_' })

    const tools = webmcp.getTools()
    const names = tools.map((t) => t.name)

    assert.ok(names.includes('myform_getData'))
    assert.ok(names.includes('myform_setData'))
    assert.ok(names.includes('myform_describeState'))
    assert.ok(names.includes('myform_setFieldValue'))
    assert.ok(names.includes('myform_getFieldSuggestions'))
    assert.ok(names.includes('myform_editArray'))
  })

  it('should generate tool names without prefix', () => {
    const compiled = compile(simpleSchema)
    const mainTree = compiled.skeletonTrees[compiled.mainTree]
    const layout = new StatefulLayout(compiled, mainTree, {}, {})

    const webmcp = new WebMCP(layout)

    const tools = webmcp.getTools()

    assert.equal(tools[0].name, 'getData')
    assert.equal(tools[1].name, 'setData')
  })

  it('should inject dataTitle in descriptions', () => {
    const compiled = compile(simpleSchema)
    const mainTree = compiled.skeletonTrees[compiled.mainTree]
    const layout = new StatefulLayout(compiled, mainTree, {}, {})

    const webmcp = new WebMCP(layout, { dataTitle: 'registration' })

    const tools = webmcp.getTools()

    for (const tool of tools) {
      assert.ok(tool.description.includes('registration'), `tool ${tool.name} description should include dataTitle`)
    }
  })

  it('should execute describeState tool with markdown content and structuredContent', async () => {
    const compiled = compile(simpleSchema)
    const mainTree = compiled.skeletonTrees[compiled.mainTree]
    const layout = new StatefulLayout(compiled, mainTree, { validateOn: 'input' }, { name: 'Alice' })

    const webmcp = new WebMCP(layout)
    const tools = webmcp.getTools()

    const describeTool = tools.find((t) => t.name === 'describeState')
    assert.ok(describeTool)

    const result = await /** @type {any} */(describeTool).execute({})

    assert.ok(result.content)
    assert.ok(!result.isError)
    // content is now markdown, not JSON
    const text = result.content[0].text
    assert.ok(text.includes('valid: true'), 'should contain validity status')
    assert.ok(text.includes('/name'), 'should contain field paths')
    assert.ok(text.includes('text'), 'should contain field types')
    // structuredContent has the JSON data
    assert.ok(result.structuredContent)
    assert.equal(result.structuredContent.valid, true)
  })

  it('should execute setFieldValue tool with concise text and structuredContent', async () => {
    const compiled = compile(simpleSchema)
    const mainTree = compiled.skeletonTrees[compiled.mainTree]
    const layout = new StatefulLayout(compiled, mainTree, { validateOn: 'input' }, {})

    const webmcp = new WebMCP(layout)
    const tools = webmcp.getTools()

    const setFieldTool = tools.find((t) => t.name === 'setFieldValue')
    assert.ok(setFieldTool)

    const result = await /** @type {any} */(setFieldTool).execute({ path: '/name', value: 'Bob' })

    assert.ok(result.content)
    assert.ok(!result.isError)
    // content is concise text
    const text = result.content[0].text
    assert.ok(text.includes('/name'), 'should mention field path')
    assert.ok(text.includes('Bob'), 'should mention field value')
    // structuredContent has full JSON
    assert.ok(result.structuredContent)
    assert.equal(result.structuredContent.field.path, '/name')
    assert.equal(result.structuredContent.field.data, 'Bob')
  })

  it('should execute fillFormSkill tool when opted in', async () => {
    const compiled = compile(simpleSchema)
    const mainTree = compiled.skeletonTrees[compiled.mainTree]
    const layout = new StatefulLayout(compiled, mainTree, {}, {})

    const webmcp = new WebMCP(layout, { dataTitle: 'myform', includeFillFormSkill: true })
    const tools = webmcp.getTools()

    const skillTool = tools.find((t) => t.name === 'fillFormSkill')
    assert.ok(skillTool)

    const result = await /** @type {any} */(skillTool).execute({})

    assert.ok(result.content)
    assert.ok(!result.isError)
    assert.ok(result.content[0].text.includes('JSON Myform Form-Filling Guide'))
  })

  it('should handle tool errors gracefully', async () => {
    const compiled = compile(simpleSchema)
    const mainTree = compiled.skeletonTrees[compiled.mainTree]
    const layout = new StatefulLayout(compiled, mainTree, { validateOn: 'input' }, {})

    const webmcp = new WebMCP(layout)
    const tools = webmcp.getTools()

    const setFieldTool = tools.find((t) => t.name === 'setFieldValue')
    assert.ok(setFieldTool)

    const result = await /** @type {any} */(setFieldTool).execute({ path: '/nonexistent', value: 'test' })

    assert.ok(result.isError)
    assert.ok(result.content[0].text.includes('Error'))
    assert.ok(result.content[0].text.includes('not found'))
  })

  it('should execute editArray tool with concise text and structuredContent', async () => {
    const compiled = compile(arraySchema)
    const mainTree = compiled.skeletonTrees[compiled.mainTree]
    const layout = new StatefulLayout(compiled, mainTree, { validateOn: 'input' }, { items: [{ name: 'a' }] })

    const webmcp = new WebMCP(layout)
    const tools = webmcp.getTools()

    const arrayTool = tools.find((t) => t.name === 'editArray')
    assert.ok(arrayTool)

    const result = await /** @type {any} */(arrayTool).execute({ path: '/items', action: 'add', value: { name: 'b' } })

    assert.ok(result.content)
    assert.ok(!result.isError)
    // content is concise text
    const text = result.content[0].text
    assert.ok(text.includes('added item'), 'should describe action')
    assert.ok(text.includes('2 total'), 'should include item count')
    // structuredContent has full JSON
    assert.ok(result.structuredContent)
    assert.equal(result.structuredContent.itemCount, 2)
  })

  it('should include getSchema when schema provided', () => {
    const compiled = compile(simpleSchema)
    const mainTree = compiled.skeletonTrees[compiled.mainTree]
    const layout = new StatefulLayout(compiled, mainTree, {}, {})

    const webmcp = new WebMCP(layout, { schema: simpleSchema })
    const tools = webmcp.getTools()

    const schemaTool = tools.find((t) => t.name === 'getSchema')
    assert.ok(schemaTool)
  })

  it('should return getSchema in MCP format with structuredContent', async () => {
    const compiled = compile(simpleSchema)
    const mainTree = compiled.skeletonTrees[compiled.mainTree]
    const layout = new StatefulLayout(compiled, mainTree, {}, {})

    const webmcp = new WebMCP(layout, { schema: simpleSchema })
    const tools = webmcp.getTools()

    const schemaTool = tools.find((t) => t.name === 'getSchema')
    assert.ok(schemaTool)

    const result = await /** @type {any} */(schemaTool).execute({})
    assert.ok(result.content)
    assert.equal(result.content[0].type, 'text')
    const parsed = JSON.parse(result.content[0].text)
    assert.equal(parsed.type, 'object')
    assert.ok(parsed.properties.name)
    // structuredContent
    assert.ok(result.structuredContent)
    assert.equal(result.structuredContent.type, 'object')
  })

  it('should accept data as JSON string in setData', async () => {
    const compiled = compile(simpleSchema)
    const mainTree = compiled.skeletonTrees[compiled.mainTree]
    const layout = new StatefulLayout(compiled, mainTree, { validateOn: 'input' }, {})

    const webmcp = new WebMCP(layout)
    const tools = webmcp.getTools()

    const setDataTool = tools.find((t) => t.name === 'setData')
    assert.ok(setDataTool)

    const result = await /** @type {any} */(setDataTool).execute({ data: '{"name": "Charlie", "age": 30}' })

    assert.ok(!result.isError)
    assert.ok(result.structuredContent)
    assert.equal(result.structuredContent.valid, true)
    const data = /** @type {any} */(layout.data)
    assert.equal(data.name, 'Charlie')
    assert.equal(data.age, 30)
  })

  it('should accept value as JSON string in setFieldValue', async () => {
    const compiled = compile(simpleSchema)
    const mainTree = compiled.skeletonTrees[compiled.mainTree]
    const layout = new StatefulLayout(compiled, mainTree, { validateOn: 'input' }, {})

    const webmcp = new WebMCP(layout)
    const tools = webmcp.getTools()

    const setFieldTool = tools.find((t) => t.name === 'setFieldValue')
    assert.ok(setFieldTool)

    // string value should stay as string (not parsed as JSON)
    const result = await /** @type {any} */(setFieldTool).execute({ path: '/name', value: 'Bob' })
    assert.ok(!result.isError)
    assert.equal(result.structuredContent.field.data, 'Bob')
  })

  it('should accept value as JSON string in editArray', async () => {
    const compiled = compile(arraySchema)
    const mainTree = compiled.skeletonTrees[compiled.mainTree]
    const layout = new StatefulLayout(compiled, mainTree, { validateOn: 'input' }, { items: [] })

    const webmcp = new WebMCP(layout)
    const tools = webmcp.getTools()

    const arrayTool = tools.find((t) => t.name === 'editArray')
    assert.ok(arrayTool)

    const result = await /** @type {any} */(arrayTool).execute({
      path: '/items',
      action: 'add',
      value: '{"name": "fromJsonString"}'
    })

    assert.ok(!result.isError)
    assert.equal(result.structuredContent.itemCount, 1)
    const data = /** @type {any} */(layout.data)
    assert.equal(data.items[0].name, 'fromJsonString')
  })

  it('should return structuredContent from getData', async () => {
    const compiled = compile(simpleSchema)
    const mainTree = compiled.skeletonTrees[compiled.mainTree]
    const layout = new StatefulLayout(compiled, mainTree, { validateOn: 'input' }, { name: 'Alice' })

    const webmcp = new WebMCP(layout)
    const tools = webmcp.getTools()

    const getDataTool = tools.find((t) => t.name === 'getData')
    assert.ok(getDataTool)

    const result = await /** @type {any} */(getDataTool).execute({})

    assert.ok(result.structuredContent)
    assert.equal(result.structuredContent.data.name, 'Alice')
    assert.equal(result.structuredContent.valid, true)
  })
})
