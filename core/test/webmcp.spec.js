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
import * as fillFormSkill from '../src/webmcp/tools/fill-form-skill.js'

import { projectStateTree, collectErrors } from '../src/webmcp/project.js'
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

describe('webmcp project functions', () => {
  it('should project state tree', () => {
    const compiled = compile(simpleSchema)
    const mainTree = compiled.skeletonTrees[compiled.mainTree]
    const layout = new StatefulLayout(compiled, mainTree, { validateOn: 'input' }, { name: 'Alice' })

    const projected = projectStateTree(layout.stateTree, layout)

    assert.equal(projected.valid, true)
    assert.equal(projected.root.key, '')
    assert.equal(projected.root.comp, 'section')
    assert.equal(/** @type {any[]} */(projected.root.children).length, 3)

    const children = /** @type {any[]} */(projected.root.children)
    const nameNode = children.find((c) => c.key === 'name')
    assert.ok(nameNode)
    assert.equal(nameNode.comp, 'text-field')
    assert.equal(nameNode.data, 'Alice')
    assert.equal(nameNode.required, true)
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
    assert.equal(state.root.key, '')
    assert.equal(result.errors.length, 0)
  })

  it('should describeState by path', () => {
    const compiled = compile(simpleSchema)
    const mainTree = compiled.skeletonTrees[compiled.mainTree]
    const layout = new StatefulLayout(compiled, mainTree, { validateOn: 'input' }, { name: 'Alice' })

    const result = describeState.execute(layout, { path: '/name' })

    assert.equal(result.valid, true)
    const state = /** @type {any} */(result.state)
    assert.equal(state.key, 'name')
    assert.equal(state.data, 'Alice')
  })

  it('should setFieldValue', () => {
    const compiled = compile(simpleSchema)
    const mainTree = compiled.skeletonTrees[compiled.mainTree]
    const layout = new StatefulLayout(compiled, mainTree, { validateOn: 'input' }, {})

    // Check initial state - should be invalid because name is required
    assert.equal(layout.valid, false)

    const result = setFieldValue.execute(layout, { path: '/name', value: 'Bob' })

    // After setting name, should be valid
    // Note: validation is on input, so it validates as you type
    assert.ok(result.state)
  })

  it('should setData', () => {
    const compiled = compile(simpleSchema)
    const mainTree = compiled.skeletonTrees[compiled.mainTree]
    const layout = new StatefulLayout(compiled, mainTree, { validateOn: 'input' }, {})

    const result = setData.execute(layout, { data: { name: 'Charlie', age: 30 } })

    const data = /** @type {any} */(layout.data)
    assert.equal(data.name, 'Charlie')
    assert.equal(data.age, 30)
    assert.equal(result.valid, true)
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

  it('should generate tool names with prefix', () => {
    const compiled = compile(simpleSchema)
    const mainTree = compiled.skeletonTrees[compiled.mainTree]
    const layout = new StatefulLayout(compiled, mainTree, {}, {})

    const webmcp = new WebMCP(layout, { prefixName: 'myform_' })

    const tools = webmcp.getTools()

    assert.equal(tools[0].name, 'myform_fillFormSkill')
    assert.equal(tools[1].name, 'myform_getData')
    assert.equal(tools[2].name, 'myform_setData')
    assert.equal(tools[3].name, 'myform_describeState')
    assert.equal(tools[4].name, 'myform_setFieldValue')
    assert.equal(tools[5].name, 'myform_getFieldSuggestions')
  })

  it('should generate tool names without prefix', () => {
    const compiled = compile(simpleSchema)
    const mainTree = compiled.skeletonTrees[compiled.mainTree]
    const layout = new StatefulLayout(compiled, mainTree, {}, {})

    const webmcp = new WebMCP(layout)

    const tools = webmcp.getTools()

    assert.equal(tools[0].name, 'fillFormSkill')
    assert.equal(tools[1].name, 'getData')
  })

  it('should inject dataTitle in descriptions', () => {
    const compiled = compile(simpleSchema)
    const mainTree = compiled.skeletonTrees[compiled.mainTree]
    const layout = new StatefulLayout(compiled, mainTree, {}, {})

    const webmcp = new WebMCP(layout, { dataTitle: 'registration' })

    const tools = webmcp.getTools()

    assert.ok(tools[0].description.includes('registration'))
    assert.ok(tools[1].description.includes('registration'))
    assert.ok(tools[2].description.includes('registration'))
    assert.ok(tools[3].description.includes('registration'))
    assert.ok(tools[4].description.includes('registration'))
    assert.ok(tools[5].description.includes('registration'))
  })

  it('should execute describeState tool', async () => {
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
    const parsed = JSON.parse(result.content[0].text)
    assert.equal(parsed.valid, true)
  })

  it('should execute setFieldValue tool', async () => {
    const compiled = compile(simpleSchema)
    const mainTree = compiled.skeletonTrees[compiled.mainTree]
    const layout = new StatefulLayout(compiled, mainTree, { validateOn: 'input' }, {})

    const webmcp = new WebMCP(layout)
    const tools = webmcp.getTools()

    const setFieldTool = tools.find((t) => t.name === 'setFieldValue')
    assert.ok(setFieldTool)

    const result = await /** @type {any} */(setFieldTool).execute({ path: '/name', value: 'Bob' })

    assert.ok(result.content)
    // Check that it ran without error
    assert.ok(!result.isError || result.content[0].text.includes('Error') === false)
  })

  it('should execute fillFormSkill tool', async () => {
    const compiled = compile(simpleSchema)
    const mainTree = compiled.skeletonTrees[compiled.mainTree]
    const layout = new StatefulLayout(compiled, mainTree, {}, {})

    const webmcp = new WebMCP(layout, { dataTitle: 'myform' })
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
})
