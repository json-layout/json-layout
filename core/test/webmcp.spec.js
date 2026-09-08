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

import { helpToText, HELP_MAX_LENGTH, projectStateTree, projectStateTreeToMarkdown, projectNode, projectNodeToMarkdown, projectFieldResult, collectErrors, collectScopedErrors, projectSuggestions, abbreviateValue, SUGGESTION_VALUE_MAX_LENGTH } from '../src/webmcp/project.js'
import { resolveNode } from '../src/webmcp/resolve.js'
import { SuggestionsStore } from '../src/webmcp/suggestions-store.js'
import { resolveSchemaPointer, resolveNodeSchema, cleanSchemaFragment } from '../src/webmcp/schema.js'

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

    const errors = collectErrors(layout)

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
    assert.deepEqual(Object.keys(getData.inputSchema.properties), ['path'])
    assert.equal(getData.inputSchema.required, undefined, 'reading the whole document must stay the default')
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

  it('should list the item fields when an array sub-schema is too large', () => {
    /** @type {any} */
    const bigItem = { type: 'object', properties: {} }
    for (let i = 0; i < 130; i++) {
      bigItem.properties[`prop${i}`] = {
        type: 'string',
        title: `A fairly long title to inflate the schema ${i}`,
        description: 'A long description so that the serialized sub-schema goes over the getSchema limit.'
      }
    }
    const schema = { type: 'object', properties: { filters: { type: 'array', layout: { comp: 'list' }, items: bigItem } } }
    const compiled = compile(schema)

    // an array keeps its item skeleton in childrenTrees, not in children
    const withItem = new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree], {}, { filters: [{}] })
    const result = getSchema.execute(withItem, schema, { path: '/filters' })
    assert.equal(result.tooLarge, true)
    assert.ok(result.fields && result.fields.length > 0, 'the fields promised by the message must be listed')
    assert.ok(result.fields?.find((f) => f.path === '/filters/0/prop0'))
    assert.ok(resolveNode(withItem.stateTree.root, '/filters/0/prop0'), 'the listed paths should resolve')

    // with no item yet those paths cannot be reached, the message must say so
    const empty = new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree], {}, { filters: [] })
    const emptyResult = getSchema.execute(empty, schema, { path: '/filters' })
    assert.ok(emptyResult.fields && emptyResult.fields.length > 0)
    assert.ok(/** @type {string} */(emptyResult.message).includes('editArray'),
      `the agent should be told to add an item first, got: ${emptyResult.message}`)
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

  it('should omit a large suggestion value entirely and keep short scalars', () => {
    // A picker shows a person titles, not the objects behind them, and an agent picks a
    // row the same way — by index. Printing a 300-character slice of each object cost
    // 61-77% of every suggestion response in the eval, for bytes the tool's own
    // description tells the agent never to copy. Short scalars stay: agents demonstrably
    // batch those straight into setData rather than spending a round-trip on an index.
    const suggestions = projectSuggestions([
      { value: 'short', title: 'Short' },
      { value: bigDataset, title: 'Big', key: 'my-dataset' }
    ])
    assert.equal(suggestions[0].index, 0)
    assert.equal(suggestions[0].value, 'short')
    assert.equal(suggestions[0].valueOmitted, undefined)

    assert.equal(suggestions[1].index, 1)
    assert.equal(suggestions[1].valueOmitted, true)
    assert.equal(suggestions[1].value, undefined, 'no slice of the object may be printed')
    assert.ok(/** @type {number} */(suggestions[1].valueLength) > SUGGESTION_VALUE_MAX_LENGTH)
  })

  it('should omit a scalar that is too long to be worth inlining', () => {
    const long = 'x'.repeat(SUGGESTION_VALUE_MAX_LENGTH + 10)
    const [suggestion] = projectSuggestions([{ value: long, title: 'Long' }])
    assert.equal(suggestion.value, undefined)
    assert.equal(suggestion.valueOmitted, true)
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
    // the output omits the value but the memory keeps it in full
    assert.equal(projectSuggestions(result.items)[0].valueOmitted, true)

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
    assert.ok(text.length < 3 * 200, `output should stay small, got ${text.length}`)
    assert.ok(!text.includes('"schema"'), 'no fragment of the object value may reach the agent')
    assert.equal(toolResult.structuredContent.items[0].valueOmitted, true)

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
    store.add('/dataset', [{ value: 'a', title: 'a' }])
    assert.throws(() => store.getValue('/dataset', 3), /out of bounds/)
  })

  it('should reject value and suggestionIndex used together', () => {
    const compiled = compile(simpleSchema)
    const layout = new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree], {}, {})
    const store = new SuggestionsStore()
    store.add('/name', [{ value: 'a', title: 'a' }])
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
      const errors = collectErrors(layout)
      // both required properties of the item are missing
      assert.equal(errors.length, 2, 'deduplicating children must not drop errors')
      assert.equal(new Set(errors.map((e) => e.path)).size, 2)
    })
  }
})

describe('webmcp errors of an activated list item', () => {
  // the activated item is kept twice and only the read-only summary captures the validation
  // errors, so the editable occurrence the tools resolve to carries none of them
  for (const mode of ['menu', 'dialog']) {
    it(`should scope the item errors to the item itself in "${mode}" mode`, () => {
      const layout = layoutWithActivatedItem(mode)
      const item = resolveNode(layout.stateTree.root, '/filters/0')
      assert.ok(item)
      const { errors, otherErrors } = collectScopedErrors(layout, /** @type {any} */(item))
      assert.deepEqual(errors.map((e) => e.path).sort(), ['/filters/0/field', '/filters/0/type'])
      assert.equal(otherErrors, 0, 'the errors of the item must not be reported as being elsewhere')
    })

    it(`should still flag the erroring fields of the item in "${mode}" mode`, () => {
      const layout = layoutWithActivatedItem(mode)
      const text = describeState.toMarkdown(layout, { path: '/filters/0' })
      assert.ok(text.includes('/filters/0/field (text, required, error)'), `the field should be flagged in error, got:\n${text}`)
      assert.ok(text.includes('2 error(s) here'), `the errors should be scoped to the item, got:\n${text}`)
      assert.ok(!text.includes('other error(s) elsewhere'), `the errors are here, not elsewhere, got:\n${text}`)
    })
  }
})

describe('webmcp editArray add index bounds', () => {
  const emptyListLayout = () => {
    const compiled = compile(listModeSchema('menu'))
    return new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree], { validateOn: 'input' }, { filters: [] })
  }

  it('should reject an out of bounds index instead of silently misplacing the item', () => {
    const layout = emptyListLayout()
    const before = JSON.stringify(layout.data)
    assert.throws(() => editArray.execute(layout, { path: '/filters', action: 'add', index: 5 }), /out of bounds/)
    assert.throws(() => editArray.execute(layout, { path: '/filters', action: 'add', index: -1 }), /out of bounds/)
    assert.throws(() => editArray.execute(layout, { path: '/filters', action: 'add', index: 1.5 }), /out of bounds/)
    assert.equal(JSON.stringify(layout.data), before, 'a rejected add must not touch the data')
    assert.deepEqual(layout.activatedItems, {}, 'a rejected add must not activate anything')
  })

  it('should accept adding at the end of the array', () => {
    const layout = emptyListLayout()
    editArray.execute(layout, { path: '/filters', action: 'add' })
    const result = editArray.execute(layout, { path: '/filters', action: 'add', index: 1 })
    assert.equal(result.index, 1)
    assert.equal(result.itemCount, 2)
    assert.equal(/** @type {any[]} */(layout.data.filters).length, 2)
  })

  it('should accept adding at the beginning of the array', () => {
    const layout = emptyListLayout()
    editArray.execute(layout, { path: '/filters', action: 'add' })
    const result = editArray.execute(layout, { path: '/filters', action: 'add', index: 0 })
    assert.equal(result.index, 0)
    assert.equal(result.itemCount, 2)
  })
})

describe('webmcp declared fields of a value picked from getItems', () => {
  const datasetSchema = {
    type: 'object',
    properties: {
      dataset: {
        type: 'object',
        properties: { id: { type: 'string' }, title: { type: 'string' } },
        layout: { getItems: 'context.datasets.map(d => ({ title: d.title, key: d.id, value: d }))' }
      }
    }
  }

  it('should not present the properties of the picked value as fillable fields', () => {
    const compiled = compile(datasetSchema)
    const layout = new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree],
      { context: { datasets: [{ id: 'a', title: 'A' }] } }, {})
    const node = resolveNode(layout.stateTree.root, '/dataset')
    assert.ok(node)
    const projected = projectNode(/** @type {any} */(node), layout)
    assert.equal(projected.getSuggestions, true, 'the field is filled from getFieldSuggestions')
    assert.equal(projected.declaredFields, undefined, 'its properties are not nodes of the form')
    // the paths that used to be advertised do not resolve
    assert.throws(() => setFieldValue.execute(layout, { path: '/dataset/id', value: 'x' }), /node not found/)
  })
})

describe('webmcp sub-schema resolution guards', () => {
  it('should refuse a pointer into another schema even when this one has no $id', () => {
    const local = { type: 'object', properties: { street: { type: 'string', title: 'LOCAL street' } } }
    // the path exists locally, but the pointer designates a different document
    assert.equal(resolveSchemaPointer(local, 'https://schemas.example/address#/properties/street'), undefined)
    // the anonymous id given by the compilation step and a matching $id are still accepted
    assert.ok(resolveSchemaPointer(local, '_jl#/properties/street'))
    assert.ok(resolveSchemaPointer({ ...local, $id: 'https://mine' }, 'https://mine#/properties/street'))
  })

  it('should not return the errorMessage injected by the compilation step', () => {
    const schema = { type: 'object', required: ['type'], properties: { type: { type: 'string' } } }
    const compiled = compile(schema)
    const layout = new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree], {}, {})
    // no pristine schema given, so the compiled one is used and cleaned
    const resolved = /** @type {any} */(resolveNodeSchema(layout.stateTree.root, layout, null))
    assert.ok(resolved, 'the compiled schema should still resolve')
    assert.equal(resolved.errorMessage, undefined)
    assert.equal(resolved.properties.type.errorMessage, undefined)
    assert.equal(resolved.properties.type.type, 'string', 'the actual schema must be preserved')
  })
})

describe('webmcp activation across an array removal', () => {
  const layoutWith4Items = () => {
    const compiled = compile(listModeSchema('menu'))
    return new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree],
      { validateOn: 'input' }, { filters: [{}, {}, {}, {}] })
  }

  for (const [activated, removed, expected] of [[3, 0, 2], [1, 3, 1], [2, 2, undefined], [0, 3, 0]]) {
    it(`should keep editing item ${activated} after removing item ${removed}`, () => {
      const layout = layoutWith4Items()
      layout.activateItem(/** @type {any} */(resolveNode(layout.stateTree.root, '/filters')), activated)
      editArray.execute(layout, { path: '/filters', action: 'remove', index: removed })
      assert.equal(layout.activatedItems['/filters'], expected)
    })
  }
})

describe('webmcp suggestions invalidation', () => {
  const suggestionsSchema = {
    type: 'object',
    properties: {
      filters: {
        type: 'array',
        layout: { comp: 'list' },
        items: { type: 'object', properties: { field: { type: 'string', layout: { getItems: 'context.fields' } } } }
      }
    }
  }

  it('should forget the suggestions of a path whose item was removed', async () => {
    const compiled = compile(suggestionsSchema)
    const layout = new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree],
      { debounceInputMs: 0, context: { fields: ['a', 'b', 'c'] } }, { filters: [{ field: 'a' }, { field: 'b' }] })
    const webmcp = new WebMCP(layout)
    const tools = Object.fromEntries(webmcp.getTools().map((t) => [t.name, t]))

    await /** @type {any} */(tools.getFieldSuggestions).execute({ path: '/filters/0/field' })
    await /** @type {any} */(tools.editArray).execute({ path: '/filters', action: 'remove', index: 0 })
    // /filters/0/field now designates the item that was at index 1
    const result = await /** @type {any} */(tools.setFieldValue).execute({ path: '/filters/0/field', suggestionIndex: 2 })
    assert.equal(result.isError, true, 'a stale suggestionIndex must not be applied silently')
    assert.deepEqual(layout.data, { filters: [{ field: 'b' }] }, 'the data must be untouched')
  })
})

describe('webmcp errors below an activated list item', () => {
  const deepSchema = {
    type: 'object',
    properties: {
      filters: {
        type: 'array',
        layout: { comp: 'list', listEditMode: 'menu' },
        items: {
          type: 'object',
          required: ['type', 'field'],
          properties: { type: { type: 'string' }, field: { type: 'string', minLength: 3 } }
        }
      }
    }
  }

  it('should report the error of a field nested in the activated item', () => {
    const compiled = compile(deepSchema)
    const layout = new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree],
      { validateOn: 'input', initialValidation: 'always', debounceInputMs: 0 }, { filters: [{ type: 'x', field: 'abc' }] })
    layout.activateItem(/** @type {any} */(resolveNode(layout.stateTree.root, '/filters')), 0)

    const result = setFieldValue.execute(layout, { path: '/filters/0/field', value: 'ab' })
    assert.equal(result.errors.length, 1, 'the error of the field just edited must be reported')
    assert.equal(result.errors[0].path, '/filters/0/field')
    assert.equal(result.otherErrors, 0, 'it must not be counted as being elsewhere')

    // the markdown used to flag the node in error and claim "no error here" right after
    const text = describeState.toMarkdown(layout, { path: '/filters/0/field' })
    assert.ok(text.includes('1 error(s) here'), `got:\n${text}`)
    assert.ok(!text.includes('no error here'), `got:\n${text}`)
  })

  it('should not present the fields of a summary item as readOnly', () => {
    const compiled = compile(deepSchema)
    const layout = new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree],
      { validateOn: 'input', debounceInputMs: 0 },
      { filters: [{ type: 'a', field: 'aaa' }, { type: 'b', field: 'bbb' }] })
    layout.activateItem(/** @type {any} */(resolveNode(layout.stateTree.root, '/filters')), 0)

    const text = describeState.toMarkdown(layout, { path: '/filters/1' })
    assert.ok(!text.includes('readOnly'), `the fields of an editable item are writable, got:\n${text}`)
    // and they really are writable
    setFieldValue.execute(layout, { path: '/filters/1/field', value: 'zzz' })
    assert.equal(/** @type {any} */(layout.data).filters[1].field, 'zzz')
  })
})

describe('webmcp editArray remove index bounds', () => {
  it('should reject a non integer remove index', () => {
    const compiled = compile(listModeSchema('menu'))
    const layout = new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree],
      { validateOn: 'input' }, { filters: [{}, {}, {}] })
    assert.throws(() => editArray.execute(layout, { path: '/filters', action: 'remove', index: 1.7 }), /out of bounds/)
    assert.equal(/** @type {any[]} */(/** @type {any} */(layout.data).filters).length, 3, 'nothing must have been removed')
  })
})

describe('webmcp schema cleaning', () => {
  it('should strip the injected keys without touching properties of the same name', () => {
    const cleaned = /** @type {any} */(cleanSchemaFragment({
      errorMessage: { required: 'injected' },
      __pointer: '_jl#/x',
      properties: { errorMessage: { type: 'string' }, __pointer: { type: 'number' }, ok: { type: 'string' } }
    }))
    assert.equal(cleaned.errorMessage, undefined, 'the injected keyword should be removed')
    assert.equal(cleaned.__pointer, undefined)
    assert.deepEqual(cleaned.properties, {
      errorMessage: { type: 'string' },
      __pointer: { type: 'number' },
      ok: { type: 'string' }
    }, 'properties named like an internal key are real fields of the form')
  })
})

describe('webmcp suggestions invalidation on setFieldValue', () => {
  it('should forget suggestions that depended on another field', async () => {
    const schema = {
      type: 'object',
      properties: {
        country: { type: 'string' },
        city: { type: 'string', layout: { getItems: 'context.cities[parent.data.country] || []' } }
      }
    }
    const compiled = compile(schema)
    const layout = new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree],
      { debounceInputMs: 0, context: { cities: { fr: ['paris', 'lyon'], it: ['roma', 'milano'] } } }, { country: 'fr' })
    const tools = Object.fromEntries(new WebMCP(layout).getTools().map((t) => [t.name, t]))

    await /** @type {any} */(tools.getFieldSuggestions).execute({ path: '/city' })
    await /** @type {any} */(tools.setFieldValue).execute({ path: '/country', value: 'it' })
    const result = await /** @type {any} */(tools.setFieldValue).execute({ path: '/city', suggestionIndex: 1 })

    assert.equal(result.isError, true, 'a suggestion from the previous country must not be applied')
    assert.equal(/** @type {any} */(layout.data).city, undefined)
  })
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

describe('webmcp setData merge semantics', () => {
  const dashboardSchema = {
    type: 'object',
    properties: {
      datasets: { type: 'array', title: 'Jeux de données', items: { type: 'string' } },
      title: { type: 'string', title: 'Titre' },
      showSources: { type: 'boolean', title: 'Afficher les sources' },
      sections: {
        type: 'array',
        title: 'Sections',
        items: {
          type: 'object',
          properties: { title: { type: 'string', title: 'Titre' } }
        }
      }
    }
  }

  /** @param {object} [data] @returns {StatefulLayout} */
  const dashboard = (data = {}) => {
    const compiled = compile(dashboardSchema)
    return new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree], { validateOn: 'input' }, data)
  }

  it('should merge a partial write instead of destroying the rest of the data', () => {
    // The costliest shape of this bug: a model that believes it is "updating the
    // sections" wipes the dataset, the title and every setting, and is told the form
    // is valid — after which data-fair's saveDraft happily persists the amputated draft.
    const layout = dashboard({ datasets: ['air-quality'], title: 'Mon tableau', showSources: true })

    setData.execute(layout, { data: { sections: [{ title: 'Démographie' }] } })

    const data = /** @type {any} */(layout.data)
    assert.deepEqual(data.datasets, ['air-quality'], 'datasets must survive a partial write')
    assert.equal(data.title, 'Mon tableau', 'title must survive a partial write')
    assert.equal(data.showSources, true, 'showSources must survive a partial write')
    assert.deepEqual(data.sections, [{ title: 'Démographie' }], 'the written key must be applied')
  })

  it('should replace and name the dropped keys when merge is explicitly disabled', () => {
    // Replacement stays available, but never silently: the response says what it removed.
    const layout = dashboard({ datasets: ['air-quality'], title: 'Mon tableau', showSources: true })

    const result = setData.execute(layout, { data: { title: 'Autre' }, merge: false })

    assert.deepEqual(layout.data, { title: 'Autre' })
    assert.deepEqual([...result.removed].sort(), ['datasets', 'showSources'])
  })

  it('should signal data keys that match no node in the form', () => {
    // A typo on a root key is accepted by ajv (the schema does not close
    // additionalProperties) and stored, so the real property is never written and
    // nothing says so. json-layout knows no node carries that key.
    const layout = dashboard({ title: 'Mon tableau' })

    const result = setData.execute(layout, { data: { sectionz: [{ title: 'Démographie' }] } })

    assert.deepEqual(result.unknownKeys, ['sectionz'])
    assert.equal(result.valid, true, 'the form is still valid — which is why the warning is needed')
  })

  it('should not signal keys the form does carry', () => {
    // Guards the warning against crying wolf: a correct write must report nothing.
    const layout = dashboard({ title: 'Mon tableau' })

    const result = setData.execute(layout, { data: { sections: [{ title: 'Démographie' }], showSources: true } })

    assert.deepEqual(result.unknownKeys, [])
  })

  it('should surface dropped and unknown keys in the text, not only in structuredContent', async () => {
    // Tool passers discard structuredContent and keep only the text, so anything the
    // agent must act on has to be in the text. A warning it never reads is no warning.
    const compiled = compile(dashboardSchema)
    const layout = new StatefulLayout(
      compiled, compiled.skeletonTrees[compiled.mainTree], { validateOn: 'input' },
      { datasets: ['air-quality'], title: 'Mon tableau' }
    )
    const webmcp = new WebMCP(layout, { dataTitle: 'dashboard' })
    const tool = /** @type {any} */(webmcp.getTools().find((t) => t.name === 'setData'))

    const unknown = await tool.execute({ data: { sectionz: [{ title: 'Démographie' }] } })
    assert.ok(unknown.content[0].text.includes('sectionz'), `expected the typo in the text, got: ${unknown.content[0].text}`)

    const replaced = await tool.execute({ data: { title: 'Autre' }, merge: false })
    assert.ok(replaced.content[0].text.includes('datasets'), `expected the dropped key in the text, got: ${replaced.content[0].text}`)
  })
})

describe('webmcp null const in select items', () => {
  const colorSchema = {
    type: 'object',
    properties: {
      color: {
        // type must admit null for json-layout to render this oneOf as a select;
        // this is the shape app-dashboards uses for "Couleur du texte".
        type: ['string', 'null'],
        title: 'Couleur du texte',
        oneOf: [
          { const: null, title: 'Aucune (par défaut)' },
          { const: 'primary', title: 'Primaire' }
        ]
      }
    }
  }

  it('should apply a null-valued suggestion as null, not as the string "null"', async () => {
    // The item is normalized to { key: "null", value: null }; `item.value ?? item.key`
    // then treats the legitimate null as absent and keeps the key. The agent applies the
    // suggestion the tool just handed it by index, and the write is rejected.
    const compiled = compile(colorSchema)
    const layout = new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree], { validateOn: 'input' }, {})
    const store = new SuggestionsStore()

    const { items } = await getFieldSuggestions.execute(layout, { path: '/color' }, store)
    const index = items.findIndex((/** @type {any} */ i) => i.title === 'Aucune (par défaut)')
    assert.ok(index >= 0, `expected the null branch among ${JSON.stringify(items)}`)
    assert.equal(items[index].value, null, 'the suggestion must carry null, not the string "null"')

    const result = setFieldValue.execute(layout, { path: '/color', suggestionIndex: index }, store)
    assert.equal(/** @type {any} */(layout.data).color, null, 'applying it must write null')
    assert.equal(result.valid, true, 'the value the tool offered must be accepted by the schema')
  })
})

describe('webmcp help in the markdown projection', () => {
  it('should emit help text, since the markdown is the only channel an agent reads', async () => {
    // projectNode puts `help` in structuredContent, which tool passers discard. The
    // guidance most worth having is exactly what a model cannot guess — that a negative
    // height means automatic sizing — and it was being dropped in transit.
    const schema = {
      type: 'object',
      properties: {
        height: {
          type: 'integer',
          title: 'Hauteur (px)',
          description: 'Mettez une valeur négative pour un redimensionnement automatique'
        }
      }
    }
    const compiled = compile(schema)
    const layout = new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree], { validateOn: 'input' }, { height: 400 })
    const webmcp = new WebMCP(layout, { dataTitle: 'dashboard' })
    const tool = /** @type {any} */(webmcp.getTools().find((t) => t.name === 'describeState'))

    const result = await tool.execute({})
    const text = result.content[0].text
    assert.ok(
      text.includes('redimensionnement automatique'),
      `expected the help text in the markdown, got:\n${text}`
    )
  })
})

describe('webmcp errors below an unhydrated list item', () => {
  // A list renders its items in summary mode, so an item's children are only built once
  // it is activated for edition. Errors below an unhydrated item then have no node to
  // attach to and collapse onto the list itself — this is app-dashboards' shape.
  const summaryListSchema = {
    type: 'object',
    allOf: [
      { title: 'Source', properties: { datasets: { type: 'array', items: { type: 'string' } } } },
      {
        title: 'Sections',
        properties: {
          sections: {
            type: 'array',
            title: 'Sections',
            layout: { itemTitle: "data.title || 'Section'" },
            items: {
              type: 'object',
              layout: { switch: [{ if: '!summary', children: [{ children: ['title', 'rows'] }] }, { children: [] }] },
              properties: {
                title: { type: 'string' },
                rows: { type: 'array', items: { type: 'object', properties: { height: { type: 'integer' } } } }
              }
            }
          }
        }
      }
    ]
  }

  it('should name every faulty data path instead of collapsing them onto the list', () => {
    // Reproduced from app-dashboards: two badly typed values at two depths produced ONE
    // error, "must be integer", posed on the sections array — the title error lost and
    // the reported path pointing at something that is not an integer at all. The agent
    // knows it is wrong but not where, and retries blind.
    const compiled = compile(summaryListSchema)
    const layout = new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree], { validateOn: 'input' }, {})

    const result = setData.execute(layout, { data: { sections: [{ title: 42, rows: [{ height: 'grand' }] }] } })
    const paths = result.errors.map((e) => e.path)

    assert.ok(
      result.errors.some((e) => e.path.endsWith('/sections/0/title') && e.message === 'must be string'),
      `the title error must survive and name its path, got ${JSON.stringify(result.errors)}`
    )
    assert.ok(
      result.errors.some((e) => e.path.endsWith('/sections/0/rows/0/height') && e.message === 'must be integer'),
      `the height error must name its path, got ${JSON.stringify(result.errors)}`
    )
    assert.ok(
      !paths.includes('/$allOf-1/sections'),
      'the misleading summary error on the array itself must not be reported'
    )
  })
})

describe('webmcp suggestions flag', () => {
  const schema = {
    type: 'object',
    properties: {
      plainList: { type: 'array', title: 'Plain list', items: { type: 'string' } },
      pickedList: {
        type: 'array',
        title: 'Picked list',
        items: { type: 'string' },
        layout: { getItems: { expr: '["a","b"]', pure: true } }
      },
      picker: { type: 'string', title: 'Picker', layout: { getItems: { expr: '["x","y"]', pure: true } } }
    }
  }

  const layoutOf = () => {
    const compiled = compile(schema)
    return new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree], { validateOn: 'input' }, {})
  }

  /**
   * @param {StatefulLayout} layout
   * @param {string} key
   * @returns {any}
   */
  const nodeFor = (layout, key) => (layout.stateTree.root.children ?? []).find((c) => c.key === key)

  it('should only flag suggestions on nodes that actually have an items source', () => {
    // The flag used to come from the component kind alone, so a plain array of strings —
    // which renders as a combobox and has no getItems — announced suggestions. The
    // fill-form guide tells agents they MUST call getFieldSuggestions when they see the
    // flag, so they obeyed and got "node /plainList is missing items or getItems
    // parameters". The state layer never made that promise: it gates fetching on
    // layout.items || layout.getItems.
    const layout = layoutOf()
    const markdown = projectStateTreeToMarkdown(layout.stateTree, layout)
    const lineFor = (/** @type {string} */ key) =>
      markdown.split('\n').find((/** @type {string} */ l) => l.includes(`/${key} `)) ?? ''

    assert.ok(!/suggestions|values=/.test(lineFor('plainList')), 'a node with no items source must neither promise suggestions nor state options')
    // both of these resolve their options locally, so the line states them outright rather
    // than sending the agent to fetch what the form already holds
    assert.ok(lineFor('pickedList').includes('values=["a","b"]'), `got: ${lineFor('pickedList')}`)
    assert.ok(lineFor('picker').includes('values=["x","y"]'), `got: ${lineFor('picker')}`)

    // the structured projection is a second, independent surface with the same promise
    const layout2 = layoutOf()
    assert.ok(!projectNode(nodeFor(layout2, 'plainList'), layout2).getSuggestions)
    assert.ok(projectNode(nodeFor(layout2, 'pickedList'), layout2).getSuggestions)
    assert.ok(projectNode(nodeFor(layout2, 'picker'), layout2).getSuggestions)
  })

  it('should keep the flag and getFieldSuggestions in agreement', async () => {
    // Whatever the projection promises, the tool must deliver. Not a biconditional any
    // more: a node whose options are stated outright still answers getFieldSuggestions, it
    // simply gives the agent no reason to ask.
    const layout = layoutOf()
    const markdown = projectStateTreeToMarkdown(layout.stateTree, layout)
    for (const key of ['plainList', 'pickedList', 'picker']) {
      const line = markdown.split('\n').find((/** @type {string} */ l) => l.includes(`/${key} `)) ?? ''
      if (!line.includes('suggestions')) continue
      await getFieldSuggestions.execute(layout, { path: `/${key}` }, new SuggestionsStore())
    }
    // and the node with no items source must still be the one that cannot deliver
    await assert.rejects(() => getFieldSuggestions.execute(layout, { path: '/plainList' }, new SuggestionsStore()))
  })
})

describe('webmcp variant activation', () => {
  const schema = {
    type: 'object',
    properties: {
      title: { type: 'string', title: 'Title' },
      shape: {
        type: 'object',
        oneOf: [
          { title: 'Circle', properties: { kind: { const: 'circle' }, radius: { type: 'number', title: 'Radius' } } },
          { title: 'Rect', properties: { kind: { const: 'rect' }, w: { type: 'number', title: 'Width' }, h: { type: 'number', title: 'Height' } } }
        ]
      }
    }
  }

  const layoutOf = () => {
    const compiled = compile(schema)
    return new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree], { validateOn: 'input' }, {})
  }

  it('should report the fields a variant activation revealed', () => {
    // Switching a variant replaces a whole subtree, but setFieldValue used to answer with
    // only the value it wrote. editArray already prints the fields of the item it
    // activated, so an agent that added an array item was told where to write next while
    // an agent that switched a variant had to spend a describeState to find out — at the
    // most important moment of a discriminated union.
    const layout = layoutOf()
    const result = setFieldValue.execute(layout, { path: '/shape/$oneOf', value: 1 })
    const markdown = /** @type {any} */(result).activatedMarkdown
    assert.ok(markdown, 'activating a variant must report the branch it activated')
    assert.ok(markdown.includes('/shape/$oneOf/1/w'), 'the activated branch\'s paths must be usable directly')
    assert.ok(markdown.includes('Width') && markdown.includes('Height'))
  })

  it('should not report activated fields for an ordinary write', () => {
    // Only an activation reveals a subtree; a plain write must stay as terse as it is.
    const layout = layoutOf()
    const result = setFieldValue.execute(layout, { path: '/title', value: 'hello' })
    assert.equal(/** @type {any} */(result).activatedMarkdown, undefined)
  })

  it('should put the activated fields in the tool text', async () => {
    const layout = layoutOf()
    const tools = new WebMCP(layout, { dataTitle: 'doc' }).getTools()
    const tool = tools.find((t) => t.name === 'setFieldValue')
    const res = await /** @type {any} */(tool).execute({ path: '/shape/$oneOf', value: 1 })
    const text = res.content.map((/** @type {any} */ p) => p.text ?? '').join('')
    assert.match(text, /activated/i, 'the agent reads the text, not the structured content')
    assert.ok(text.includes('/shape/$oneOf/1/w'))
  })
})

describe('webmcp suggestions store', () => {
  it('should never let a later search change what an earlier index means', () => {
    // The store kept one result per path, so searching the same field again silently
    // rebound every index. An agent holding index 1 from the first search would apply
    // the second search's item 1 — a different dataset, with no error at all. The eval's
    // charts case hit exactly this and only escaped by re-running its winning query.
    const store = new SuggestionsStore()
    const first = store.add('/dataset', [{ value: { id: 'air' }, title: 'Air quality' }])
    const second = store.add('/dataset', [{ value: { id: 'schools' }, title: 'Schools' }])

    assert.equal(first, 0, 'the first search starts at 0')
    assert.equal(second, 1, 'a later search continues where the previous one stopped')
    assert.deepEqual(store.getValue('/dataset', 0), { id: 'air' }, 'the earlier index must still mean what the agent saw')
    assert.deepEqual(store.getValue('/dataset', 1), { id: 'schools' })
  })

  it('should still reject an index that was never handed out', () => {
    const store = new SuggestionsStore()
    store.add('/dataset', [{ value: 1, title: 'one' }])
    assert.throws(() => store.getValue('/dataset', 5), /out of bounds/)
    assert.throws(() => store.getValue('/other', 0), /no suggestion memorized/)
  })

  it('should forget everything when cleared, so indices restart', () => {
    // setFieldValue clears the store because a write can change another field's options.
    const store = new SuggestionsStore()
    store.add('/dataset', [{ value: 1, title: 'one' }])
    store.clear()
    assert.equal(store.add('/dataset', [{ value: 2, title: 'two' }]), 0)
    assert.equal(store.getValue('/dataset', 0), 2)
  })

  it('should number projected suggestions from the base the store gave', () => {
    // The printed index is what the agent passes back, so it has to be the absolute one.
    const projected = projectSuggestions([{ value: 'b', title: 'B' }], 3)
    assert.equal(projected[0].index, 3)
  })
})

describe('webmcp suggestions store, through the tools', () => {
  const schema = {
    type: 'object',
    properties: {
      shape: {
        type: 'object',
        oneOf: [
          { title: 'Circle', properties: { kind: { const: 'circle' } } },
          { title: 'Rect', properties: { kind: { const: 'rect' } } }
        ]
      }
    }
  }

  it('should keep indices absolute across repeated searches on one path', async () => {
    // Two searches on the same field used to both start at 0, so the second silently
    // took ownership of index 0. The agent has no way to know that happened.
    const compiled = compile(schema)
    const layout = new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree], { validateOn: 'input' }, {})
    const tools = new WebMCP(layout, { dataTitle: 'doc' }).getTools()
    const tool = /** @type {any} */(tools.find((t) => t.name === 'getFieldSuggestions'))

    const first = await tool.execute({ path: '/shape/$oneOf' })
    const second = await tool.execute({ path: '/shape/$oneOf' })
    const indicesOf = (/** @type {any} */ res) => res.structuredContent.items.map((/** @type {any} */ i) => i.index)

    assert.deepEqual(indicesOf(first), [0, 1])
    assert.deepEqual(indicesOf(second), [2, 3], 'a repeated search must not reuse indices it already handed out')
  })
})

describe('webmcp large value rendering', () => {
  const big = { schema: Array.from({ length: 40 }, (_, i) => ({ key: 'col' + i, title: 'Column ' + i, type: 'string' })), id: 'ds', title: 'Big dataset' }

  it('should abbreviate a value too large to be worth printing', () => {
    assert.equal(abbreviateValue('short'), '"short"')
    assert.equal(abbreviateValue(1815), '1815')
    assert.equal(abbreviateValue({ a: 1 }), '{"a":1}')
    const abbreviated = abbreviateValue(big)
    assert.match(abbreviated, /^<object, \d+ chars/, `got ${abbreviated}`)
    assert.ok(!abbreviated.includes('col0'), 'no fragment of the value may be printed')
    assert.match(abbreviateValue([big, big]), /^<array of 2 items, \d+ chars/)
  })

  it('should abbreviate the echo of a written value', async () => {
    // getFieldSuggestions omits an object value so the agent never has to handle it, and
    // then the write used to echo the whole thing back, undoing the saving on the very
    // next call: 12.6 KB on the calendar case, 4.3 KB on charts.
    const schema = { type: 'object', properties: { dataset: { type: 'object', properties: {} } } }
    const compiled = compile(schema)
    const layout = new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree], { debounceInputMs: 0 }, {})
    const tools = new WebMCP(layout, { dataTitle: 'doc' }).getTools()
    const res = await /** @type {any} */(tools.find((t) => t.name === 'setFieldValue')).execute({ path: '/dataset', value: big })
    const text = res.content.map((/** @type {any} */ p) => p.text ?? '').join('')
    assert.ok(!text.includes('col0'), `the written value must not be echoed in full: ${text.slice(0, 120)}`)
    assert.match(text, /<object, \d+ chars/)
  })

  it('should return the data whole from getData, never abbreviated', async () => {
    const schema = {
      type: 'object',
      properties: {
        title: { type: 'string' },
        datasets: { type: 'array', items: { type: 'object', properties: {} } }
      }
    }
    const compiled = compile(schema)
    const layout = new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree], { debounceInputMs: 0 }, { title: 'Nos données', datasets: [big] })
    const tools = new WebMCP(layout, { dataTitle: 'doc' }).getTools()
    const res = await /** @type {any} */(tools.find((t) => t.name === 'getData')).execute({})
    const text = res.content.map((/** @type {any} */ p) => p.text ?? '').join('')
    // This tool's answer IS the data. An agent may forward it to an API, so a document
    // carrying a placeholder where a value should be would be sent as that placeholder
    // with nothing looking wrong — the same silent-wrong-value class as a suggestion
    // index that no longer means what it meant. Volume is a question of when to call
    // getData on a large form, which the guide answers; the tool does not get to lie.
    assert.deepEqual(JSON.parse(text).data, { title: 'Nos données', datasets: [big] })
    assert.deepEqual(res.structuredContent.data, { title: 'Nos données', datasets: [big] })
    assert.ok(text.includes('col0'), 'the whole value must be present')
  })
})

describe('webmcp getData by path', () => {
  const schema = {
    type: 'object',
    properties: {
      title: { type: 'string', title: 'Title' },
      datasets: { type: 'array', items: { type: 'object', properties: {} } }
    }
  }
  const dataset = { schema: Array.from({ length: 40 }, (_, i) => ({ key: 'col' + i })), id: 'ds', title: 'Big' }
  const data = { title: 'Nos données', datasets: [dataset] }

  const toolsFor = () => {
    const compiled = compile(schema)
    const layout = new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree], { debounceInputMs: 0 }, structuredClone(data))
    return new WebMCP(layout, { dataTitle: 'doc' }).getTools()
  }
  const call = async (/** @type {any} */ tools, /** @type {object} */ args) =>
    (await /** @type {any} */(tools.find((/** @type {any} */ t) => t.name === 'getData')).execute(args))

  it('should still return the whole data with no path', async () => {
    const res = await call(toolsFor(), {})
    assert.deepEqual(res.structuredContent.data, data)
  })

  it('should return only the subtree asked for, faithfully', async () => {
    // The point is to remove the reason to pull the whole document, not to shrink what is
    // returned: everything here is real data, so it can still be forwarded to an API.
    const res = await call(toolsFor(), { path: '/title' })
    assert.equal(res.structuredContent.data, 'Nos données')
    const sub = await call(toolsFor(), { path: '/datasets/0' })
    assert.deepEqual(sub.structuredContent.data, dataset, 'a subtree is returned in full, never abbreviated')
    const text = sub.content.map((/** @type {any} */ p) => p.text ?? '').join('')
    assert.ok(text.includes('col0'))
  })

  it('should report an unknown path rather than answer with nothing', async () => {
    const res = await call(toolsFor(), { path: '/nope' })
    assert.ok(res.isError)
    assert.match(res.content[0].text, /node not found at path/)
  })
})

describe('webmcp reveals caused by a write', () => {
  const schema = {
    type: 'object',
    properties: {
      enabled: { type: 'boolean', title: 'Enable contributions' },
      contribColor: { type: 'string', title: 'Colour', default: '#7AA95C', layout: { if: 'parent.data.enabled' } },
      contribDataset: { type: 'string', title: 'Contributions dataset', layout: { if: 'parent.data.enabled' } },
      always: { type: 'string', title: 'Always here' }
    }
  }
  const toolsFor = () => {
    const compiled = compile(schema)
    const layout = new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree], { debounceInputMs: 0 }, {})
    return new WebMCP(layout, { dataTitle: 'doc' }).getTools()
  }
  const run = async (/** @type {string} */ name, /** @type {object} */ args) => {
    const res = await /** @type {any} */(toolsFor().find((t) => t.name === name)).execute(args)
    return res.content.map((/** @type {any} */ p) => p.text ?? '').join('')
  }

  it('should say which fields a write made available', async () => {
    // Turning a flag on can unhide a whole section. The response used to report only the
    // flag, so calendar's agent set crowdSourcing, was told "form is valid", and stopped
    // — while the contributions dataset it had just made reachable sat unmentioned.
    const text = await run('setFieldValue', { path: '/enabled', value: true })
    assert.match(text, /became available/i, `got: ${text}`)
    assert.ok(text.includes('/contribColor') && text.includes('/contribDataset'))
  })

  it('should say nothing extra when a write reveals nothing', async () => {
    const text = await run('setFieldValue', { path: '/always', value: 'x' })
    assert.ok(!/became available/i.test(text), `got: ${text}`)
  })

  it('should report reveals from setData too', async () => {
    const text = await run('setData', { data: { enabled: true } })
    assert.match(text, /became available/i, `got: ${text}`)
    assert.ok(text.includes('/contribColor'))
  })

  it('should not double-report an activated variant as newly available', async () => {
    // Switching a variant already lists the activated branch's fields; those nodes are
    // new keys rather than nodes that changed visibility, so they must not be counted
    // again as reveals or every variant switch would print its subtree twice.
    const oneOf = {
      type: 'object',
      properties: {
        shape: {
          type: 'object',
          oneOf: [
            { title: 'Circle', properties: { kind: { const: 'circle' }, radius: { type: 'number' } } },
            { title: 'Rect', properties: { kind: { const: 'rect' }, w: { type: 'number' }, h: { type: 'number' } } }
          ]
        }
      }
    }
    const compiled = compile(oneOf)
    const layout = new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree], { debounceInputMs: 0 }, {})
    const tools = new WebMCP(layout, { dataTitle: 'doc' }).getTools()
    const res = await /** @type {any} */(tools.find((t) => t.name === 'setFieldValue')).execute({ path: '/shape/$oneOf', value: 1 })
    const text = res.content.map((/** @type {any} */ p) => p.text ?? '').join('')
    assert.match(text, /activated variant/i, 'the activated branch is still reported')
    assert.ok(!/became available/i.test(text), `a variant switch must not also report reveals: ${text}`)
  })
})

describe('webmcp tool descriptions', () => {
  const schema = { type: 'object', properties: { a: { type: 'string' } } }
  const registered = () => {
    const compiled = compile(schema)
    const layout = new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree], { debounceInputMs: 0 }, {})
    return new WebMCP(layout, { dataTitle: 'doc', schema }).getTools()
  }

  it('should describe every tool from its own module', () => {
    // getData was the one exception: index.js registered it with an inline description
    // while get-data.js exported another that nothing called. Editing the module's had no
    // effect on what the agent read, and the live one said "Call this first to see what
    // data already exists" — a prescription that outlived three rounds of work on the
    // guide, because the guide was never where it lived.
    // Only the tools whose description depends on nothing but the title; setData and
    // describeState also take the complexity band, so they are not comparable here.
    const modules = { getData, setFieldValue, getFieldSuggestions, editArray, getSchema }
    let checked = 0
    for (const tool of registered()) {
      const mod = /** @type {any} */(modules)[tool.name]
      if (!mod) continue
      assert.equal(tool.description, mod.getDescription('doc'), `${tool.name} must be described by its own module`)
      checked++
    }
    assert.equal(checked, Object.keys(modules).length, 'every one of them must have been registered and checked')
  })

  it('should not tell the agent to call getData first', () => {
    const tool = registered().find((t) => t.name === 'getData')
    assert.ok(tool)
    assert.ok(!/call this first/i.test(tool.description), `got: ${tool.description}`)
  })
})

describe('webmcp tuple entry requiredness', () => {
  // The calendar eval case ended with the agent told that /$allOf-0/datasets/1 was
  // "required" and undefined by the same response that said the form was valid, and it
  // spent three of twelve calls looking for a value the goal never mentioned. Every tuple
  // entry was flagged required, whatever minItems said.
  const schema = {
    type: 'object',
    properties: {
      datasets: {
        type: 'array',
        minItems: 1,
        items: [
          { title: 'Main dataset', type: 'object', properties: { href: { type: 'string' } } },
          { title: 'Contributions dataset', type: 'object', properties: { href: { type: 'string' } } }
        ]
      }
    }
  }
  const layoutOf = () => {
    const compiled = compile(schema)
    return new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree], { debounceInputMs: 0, validateOn: 'input' }, {})
  }

  it('should not report an optional tuple entry as required', () => {
    const layout = layoutOf()
    const markdown = projectStateTreeToMarkdown(layout.stateTree, layout)
    const lineFor = (/** @type {string} */ path) =>
      markdown.split('\n').find((/** @type {string} */ l) => l.includes(`${path} `)) ?? ''

    assert.ok(lineFor('/datasets/0').includes('required'), `minItems covers entry 0: ${lineFor('/datasets/0')}`)
    assert.ok(!lineFor('/datasets/1').includes('required'), `minItems stops before entry 1: ${lineFor('/datasets/1')}`)
  })

  it('should not claim any entry of a minItems-less tuple is required', () => {
    // the calendar shape, where the entries are leaves and the line carries a value: no
    // minItems at all, so the array validates empty and neither entry is owed anything.
    // This is the response the agent read as a contradiction — required and undefined,
    // under "form is valid".
    const compiled = compile({
      type: 'object',
      properties: { datasets: { type: 'array', items: [{ type: 'string' }, { type: 'string' }] } }
    })
    const layout = new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree], { debounceInputMs: 0, validateOn: 'input' }, {})
    assert.equal(layout.stateTree.valid, true, 'nothing in this schema is unsatisfied')
    const lines = projectStateTreeToMarkdown(layout.stateTree, layout).split('\n')
      .filter((/** @type {string} */ l) => l.includes('/datasets/'))
    assert.equal(lines.length, 2, `both entries must be rendered: ${lines.join(' | ')}`)
    for (const line of lines) {
      assert.ok(line.includes('value=undefined'), `precondition, the entry is empty: ${line}`)
      assert.ok(!line.includes('required'), `required and empty while valid: ${line}`)
    }
  })
})

describe('webmcp repeated variant lists', () => {
  // A discriminated union is a constant: portal-page reaches the same 39-branch element
  // union at every level of its recursion, and the projection printed all of them each
  // time — three emissions in a ten-call run, 4.45 KB of 10.8 KB, read once and used once.
  const schema = {
    type: 'object',
    properties: { elements: { type: 'array', items: { $ref: '#/$defs/element' } } },
    $defs: {
      element: {
        type: 'object',
        oneOf: [
          { title: 'Text', properties: { type: { const: 'text' }, content: { type: 'string' } } },
          { title: 'Group', properties: { type: { const: 'group' }, children: { type: 'array', items: { $ref: '#/$defs/element' } } } }
        ]
      }
    }
  }
  const toolsOf = () => {
    const compiled = compile(schema)
    const layout = new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree], { debounceInputMs: 0 }, {})
    return new WebMCP(layout, { dataTitle: 'page' }).getTools()
  }
  /**
   * @param {any[]} tools
   * @param {string} name
   * @param {any} args
   * @returns {Promise<string>}
   */
  const run = async (tools, name, args) => {
    const res = await /** @type {any} */(tools.find((t) => t.name === name)).execute(args)
    return res.content.map((/** @type {any} */ p) => p.text ?? '').join('')
  }

  it('should list a union once and point back to it afterwards', async () => {
    const tools = toolsOf()
    const first = await run(tools, 'editArray', { path: '/elements', action: 'add' })
    assert.match(first, /- variant 0: Text/, 'the first sighting must list the branches')

    await run(tools, 'setFieldValue', { path: '/elements/0/$oneOf', value: 1 })
    const nested = await run(tools, 'editArray', { path: '/elements/0/$oneOf/1/children', action: 'add' })

    assert.ok(!/- variant 0: Text/.test(nested), `the same union must not be listed again: ${nested}`)
    assert.match(nested, /2 variants, the same list already given for \/elements\/0\/\$oneOf/)
    // "this path" was ambiguous between the path just named and the node being described
    assert.match(nested, /call describeState on \/elements\/0\/\$oneOf\/1\/children\/0\/\$oneOf to see them again/)
    // the branch that is actually being edited is still spelled out
    assert.match(nested, /\/elements\/0\/\$oneOf\/1\/children\/0\/\$oneOf\/0\/content \(text\)/)
  })

  it('should let describeState list a union it had already given', async () => {
    // the escape hatch the elided line names: a read is what the agent asked to see, so it
    // is answered in full whatever was sent before
    const tools = toolsOf()
    await run(tools, 'editArray', { path: '/elements', action: 'add' })
    await run(tools, 'setFieldValue', { path: '/elements/0/$oneOf', value: 1 })
    await run(tools, 'editArray', { path: '/elements/0/$oneOf/1/children', action: 'add' })

    const read = await run(tools, 'describeState', { path: '/elements/0/$oneOf/1/children/0/$oneOf' })
    assert.match(read, /- variant 0: Text/)
    assert.match(read, /- variant 1: Group/)
  })

  it('should list a union once within a single full read', async () => {
    const tools = toolsOf()
    await run(tools, 'editArray', { path: '/elements', action: 'add' })
    await run(tools, 'editArray', { path: '/elements', action: 'add', index: 1 })

    const read = await run(tools, 'describeState', {})
    assert.equal(read.match(/- variant 0: Text/g)?.length, 1, `listed once, not per item: ${read}`)
    assert.equal(read.match(/the same list already given/g)?.length, 1)
  })

  it('should keep listing every union when no memo is passed', () => {
    // projectNodeToMarkdown is exported and used outside the tools; without a memo it must
    // behave exactly as it did before
    const compiled = compile(schema)
    const layout = new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree], { debounceInputMs: 0 }, { elements: [{ type: 'group', children: [{ type: 'text' }] }] })
    const markdown = projectNodeToMarkdown(layout.stateTree.root, layout)
    assert.ok((markdown.match(/- variant 0: Text/g)?.length ?? 0) >= 1)
    assert.ok(!/the same list already given/.test(markdown))
  })
})

describe('webmcp help text', () => {
  it('should read help as text rather than as markup', () => {
    // help is authored as HTML for a browser; an agent reads text, and `&#39;` is harder to
    // read than the apostrophe it stands for
    assert.equal(
      helpToText('<h3>Titre</h3>\n<ul>\n<li><strong>Court :</strong> 150 caractères.  </li>\n</ul>\n<p>l&#39;auteur &amp; vous</p>'),
      "Titre - Court : 150 caractères. l'auteur & vous"
    )
    // the newlines between block tags used to land inside a state-tree line
    assert.ok(!helpToText('<p>a</p>\n<p>b</p>').includes('\n'))
  })

  const longHelp = 'Conseils pour la description. '.repeat(30)
  const shortHelp = 'Une hauteur négative signifie un dimensionnement automatique.'
  const schema = {
    type: 'object',
    properties: {
      description: { type: 'string', description: longHelp },
      height: { type: 'number', description: shortHelp }
    }
  }
  const toolsOf = () => {
    const compiled = compile(schema)
    const layout = new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree], { debounceInputMs: 0 }, {})
    return new WebMCP(layout, { dataTitle: 'page' }).getTools()
  }
  /**
   * @param {any[]} tools
   * @param {any} args
   * @returns {Promise<string>}
   */
  const read = async (tools, args) => {
    const res = await /** @type {any} */(tools.find((t) => t.name === 'describeState')).execute(args)
    return res.content.map((/** @type {any} */ p) => p.text ?? '').join('')
  }

  it('should name long help instead of printing it in a full read', async () => {
    assert.ok(longHelp.length > HELP_MAX_LENGTH, 'precondition')
    const full = await read(toolsOf(), {})
    assert.match(full, /help=<\d+ chars — describeState \/description to read it>/)
    assert.ok(!full.includes('Conseils pour la description. Conseils'), 'the prose itself must not be there')
  })

  it('should keep short help inline, it is what changes what an agent writes', async () => {
    const full = await read(toolsOf(), {})
    assert.ok(full.includes(`help="${shortHelp}"`), `got: ${full}`)
  })

  it('should give long help in full to whoever asks for that node', async () => {
    // the escape hatch the named line points at
    const one = await read(toolsOf(), { path: '/description' })
    assert.ok(one.includes(longHelp.trim()), `got: ${one}`)
  })
})

describe('webmcp instruction redundancy', () => {
  // One fact, one home. The suggestion protocol used to be stated four times — in
  // getFieldSuggestions' description, again in setFieldValue's, a third time in its
  // suggestionIndex parameter and a fourth in the guide. Four copies that had to agree,
  // and 7d3814e is what happens when two copies of one fact drift: index.js held a stale
  // duplicate of getData's description and cost two eval cases a call each.
  const schema = {
    type: 'object',
    properties: { pick: { type: 'string', oneOf: [{ const: 'a', title: 'A' }, { const: 'b', title: 'B' }] } }
  }
  const webmcpOf = () => {
    const compiled = compile(schema)
    const layout = new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree], { debounceInputMs: 0 }, {})
    return new WebMCP(layout, { dataTitle: 'doc', schema })
  }

  it('should explain how to apply a suggestion in exactly one place', () => {
    const tools = webmcpOf().getTools()
    const explains = tools.filter((t) => /suggestionIndex/.test(t.description ?? ''))
    assert.deepEqual(explains.map((t) => t.name), ['getFieldSuggestions'],
      'the mechanics belong to the tool that hands out the indexes, and nowhere else')
  })

  it('should let the guide say when to fetch suggestions without repeating how', () => {
    // the split that keeps this from being a loss: the guide carries the trigger, where a
    // prescription is followed, and points at the description for the mechanics
    const skill = fillFormSkill.generateSkill('doc', '', true, webmcpOf()._statefulLayout)
    assert.match(skill, /call getFieldSuggestions/, 'the trigger stays in the guide')
    // One rule with two branches rather than an imperative and an exception. "You must call
    // getFieldSuggestions" read as unconditional, and the sentence that followed it looked
    // like a contradiction rather than the other half; both branches now hang off the same
    // goal, which is never inventing a value.
    assert.match(skill, /Never invent a value/, 'the rule is about the goal, not about a tool')
    assert.match(skill, /states them on the field's line as values=/, 'the branch that needs no call')
    assert.match(skill, /only behind a request/, 'the branch that does')
    assert.ok(!/suggestionIndex/.test(skill), `still no mechanics in the guide: ${skill}`)
  })

  it('should describe a node path the same way in every tool', () => {
    const tools = webmcpOf().getTools()
    const paths = tools
      .map((t) => /** @type {any} */(t.inputSchema)?.properties?.path?.description)
      .filter((/** @type {string|undefined} */ d) => !!d)
    assert.ok(paths.length >= 5, 'several tools take a path')
    for (const d of paths) {
      assert.match(d, /^Node path as returned by describeState \(e\.g\. "\/address\/city"\)\./,
        `every path parameter opens with the same sentence, got: ${d}`)
    }
  })
})

describe('webmcp suggestions invalidated by a write', () => {
  // charts hit this twice: getFieldSuggestions, one unrelated write, apply the index —
  // and the store had thrown everything away. The first time the agent recovered in one
  // call by copying the literal; the second it took three, re-fetching at the very end of
  // the run. Clearing everything was correct but far broader than the hazard.
  const schema = {
    type: 'object',
    properties: {
      kind: { type: 'string' },
      dependent: { type: 'string', layout: { getItems: { expr: 'rootData.kind === "a" ? ["a1","a2"] : ["b1","b2"]', pure: false } } },
      fixed: { type: 'string', oneOf: [{ const: 'x', title: 'X' }, { const: 'y', title: 'Y' }] },
      other: { type: 'string' }
    }
  }
  const toolsOf = () => {
    const compiled = compile(schema)
    const layout = new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree], { debounceInputMs: 0 }, { kind: 'a' })
    return new WebMCP(layout, { dataTitle: 'doc' }).getTools()
  }
  /**
   * @param {any[]} tools
   * @param {string} name
   * @param {any} args
   * @returns {Promise<string>}
   */
  const run = async (tools, name, args) => {
    const res = await /** @type {any} */(tools.find((t) => t.name === name)).execute(args)
    return res.content.map((/** @type {any} */ p) => p.text ?? '').join('')
  }

  it('should keep a suggestion a write could not have changed', async () => {
    const tools = toolsOf()
    await run(tools, 'getFieldSuggestions', { path: '/fixed' })
    await run(tools, 'setFieldValue', { path: '/other', value: 'anything' })
    const applied = await run(tools, 'setFieldValue', { path: '/fixed', suggestionIndex: 0 })
    assert.match(applied, /\/fixed \(select\) = "x"/, `a static enum cannot be changed by writing another field: ${applied}`)
  })

  it('should drop a suggestion whose options the write did change', async () => {
    const tools = toolsOf()
    await run(tools, 'getFieldSuggestions', { path: '/dependent' })
    await run(tools, 'setFieldValue', { path: '/kind', value: 'b' })
    const applied = await run(tools, 'setFieldValue', { path: '/dependent', suggestionIndex: 0 })
    assert.match(applied, /were dropped by a write/, `the list really is stale here: ${applied}`)
  })

  it('should not tell an agent to fetch suggestions it had already fetched', async () => {
    // the message is the other half: "call getFieldSuggestions on this path first" reads
    // as "you never asked", and the eval shows an agent that reads it stops trusting
    // suggestionIndex for the rest of the run
    const tools = toolsOf()
    await run(tools, 'getFieldSuggestions', { path: '/dependent' })
    await run(tools, 'setFieldValue', { path: '/kind', value: 'b' })
    const stale = await run(tools, 'setFieldValue', { path: '/dependent', suggestionIndex: 0 })
    assert.ok(!/on this path first/.test(stale), `it did ask, one call ago: ${stale}`)
    assert.match(stale, /again/)

    const never = await run(toolsOf(), 'setFieldValue', { path: '/fixed', suggestionIndex: 0 })
    assert.match(never, /no suggestion memorized.*on this path first/, `never fetched still says so: ${never}`)
  })

  it('should still drop everything when paths themselves may have moved', async () => {
    // setData replaces the document and editArray shifts item indices: those invalidate
    // what a path DESIGNATES, which no cache key can detect
    const tools = toolsOf()
    await run(tools, 'getFieldSuggestions', { path: '/fixed' })
    await run(tools, 'setData', { data: { kind: 'a' } })
    const applied = await run(tools, 'setFieldValue', { path: '/fixed', suggestionIndex: 0 })
    assert.match(applied, /were dropped by a write/, `got: ${applied}`)
  })
})

describe('webmcp closed lists stated instead of flagged', () => {
  it('should state a resolved list and not send the agent to fetch it', () => {
    const compiled = compile({
      type: 'object',
      properties: { metric: { type: 'string', oneOf: [{ const: 'avg', title: 'Moyenne' }, { const: 'sum', title: 'Somme' }] } }
    })
    const layout = new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree], { debounceInputMs: 0 }, {})
    const line = projectStateTreeToMarkdown(layout.stateTree, layout).split('\n').find((l) => l.includes('/metric ')) ?? ''
    assert.match(line, /values=\["avg","sum"\]/)
    assert.ok(!line.includes('suggestions'), `the guide makes "suggestions" an order to fetch: ${line}`)
  })

  it('should still flag a list only a request can answer', () => {
    // itemsCacheKey is the URL here, not the options: the form does not know them
    const compiled = compile({
      type: 'object',
      properties: { dataset: { type: 'string', layout: { getItems: { url: 'http://example.com/datasets?q={q}' } } } }
    })
    const layout = new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree], { debounceInputMs: 0 }, {})
    const line = projectStateTreeToMarkdown(layout.stateTree, layout).split('\n').find((l) => l.includes('/dataset ')) ?? ''
    assert.match(line, /suggestions/)
    assert.ok(!line.includes('values='), `a remote picker cannot be stated: ${line}`)
  })

  it('should not inline a list too long to say out loud', () => {
    const many = Array.from({ length: 60 }, (_, i) => `option-number-${i}`)
    const compiled = compile({ type: 'object', properties: { big: { type: 'string', enum: many } } })
    const layout = new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree], { debounceInputMs: 0 }, {})
    const line = projectStateTreeToMarkdown(layout.stateTree, layout).split('\n').find((l) => l.includes('/big ')) ?? ''
    assert.match(line, /suggestions/)
    assert.ok(!line.includes('values='), `beyond INLINE_ITEMS_MAX_LENGTH it goes back to being fetched: ${line.length} chars`)
  })
})

describe('webmcp validation constraints in the state', () => {
  it('should state what ajv will enforce, with or without a schema tool', () => {
    // The no-schema deployment is the one production ships: a build-time compiled layout
    // has no raw schema, so getSchema cannot exist there. Anything only getSchema could say
    // was information the shipped configuration never had.
    const compiled = compile({
      type: 'object',
      properties: {
        mail: { type: 'string', format: 'email', title: 'Email' },
        code: { type: 'string', pattern: '^[A-Z]{3}$', maxLength: 3, title: 'Code' },
        tags: { type: 'array', items: { type: 'string' }, maxItems: 5, uniqueItems: true, title: 'Tags' }
      }
    })
    const layout = new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree], { debounceInputMs: 0 }, {})
    const lines = projectStateTreeToMarkdown(layout.stateTree, layout).split('\n')
    const lineFor = (/** @type {string} */ p) => lines.find((l) => l.includes(`${p} `)) ?? ''

    assert.match(lineFor('/mail'), /format=email/)
    assert.match(lineFor('/code'), /pattern=\^\[A-Z\]\{3\}\$/)
    assert.match(lineFor('/code'), /maxLength=3/)
    assert.match(lineFor('/tags'), /maxItems=5/)
    assert.match(lineFor('/tags'), /uniqueItems=true/)
  })

  it('should say nothing extra about a field that constrains nothing', () => {
    const compiled = compile({ type: 'object', properties: { free: { type: 'string', title: 'Free' } } })
    const layout = new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree], { debounceInputMs: 0 }, {})
    const line = projectStateTreeToMarkdown(layout.stateTree, layout).split('\n').find((l) => l.includes('/free ')) ?? ''
    assert.equal(line.trim(), '- /free (text) label="Free" value=undefined', `got: ${line}`)
  })
})
