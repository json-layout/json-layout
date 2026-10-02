import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'

import { compile } from '../src/compile/index.js'
import { StatefulLayout } from '../src/state/index.js'
import { WebMCP } from '../src/webmcp/index.js'
import { generateFormOverview } from '../src/webmcp/form-overview.js'
import { generateSkill } from '../src/webmcp/tools/fill-form-skill.js'

/**
 * @param {object} schema
 * @param {import('../src/compile/index.js').PartialCompileOptions} [options]
 * @returns {string}
 */
function overviewOf (schema, options) {
  return generateFormOverview(compile(schema, options))
}

const simpleSchema = {
  type: 'object',
  title: 'Contact',
  required: ['name'],
  properties: {
    name: { type: 'string', title: 'Full name' },
    birthYear: { type: 'integer' },
    contactMethod: { type: 'string', enum: ['email', 'phone', 'post'] }
  }
}

describe('static form overview', () => {
  it('should list fields with paths, types, required markers and labels', () => {
    const overview = overviewOf(simpleSchema)
    assert.match(overview, /\/ \(section, required\) label="Contact"/)
    assert.match(overview, /\/name \(text, required\) label="Full name"/)
    assert.match(overview, /\/birthYear \(number\)/)
  })

  it('should state a closed list and elide a long one', () => {
    const overview = overviewOf(simpleSchema)
    assert.match(overview, /contactMethod \(select, values=\["email","phone","post"\]\)/)

    const longEnum = {
      type: 'object',
      properties: {
        color: { type: 'string', enum: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'] }
      }
    }
    assert.match(overviewOf(longEnum), /color \(select, values=\["a","b","c","d","e","f","g","h"\] \(\+2 more\)\)/)
  })

  it('should name the branches of a union that is not active yet', () => {
    const schema = {
      type: 'object',
      properties: {
        choice: {
          type: 'object',
          oneOf: [
            { title: 'First', type: 'object', required: ['x'], properties: { x: { type: 'number' }, common: { type: 'string' } } },
            { title: 'Second', type: 'object', properties: { y: { type: 'boolean' } } }
          ]
        }
      }
    }
    const overview = overviewOf(schema)
    assert.match(overview, /\/choice\/\$oneOf \(variant-selector\)/)
    assert.match(overview, /variant 0: First — \{ x\*: number, common: text \}/)
    assert.match(overview, /variant 1: Second — \{ y: boolean \}/)
  })

  it('should keep every variant title when a union has too many branches to shape', () => {
    const branches = Array.from({ length: 25 }, (_, i) => ({
      title: `V${i}`,
      type: 'object',
      properties: { [`f${i}`]: { type: 'string' } }
    }))
    const schema = { type: 'object', properties: { choice: { type: 'object', oneOf: branches } } }
    const overview = overviewOf(schema)
    assert.match(overview, /variant 24: V24/)
    assert.ok(!overview.includes('f24'), `branch shapes must be dropped when titles are many: ${overview}`)
  })

  it('should show the fields of an array item under its index', () => {
    const schema = {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          items: { type: 'object', required: ['id'], properties: { id: { type: 'string' }, note: { type: 'string' } } }
        }
      }
    }
    const overview = overviewOf(schema)
    assert.match(overview, /\/items \(array\)/)
    assert.match(overview, /\/items\/0 \(section, required\)/)
    assert.match(overview, /\/items\/0\/id \(text, required\)/)
  })

  it('should terminate on a recursive schema and say where it stopped', () => {
    const schema = {
      type: 'object',
      properties: {
        label: { type: 'string' },
        children: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string' },
              children: { type: 'array', items: { $ref: '#' } }
            }
          }
        }
      }
    }
    const overview = overviewOf(schema)
    assert.ok(overview.length < 4000, `recursion must be bounded, got ${overview.length} chars`)
    assert.match(overview, /same structure as|same \d+ variants|of …/)
  })

  it('should mark a section that only exists under a condition', () => {
    const schema = {
      type: 'object',
      properties: {
        flag: { type: 'boolean' },
        shown: { type: 'string' }
      },
      if: { properties: { flag: { const: true } } },
      then: { properties: { extra: { type: 'string' } } }
    }
    const overview = overviewOf(schema)
    assert.match(overview, /\$then \(section, conditional\)/)
    assert.match(overview, /\/\$then\/extra \(text\)/)
  })

  it('should stop at the character budget with a pointer to the live tree', () => {
    const overview = overviewOf(simpleSchema, {})
    assert.ok(!overview.includes('truncated'))
    const small = generateFormOverview(compile(simpleSchema), { maxLength: 60 })
    assert.match(small, /overview truncated at 60 characters/)
  })
})

describe('form overview in the guide', () => {
  it('should be absent unless the caller asks for it', () => {
    assert.ok(!generateSkill('doc', '').includes('Form structure'))
    assert.ok(!generateSkill('doc', '', '').includes('Form structure'))
  })

  it('should be inserted as static context with a warning that it is not state', () => {
    const overview = overviewOf(simpleSchema)
    const skill = generateSkill('doc', '', overview)
    assert.match(skill, /## Form structure/)
    assert.match(skill, /call describeState for\s+the live state/)
    assert.ok(skill.includes(overview))
  })

  it('should ride the subagent prompt when the option is on', async () => {
    const compiled = compile(simpleSchema)
    const layout = new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree], {}, {})
    const active = new WebMCP(layout, { dataTitle: 'doc', includeSubAgent: true, includeFormOverview: true })
    const tool = active.getTools().find((t) => t.name === 'subagent_form')
    const result = await /** @type {any} */(tool).execute({ task: 'fill it' })
    const config = JSON.parse(result.content[0].text)
    assert.match(config.prompt, /## Form structure/)
    assert.match(config.prompt, /\/contactMethod/)

    const inactive = new WebMCP(layout, { dataTitle: 'doc', includeSubAgent: true })
    const other = await /** @type {any} */(inactive.getTools().find((t) => t.name === 'subagent_form')).execute({})
    assert.ok(!JSON.parse(other.content[0].text).prompt.includes('Form structure'))
  })
})
