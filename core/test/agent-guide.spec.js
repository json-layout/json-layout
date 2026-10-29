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

  it('reaches the skill a WebMCP session publishes', () => {
    const compiled = compile(guidedSchema, { locale: 'en' })
    const layout = new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree], {}, {})
    const skill = new WebMCP(layout, { dataTitle: 'portal configuration', prefixName: 'portalConfig_' }).getSkill()
    assert.ok(skill.body.includes('Social links take an identifier, not a URL.'))
  })
})

describe('what the guide asks the agent to tell the person', () => {
  it('reports only what the tools confirmed, never a value in place of one not offered, never the screen', () => {
    // judged runs (when a sub-agent did this work): a setting reported that was never written
    // (« scroll infini »), another page linked than the one asked for and called valid, and the open
    // tab described, which no tool shows. The agent doing the work now reports to the person itself.
    const compiled = compile(guidedSchema, { locale: 'en' })
    const layout = new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree], {}, {})
    const { body } = new WebMCP(layout, { dataTitle: 'portal configuration', prefixName: 'portalConfig_' }).getSkill()
    assert.match(body, /only what the tool results confirmed/)
    assert.match(body, /never put another value in its place/)
    assert.match(body, /You do not see the screen/)
    // a form edited with no screen has nothing to say about one
    assert.doesNotMatch(generateSkill('portal configuration', 'portalConfig_', { screen: false }), /You do not see the screen/)
  })
})
