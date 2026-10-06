import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'

import { compile } from '../src/compile/index.js'
import { StatefulLayout } from '../src/state/index.js'
import { WebMCP } from '../src/webmcp/index.js'
import { describeFormSchema } from '../src/webmcp/form-schema.js'

/**
 * @param {object} schema
 * @param {import('../src/compile/index.js').PartialCompileOptions} [options]
 * @returns {string}
 */
function overviewOf (schema, options) {
  return describeFormSchema(compile(schema, options))
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

describe('what a form can hold, whatever its state', () => {
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
    const small = describeFormSchema(compile(simpleSchema), { maxLength: 60 })
    assert.match(small, /truncated at 60 characters — call describeState with the path of a part/)
  })
})

// Judged simulations of a portal editor: asked which menu link type to choose, the form
// sub-agent could only read the type already chosen — describeState on another option answered
// « node not found » five times in a row — and the assistant guessed the options and their
// fields. describeState now also says what the form can hold beyond its state: the fields each
// option of a choice brings, and what an option not chosen or an item not added would hold.
const menuSchema = {
  type: 'object',
  layout: { comp: 'tabs', children: [{ title: 'Général', children: ['title'] }, { title: 'Navigation', children: ['menu'] }] },
  properties: {
    title: { type: 'string', title: 'Titre' },
    menu: {
      type: 'array',
      title: 'Éléments du menu',
      items: {
        type: 'object',
        oneOfLayout: { label: 'Type de lien' },
        discriminator: { propertyName: 'type' },
        oneOf: [
          { title: 'Page standard', required: ['type', 'subtype'], properties: { type: { const: 'standard' }, subtype: { type: 'string', title: 'Type de page', oneOf: [{ const: 'home', title: 'Accueil' }, { const: 'event-catalog', title: "Catalogue d'événements" }] }, title: { type: 'string', title: 'Libellé' } } },
          { title: 'Page libre', required: ['type', 'pageRef'], properties: { type: { const: 'generic' }, pageRef: { type: 'string', title: 'Page' }, title: { type: 'string', title: 'Libellé' } } },
          { title: 'Lien', required: ['type', 'href'], properties: { type: { const: 'external' }, href: { type: 'string', title: 'URL' } } }
        ]
      }
    }
  }
}

const menuTools = (/** @type {any} */data) => {
  const compiled = compile(menuSchema)
  const layout = new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree], {}, data)
  return new WebMCP(layout, { dataTitle: 'portal', prefixName: 'p_' }).getTools()
}

/**
 * @param {any[]} tools
 * @param {string} name
 * @param {any} args
 */
const call = async (tools, name, args) => (await tools.find(t => t.name === name).execute(args)).content[0].text

describe('a form too large for the budget', () => {
  it('is shown shallower, whole, rather than cut in the middle', () => {
    const big = { type: 'object', properties: /** @type {Record<string, any>} */({}) }
    for (let i = 0; i < 30; i++) {
      big.properties[`part${i}`] = { type: 'object', title: `Part ${i}`, properties: { a: { type: 'object', properties: { b: { type: 'string', title: 'A field with a rather long label' }, c: { type: 'string' } } } } }
    }
    const text = describeFormSchema(compile(big), { maxLength: 2500 })
    assert.match(text, /\/part0 /)
    assert.match(text, /\/part29 /, 'the last part is still listed')
    assert.doesNotMatch(text, /truncated/)
    assert.match(text, /describeState/, 'it says how to see a part in full')
  })
})

describe('what describeState says the form can hold', () => {
  it('has no separate tool for it', () => {
    const tools = menuTools({ title: 'Portail', menu: [] })
    assert.ok(!tools.some(tool => tool.name === 'p_describeSchema'))
  })

  it('lists each option of a choice with the fields it brings, and the values of a short choice', async () => {
    const text = await call(menuTools({ title: 'Portail', menu: [{ type: 'standard', subtype: 'home' }] }), 'p_describeState', {})
    assert.match(text, /variant 1: Page libre.* — \{ pageRef\*: text, title: text \}/)
    // the values a person picks from, so that « a catalogue of events » can be named before choosing
    assert.match(text, /variant 0: Page standard.* — \{ subtype\*: select \["home" \(Accueil\), "event-catalog" \(Catalogue d'événements\)\]/)
  })

  it('describes an item of a list still empty', async () => {
    const text = await call(menuTools({ title: 'Portail', menu: [] }), 'p_describeState', { path: '/menu/0' })
    assert.match(text, /not in the form yet/)
    assert.match(text, /variant 2: Lien — \{ href\*: text \}/)
  })

  it('details one option of a list item that does not exist yet', async () => {
    const text = await call(menuTools({ title: 'Portail', menu: [] }), 'p_describeState', { path: '/menu/0/$oneOf/0' })
    assert.match(text, /\/menu\/0\/subtype \(select, required, values=.*\) label="Type de page"/)
    // every value of the choice, with the label a person sees: the one asked for must not hide
    // in a « +6 more »
    assert.match(text, /"event-catalog" \(Catalogue d'événements\)/)
    assert.match(text, /\/menu\/0\/title \(text\) label="Libellé"/)
  })

  it('details an option that is not the one chosen', async () => {
    const text = await call(menuTools({ title: 'Portail', menu: [{ type: 'standard', subtype: 'home' }] }), 'p_describeState', { path: '/menu/0/$oneOf/1' })
    assert.match(text, /not in the form yet/)
    assert.match(text, /\/menu\/0\/pageRef \(text, required\) label="Page"/)
  })

  it('lists the fields of each option where a choice appears after a write', async () => {
    // judged eval runs: the options of a menu entry added by editArray were listed by title
    // only, and the agent chose « Page d'événements » (one event) for an agenda of all events
    const tools = menuTools({ title: 'Portail', menu: [] })
    const added = await call(tools, 'p_editArray', { path: '/menu', action: 'add' })
    assert.match(added, /variant 1: Page libre.* — \{ pageRef\*: text, title: text \}/)
  })

  it('tells the values of a choice of up to 16 in an option\'s fields', () => {
    const subtypes = Array.from({ length: 14 }, (_, i) => ({ const: `t${i}`, title: `Type ${i}` }))
    const schema = {
      type: 'object',
      properties: {
        item: {
          type: 'object',
          oneOf: [
            { title: 'Standard', properties: { type: { const: 'standard' }, subtype: { type: 'string', oneOf: subtypes } } },
            { title: 'Other', properties: { type: { const: 'other' } } }
          ]
        }
      }
    }
    const text = overviewOf(schema)
    assert.match(text, /variant 0: Standard — \{ .*subtype: select \["t0" \(Type 0\), .*"t13" \(Type 13\)\]/)
  })

  it('refuses to add an item whose type is none of the options, and names them', async () => {
    // judged portal runs: the sub-agent added menu rows as { type: 'free' } and
    // { type: 'free-page' }, left an item in error and an incomplete form, then chose the option
    const compiled = compile(menuSchema)
    const layout = new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree], {}, { title: 'Portail', menu: [] })
    const tools = new WebMCP(layout, { dataTitle: 'portal', prefixName: 'p_' }).getTools()
    const editArray = /** @type {any} */(tools.find(t => t.name === 'p_editArray'))
    const refused = await editArray.execute({ path: '/menu', action: 'add', value: { type: 'free' } })
    assert.equal(refused.isError, true)
    assert.match(refused.content[0].text, /"standard", "generic", "external"/)
    assert.equal((/** @type {any} */(layout.data).menu ?? []).length, 0, 'nothing added')
    // a known type is still accepted
    const added = await editArray.execute({ path: '/menu', action: 'add', value: { type: 'generic' } })
    assert.ok(!added.isError)
    assert.equal(/** @type {any} */(layout.data).menu[0].type, 'generic')
  })

  it('names describeState, never a tool that is not there, in the guide and the errors', async () => {
    const compiled = compile(menuSchema)
    const layout = new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree], {}, { title: 'Portail', menu: [] })
    const tools = new WebMCP(layout, { dataTitle: 'portal', prefixName: 'p_', includeSubAgent: true }).getTools()
    const { prompt } = JSON.parse((await /** @type {any} */(tools.find(tool => tool.name === 'subagent_p_form')).execute({ task: 'x' })).content[0].text)
    assert.match(prompt, /describeState on a branch not chosen/)
    assert.doesNotMatch(prompt, /describeSchema/)
    const error = await call(tools, 'p_setFieldValue', { path: '/nope', value: 1 })
    assert.match(error, /node not found/)
    assert.doesNotMatch(error, /describeSchema/)
  })
})
