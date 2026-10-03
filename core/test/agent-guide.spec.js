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
    // the skill published to the lead is not a sub-agent: it gets no reporting rules
    const skillTool = /** @type {any} */(tools.find((t) => t.name === 'portalConfig_fillFormSkill'))
    assert.doesNotMatch((await skillTool.execute({})).content[0].text, /## Your report/)
  })
})
