import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { compile } from '../src/compile/index.js'
import { serialize } from '../src/compile/serialize.js'
import { StatefulLayout } from '../src/state/index.js'
import { WebMCP, generateSkill } from '../src/webmcp/index.js'

// A per-entity guide: what the fields of THIS kind of document mean, its conventions and
// traps, written once next to its schema. json-layout cannot know them; the form tools
// carry them to whoever edits the document — in a browser (vjsf, WebMCP), server-side
// (@json-layout/agents sessions) or as an MCP skill (openapi-mcp editor groups).
const guidedSchema = {
  type: 'object',
  'x-agent-guide': 'Social links take an identifier, not a URL.',
  'x-i18n-x-agent-guide': { fr: 'Les réseaux sociaux prennent un identifiant, pas une URL.' },
  properties: { linkedin: { type: 'string' } }
}

describe('agent guide of a schema', () => {
  it('is kept in the compiled layout, localized', () => {
    assert.equal(compile(guidedSchema, { locale: 'en' }).agentGuide, 'Social links take an identifier, not a URL.')
    assert.equal(compile(guidedSchema, { locale: 'fr', xI18n: true }).agentGuide, 'Les réseaux sociaux prennent un identifiant, pas une URL.')
    assert.equal(compile({ type: 'string' }).agentGuide, undefined)
  })

  it('survives serialization, so a build-time compiled layout carries it', async () => {
    const code = await serialize(compile(guidedSchema, { locale: 'en' }))
    const filePath = resolve('tmp/compiled-agent-guide.js')
    await writeFile(filePath, code + '\nexport default compiledLayout;')
    const serialized = (await import(filePath)).default
    assert.equal(serialized.agentGuide, 'Social links take an identifier, not a URL.')
  })

  it('goes into the fill-form skill the public builder generates', () => {
    const skill = generateSkill('portal configuration', 'portalConfig_', { guide: 'Social links take an identifier, not a URL.' })
    assert.match(skill, /## About this portal configuration/)
    assert.ok(skill.includes('Social links take an identifier, not a URL.'))
    assert.ok(!generateSkill('portal configuration', 'portalConfig_').includes('## About this'))
  })

  it('reaches the sub-agent prompt and the fill-form skill tool of a WebMCP session', async () => {
    const compiled = compile(guidedSchema, { locale: 'en' })
    const layout = new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree], {}, {})
    const webmcp = new WebMCP(layout, { dataTitle: 'portal configuration', prefixName: 'portalConfig_', includeFillFormSkill: true, includeSubAgent: true })
    const tools = webmcp.getTools()
    const skillTool = /** @type {any} */(tools.find((t) => t.name === 'portalConfig_fillFormSkill'))
    const skillText = (await skillTool.execute({})).content[0].text
    assert.ok(skillText.includes('Social links take an identifier, not a URL.'))
    const subAgent = /** @type {any} */(tools.find((t) => t.name === 'subagent_portalConfig_form'))
    const { prompt } = JSON.parse((await subAgent.execute({ task: 'x' })).content[0].text)
    assert.ok(prompt.includes('Social links take an identifier, not a URL.'), 'the sub-agent prompt carries the guide')
  })
})

describe('report of the form sub-agent', () => {
  it('asks for a plain report of what the tools confirmed, for the lead', async () => {
    // judged runs: a sub-agent reported « scroll infini » for a block it had left without
    // pagination, and wrote emoji and bold headings, or prose addressed to the person
    const compiled = compile(guidedSchema, { locale: 'en' })
    const layout = new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree], {}, {})
    const webmcp = new WebMCP(layout, { dataTitle: 'portal configuration', prefixName: 'portalConfig_', includeSubAgent: true, includeFillFormSkill: true })
    const tools = webmcp.getTools()
    const subAgent = /** @type {any} */(tools.find((t) => t.name === 'subagent_portalConfig_form'))
    const { prompt } = JSON.parse((await subAgent.execute({ task: 'x' })).content[0].text)
    assert.match(prompt, /## Your report/)
    assert.match(prompt, /only what the tool results confirmed/)
    assert.match(prompt, /no emoji/)
    // a run asked to link a page that was not offered linked another one and called it valid
    assert.match(prompt, /never put another value in its place/)
    // judged runs: a sub-agent told « ne modifie rien » added and removed a menu row, which
    // left a draft to validate; and three said which tab was open, which no tool shows
    assert.match(prompt, /call no tool that writes/)
    assert.match(prompt, /You do not see the screen/)
    // the skill published to the lead is not a sub-agent: it gets no reporting rules
    const skillTool = /** @type {any} */(tools.find((t) => t.name === 'portalConfig_fillFormSkill'))
    assert.doesNotMatch((await skillTool.execute({})).content[0].text, /## Your report/)
  })
})

describe('a sub-agent that only reads', () => {
  it('gets no tool that writes when its task is declared read-only', async () => {
    // judged runs: a sub-agent told « ne modifie rien » added and removed a menu row anyway,
    // twice, which left a draft to validate; a rule in its prompt did not stop it
    const compiled = compile(guidedSchema, { locale: 'en' })
    const layout = new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree], {}, {})
    const tools = new WebMCP(layout, { dataTitle: 'portal configuration', prefixName: 'portalConfig_', includeSubAgent: true }).getTools()
    const subAgent = /** @type {any} */(tools.find((t) => t.name === 'subagent_portalConfig_form'))
    assert.ok(subAgent.inputSchema.properties.readOnly, 'the delegating agent can declare it')
    const readOnly = JSON.parse((await subAgent.execute({ task: 'x', readOnly: true })).content[0].text)
    for (const name of ['portalConfig_setData', 'portalConfig_setFieldValue', 'portalConfig_editArray']) {
      assert.ok(!readOnly.tools.includes(name), `${name} withheld`)
    }
    assert.ok(readOnly.tools.includes('portalConfig_describeState'))
    const full = JSON.parse((await subAgent.execute({ task: 'x' })).content[0].text)
    assert.ok(full.tools.includes('portalConfig_setFieldValue'))
  })

  it('is offered as read-only by the description of the tool that delegates to it', () => {
    // judged runs: the assistant asked the sub-agent four times to describe the menu, never
    // with readOnly, and twice the sub-agent wrote to the form anyway
    const compiled = compile(guidedSchema, { locale: 'en' })
    const layout = new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree], {}, {})
    const tools = new WebMCP(layout, { dataTitle: 'portal configuration', prefixName: 'portalConfig_', includeSubAgent: true }).getTools()
    const subAgent = /** @type {any} */(tools.find((t) => t.name === 'subagent_portalConfig_form'))
    assert.match(subAgent.description, /readOnly: true/)
  })
})
