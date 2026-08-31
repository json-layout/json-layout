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
import * as getSchema from '../src/webmcp/tools/get-schema.js'
import * as fillFormSkill from '../src/webmcp/tools/fill-form-skill.js'

import { projectStateTree, projectNode, projectFieldResult, collectErrors, projectSuggestions, SUGGESTION_VALUE_MAX_LENGTH } from '../src/webmcp/project.js'
import { resolveNode } from '../src/webmcp/resolve.js'
import { SuggestionsStore } from '../src/webmcp/suggestions-store.js'

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
    assert.ok(setFieldValue.inputSchema.properties.suggestionIndex)
    assert.deepEqual(setFieldValue.inputSchema.required, ['path'])
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

  it('should include subagent tool when includeSubAgent is true', async () => {
    const compiled = compile(simpleSchema)
    const mainTree = compiled.skeletonTrees[compiled.mainTree]
    const layout = new StatefulLayout(compiled, mainTree, {}, {})

    const webmcp = new WebMCP(layout, { prefixName: 'myform_', dataTitle: 'registration', includeSubAgent: true })
    const tools = webmcp.getTools()

    const subagentTool = tools.find((t) => t.name === 'subagent_myform_form')
    assert.ok(subagentTool, 'should have a subagent tool')
    assert.ok(subagentTool.description.includes('registration'))

    const result = await /** @type {any} */(subagentTool).execute({ task: 'fill the form' })
    assert.ok(!result.isError)

    const structured = result.structuredContent
    assert.ok(structured.prompt.includes('Form-Filling Guide'))
    assert.ok(Array.isArray(structured.tools))
    assert.ok(structured.tools.includes('myform_getData'))
    assert.ok(structured.tools.includes('myform_setData'))
    assert.ok(structured.tools.includes('myform_setFieldValue'))
    assert.ok(!structured.tools.includes('subagent_myform_form'), 'subagent tool should not include itself')
  })

  it('should use "form" as subagent name when no prefixName', async () => {
    const compiled = compile(simpleSchema)
    const mainTree = compiled.skeletonTrees[compiled.mainTree]
    const layout = new StatefulLayout(compiled, mainTree, {}, {})

    const webmcp = new WebMCP(layout, { dataTitle: 'registration', includeSubAgent: true })
    const tools = webmcp.getTools()

    const subagentTool = tools.find((t) => t.name === 'subagent_form')
    assert.ok(subagentTool, 'should use "form" as subagent name when no prefixName')
  })
})

const arrayOfObjectsSchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    filters: {
      type: 'array',
      title: 'filters',
      items: { $ref: '#/$defs/filter' }
    }
  },
  required: ['name'],
  $defs: {
    filter: {
      type: 'object',
      required: ['type', 'field'],
      properties: {
        type: { type: 'string', enum: ['in', 'out'] },
        field: { type: 'string' }
      }
    }
  }
}

/**
 * @param {number} nbProperties
 * @returns {object}
 */
function makeLargeSchema (nbProperties) {
  /** @type {Record<string, object>} */
  const properties = {
    section1: { type: 'object', title: 'Section 1', properties: {} },
    name: { type: 'string' }
  }
  /** @type {Record<string, object>} */
  const subProperties = /** @type {any} */(properties.section1).properties
  for (let i = 0; i < nbProperties; i++) {
    subProperties[`prop${i}`] = {
      type: 'string',
      title: `A property with a fairly long title to inflate the schema size ${i}`,
      description: 'A description that is also quite long so that the serialized schema goes over the limit of the getSchema tool.'
    }
  }
  return { type: 'object', properties }
}

describe('webmcp getSchema tool', () => {
  it('should return the full schema when it is small enough', async () => {
    const compiled = compile(simpleSchema)
    const layout = new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree], {}, {})
    const result = getSchema.execute(layout, simpleSchema, {})
    assert.deepEqual(result.schema, simpleSchema)
    assert.ok(!result.tooLarge)
  })

  it('should not return a schema larger than the limit and explain how to get sub-schemas', async () => {
    const largeSchema = makeLargeSchema(200)
    assert.ok(JSON.stringify(largeSchema).length > getSchema.SCHEMA_MAX_LENGTH)
    const compiled = compile(largeSchema)
    const layout = new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree], {}, {})

    const webmcp = new WebMCP(layout, { schema: largeSchema })
    const schemaTool = webmcp.getTools().find((t) => t.name === 'getSchema')
    assert.ok(schemaTool)
    const toolResult = await /** @type {any} */(schemaTool).execute({})

    assert.ok(!toolResult.isError)
    const text = toolResult.content[0].text
    assert.ok(text.length < getSchema.SCHEMA_MAX_LENGTH, 'text output should stay small')
    assert.ok(text.includes('too large'), 'should explain the problem')
    assert.ok(text.includes('path'), 'should point to the path parameter')
    assert.ok(text.includes('/section1'), 'should list top level paths')
    assert.equal(toolResult.structuredContent.tooLarge, true)
    assert.equal(toolResult.structuredContent.schema, undefined)
    assert.ok(toolResult.structuredContent.paths.find((/** @type {any} */p) => p.path === '/name'))
  })

  it('should return the sub-schema of a node when path is provided', async () => {
    const compiled = compile(arrayOfObjectsSchema)
    const layout = new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree], { validateOn: 'input' }, { filters: [{}] })

    const result = getSchema.execute(layout, arrayOfObjectsSchema, { path: '/filters/0' })
    assert.equal(result.path, '/filters/0')
    assert.deepEqual(result.schema, arrayOfObjectsSchema.$defs.filter)

    const typeResult = getSchema.execute(layout, arrayOfObjectsSchema, { path: '/filters/0/type' })
    assert.deepEqual(typeResult.schema, { type: 'string', enum: ['in', 'out'] })
  })

  it('should return the sub-schema by path through the tool with a large schema', async () => {
    const largeSchema = makeLargeSchema(200)
    const compiled = compile(largeSchema)
    const layout = new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree], {}, {})
    const webmcp = new WebMCP(layout, { schema: largeSchema })
    const schemaTool = webmcp.getTools().find((t) => t.name === 'getSchema')
    assert.ok(schemaTool)

    const toolResult = await /** @type {any} */(schemaTool).execute({ path: '/section1/prop3' })
    assert.ok(!toolResult.isError)
    const parsed = JSON.parse(toolResult.content[0].text)
    assert.equal(parsed.type, 'string')
    assert.ok(parsed.title.includes('3'))
  })

  it('should resolve a sub-schema whose property key contains json pointer escape sequences', () => {
    // skeleton pointers are built by concatenation, without RFC 6901 escaping,
    // so their segments must be resolved raw: unescaping '~0' here would look for 'a~b'
    const schema = {
      type: 'object',
      properties: { 'a~0b': { type: 'string', title: 'Tilde prop' } }
    }
    const compiled = compile(schema)
    const layout = new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree], { debounceInputMs: 0 }, {})
    const result = getSchema.execute(layout, schema, { path: '/a~0b' })
    assert.deepEqual(result.schema, schema.properties['a~0b'])
  })

  it('should fall back on the declared fields when no sub-schema can be resolved', async () => {
    const compiled = compile(arrayOfObjectsSchema)
    const layout = new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree], { validateOn: 'input' }, { filters: [{}] })
    // no original schema and a compiled layout serialized without its schema
    const result = getSchema.execute(layout, null, { path: '/filters/0' })
    assert.ok(result.schema || result.fields, 'should return something usable')
  })

  it('should have a description mentioning the path parameter', () => {
    assert.ok(getSchema.getDescription('config').includes('path'))
    assert.ok(getSchema.inputSchema.properties.path)
  })
})

describe('webmcp suggestions truncation', () => {
  const bigDataset = {
    id: 'my-dataset',
    title: 'My dataset',
    schema: Array.from({ length: 40 }, (_, i) => ({
      key: `column${i}`,
      type: 'string',
      title: `A column with a long title ${i}`,
      'x-originalName': `column${i}`
    }))
  }

  const datasetSchema = {
    type: 'object',
    properties: {
      dataset: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          schema: { type: 'array' }
        },
        layout: { getItems: 'options.context.datasets.map(d => ({ title: d.title, key: d.id, value: d }))' }
      }
    }
  }

  it('should truncate large suggestion values and keep short ones', () => {
    const suggestions = projectSuggestions([
      { value: 'short', title: 'Short' },
      { value: bigDataset, title: 'Big', key: 'my-dataset' }
    ])
    assert.equal(suggestions[0].index, 0)
    assert.equal(suggestions[0].value, 'short')
    assert.equal(suggestions[0].truncated, undefined)

    assert.equal(suggestions[1].index, 1)
    assert.equal(suggestions[1].truncated, true)
    assert.ok(typeof suggestions[1].value === 'string')
    assert.ok(/** @type {string} */(suggestions[1].value).length <= SUGGESTION_VALUE_MAX_LENGTH + 1)
    assert.ok(/** @type {number} */(suggestions[1].valueLength) > SUGGESTION_VALUE_MAX_LENGTH)
  })

  it('should memorize suggestions per path and apply one by index', async () => {
    const compiled = compile(datasetSchema)
    const layout = new StatefulLayout(
      compiled,
      compiled.skeletonTrees[compiled.mainTree],
      { debounceInputMs: 0, context: { datasets: [bigDataset, { id: 'other', title: 'Other', schema: [] }] } },
      {}
    )
    const store = new SuggestionsStore()
    const result = await getFieldSuggestions.execute(layout, { path: '/dataset' }, store)
    assert.equal(result.items.length, 2)
    const memorized = store.get('/dataset')?.[0].value
    assert.ok(JSON.stringify(memorized).length > SUGGESTION_VALUE_MAX_LENGTH, 'the memorized value is a large object')
    // the output of the tool is truncated but the memory keeps the full value
    assert.equal(projectSuggestions(result.items)[0].truncated, true)

    // the full original value is written, not the truncated projection
    /** @type {unknown} */
    let inputValue
    const originalInput = layout.input.bind(layout)
    layout.input = (node, value) => { inputValue = value; return originalInput(node, value) }
    setFieldValue.execute(layout, { path: '/dataset', suggestionIndex: 0 }, store)
    assert.deepEqual(inputValue, memorized, 'the full original value should be written')
  })

  it('should keep the whole output small when suggestion values are big', async () => {
    const compiled = compile(datasetSchema)
    const layout = new StatefulLayout(
      compiled,
      compiled.skeletonTrees[compiled.mainTree],
      { debounceInputMs: 0, context: { datasets: [bigDataset, bigDataset, bigDataset] } },
      {}
    )
    const webmcp = new WebMCP(layout)
    const suggestionsTool = webmcp.getTools().find((t) => t.name === 'getFieldSuggestions')
    assert.ok(suggestionsTool)
    const toolResult = await /** @type {any} */(suggestionsTool).execute({ path: '/dataset' })
    assert.ok(!toolResult.isError)
    const text = toolResult.content[0].text
    assert.ok(text.includes('suggestionIndex'), 'should explain how to apply a suggestion')
    assert.ok(text.length < 3 * (SUGGESTION_VALUE_MAX_LENGTH + 200), `output should stay small, got ${text.length}`)
    assert.equal(toolResult.structuredContent.items[0].truncated, true)

    // and the memorized value can then be applied through the tool
    const setTool = webmcp.getTools().find((t) => t.name === 'setFieldValue')
    assert.ok(setTool)
    /** @type {unknown} */
    let inputValue
    const originalInput = layout.input.bind(layout)
    layout.input = (node, value) => { inputValue = value; return originalInput(node, value) }
    const setResult = await /** @type {any} */(setTool).execute({ path: '/dataset', suggestionIndex: 1 })
    assert.ok(!setResult.isError)
    assert.ok(JSON.stringify(inputValue).length > SUGGESTION_VALUE_MAX_LENGTH, 'the full original value should be written, not the truncated one')
    assert.ok(JSON.stringify(inputValue).includes('column39'), 'the whole object should be written')
  })

  it('should raise clear errors on unknown path or out of bounds index', () => {
    const store = new SuggestionsStore()
    assert.throws(() => store.getValue('/unknown', 0), /no suggestion memorized/)
    store.set('/dataset', [{ value: 'a', title: 'a' }])
    assert.throws(() => store.getValue('/dataset', 3), /out of bounds/)
  })

  it('should reject value and suggestionIndex used together', () => {
    const compiled = compile(simpleSchema)
    const layout = new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree], {}, {})
    const store = new SuggestionsStore()
    store.set('/name', [{ value: 'a', title: 'a' }])
    assert.throws(() => setFieldValue.execute(layout, { path: '/name', value: 'b', suggestionIndex: 0 }, store), /exclusive/)
  })
})

const listModeSchema = (mode) => ({
  type: 'object',
  properties: {
    filters: {
      type: 'array',
      layout: { listEditMode: mode },
      items: {
        type: 'object',
        required: ['type', 'field'],
        properties: { type: { type: 'string', enum: ['in', 'out'] }, field: { type: 'string' } }
      }
    }
  }
})

/**
 * Activate the first item the way the list components do.
 * @param {string} mode
 */
const layoutWithActivatedItem = (mode) => {
  const compiled = compile(listModeSchema(mode))
  const layout = new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree], { validateOn: 'input' }, {})
  layout.input(/** @type {any} */(resolveNode(layout.stateTree.root, '/filters')), [{}])
  const list = resolveNode(layout.stateTree.root, '/filters')
  layout.activateItem(/** @type {any} */(list), 0)
  return layout
}

describe('webmcp menu and dialog list edit modes', () => {
  // these two modes keep the activated item twice in the children, the first occurrence
  // being a read-only summary
  for (const mode of ['menu', 'dialog']) {
    it(`should project the activated item once in "${mode}" mode`, () => {
      const layout = layoutWithActivatedItem(mode)
      const list = resolveNode(layout.stateTree.root, '/filters')
      const projected = projectNode(/** @type {any} */(list), layout)
      const paths = /** @type {any[]} */(projected.children ?? []).map((c) => c.path)
      assert.deepEqual(paths, ['/filters/0'], 'the duplicated occurrence must not be projected twice')
    })

    it(`should still collect the item errors in "${mode}" mode`, () => {
      const layout = layoutWithActivatedItem(mode)
      const errors = collectErrors(layout.stateTree.root)
      // both required properties of the item are missing
      assert.equal(errors.length, 2, 'deduplicating children must not drop errors')
      assert.equal(new Set(errors.map((e) => e.path)).size, 2)
    })
  }
})

describe('webmcp array item edition', () => {
  it('should activate a newly added item and expose its children', async () => {
    const compiled = compile(arrayOfObjectsSchema)
    const layout = new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree], { validateOn: 'input' }, { name: 'x' })

    const result = editArray.execute(layout, { path: '/filters', action: 'add' })
    assert.equal(result.itemCount, 1)
    assert.equal(result.index, 0)
    assert.ok(result.item, 'the added item should be described')
    const children = /** @type {any[]} */(result.item?.children)
    assert.ok(Array.isArray(children), 'the added item should expose its children')
    assert.deepEqual(children.map((c) => c.path), ['/filters/0/type', '/filters/0/field'])
    assert.equal(result.item?.readOnly, undefined, 'an editable list item should not be flagged readOnly')

    // and describeState can now navigate to the children
    const childState = describeState.execute(layout, { path: '/filters/0/type' })
    assert.equal(/** @type {any} */(childState.state).path, '/filters/0/type')

    const itemState = describeState.execute(layout, { path: '/filters/0' })
    assert.equal(/** @type {any} */(itemState.state).readOnly, undefined)
    assert.equal(/** @type {any} */(itemState.state).children.length, 2)

    // the children are editable
    setFieldValue.execute(layout, { path: '/filters/0/type', value: 'in' })
    setFieldValue.execute(layout, { path: '/filters/0/field', value: 'city' })
    assert.deepEqual(layout.data, { name: 'x', filters: [{ type: 'in', field: 'city' }] })
  })

  it('should describe the fields of the new item in the tool output', async () => {
    const compiled = compile(arrayOfObjectsSchema)
    const layout = new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree], { validateOn: 'input' }, { name: 'x' })
    const webmcp = new WebMCP(layout)
    const arrayTool = webmcp.getTools().find((t) => t.name === 'editArray')
    assert.ok(arrayTool)
    const toolResult = await /** @type {any} */(arrayTool).execute({ path: '/filters', action: 'add' })
    assert.ok(!toolResult.isError)
    const text = toolResult.content[0].text
    assert.ok(text.includes('/filters/0/type'), 'should list the fields of the new item')
    assert.ok(text.includes('/filters/0/field'))
    assert.ok(!text.includes('readOnly'), 'a new item should not be presented as readOnly')
  })

  it('should project declared fields when the state tree has no hydrated children', () => {
    const compiled = compile(arrayOfObjectsSchema)
    const layout = new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree], { validateOn: 'input' }, { name: 'x' })
    const listNode = resolveNode(layout.stateTree.root, '/filters')
    assert.ok(listNode)
    // simulate a node whose children were not hydrated
    const fakeNode = { ...listNode, children: undefined, skeleton: { ...listNode.skeleton, children: compiled.skeletonNodes[compiled.skeletonTrees[compiled.mainTree].root].children } }
    const projected = projectNode(/** @type {any} */(fakeNode), layout)
    assert.ok(projected.declaredFields, 'declared fields should be projected')
    assert.ok(/** @type {any[]} */(projected.declaredFields).find((f) => f.key === 'name' && f.required))
  })
})

describe('webmcp scoped mutation errors', () => {
  it('should scope editArray errors to the edited array', async () => {
    const compiled = compile(arrayOfObjectsSchema)
    // name is required and missing => the form has an error outside of the array
    const layout = new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree], { validateOn: 'input', initialValidation: 'always' }, {})
    layout.validate()

    const result = editArray.execute(layout, { path: '/filters', action: 'add' })
    assert.equal(result.valid, false)
    assert.ok(result.errors.every((e) => e.path.startsWith('/filters')), `errors should be scoped, got ${JSON.stringify(result.errors)}`)
    assert.ok(result.otherErrors > 0, 'errors of the rest of the form should be counted')

    const webmcp = new WebMCP(layout)
    const arrayTool = webmcp.getTools().find((t) => t.name === 'editArray')
    assert.ok(arrayTool)
    const toolResult = await /** @type {any} */(arrayTool).execute({ path: '/filters', action: 'add' })
    const text = toolResult.content[0].text
    assert.ok(!text.includes('- /name:'), `errors of other nodes should not be listed, got:\n${text}`)
    assert.ok(text.includes('elsewhere'), 'should mention the other errors')
  })

  it('should scope setFieldValue errors to the modified field', () => {
    const compiled = compile(arrayOfObjectsSchema)
    const layout = new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree], { validateOn: 'input', initialValidation: 'always' }, { filters: [{}] })
    layout.validate()

    const result = setFieldValue.execute(layout, { path: '/name', value: 'ok' })
    assert.deepEqual(result.errors, [])
    assert.ok(result.otherErrors > 0, 'the errors of the filters should be counted apart')
  })
})
