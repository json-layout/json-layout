import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'

import { compile } from '../src/compile/index.js'
import { StatefulLayout } from '../src/state/index.js'
import { WebMCP, generateSkill } from '../src/webmcp/index.js'
import { projectStateTreeToMarkdown } from '../src/webmcp/project.js'

// The open tab of a form lived in the rendering components only. Judged simulations of a portal
// editor: the form sub-agent said a tab was open that was not, the assistant could not tell the
// person where its change showed, and people asked to see a change before saving went looking
// for it. The layout now knows which section of a tabbed container is open, the tools say it,
// and a tool's write opens the section that shows it.

const schema = {
  type: 'object',
  layout: {
    comp: 'vertical-tabs',
    children: [
      { title: 'Général', children: ['title'] },
      {
        title: 'Barre de navigation',
        comp: 'tabs',
        children: [
          { title: 'Options', children: ['navColor'] },
          { title: 'Menu', children: ['menu'] }
        ]
      }
    ]
  },
  properties: {
    title: { type: 'string', title: 'Titre' },
    navColor: { type: 'string', title: 'Couleur' },
    menu: { type: 'array', title: 'Éléments du menu', items: { type: 'object', properties: { label: { type: 'string', title: 'Libellé' } } } }
  }
}

/** @param {Record<string, any>} [options] */
const makeLayout = (options = {}) => {
  const compiled = compile(schema)
  return new StatefulLayout(compiled, compiled.skeletonTrees[compiled.mainTree], options, { title: 'Portail', navColor: 'primary', menu: [] })
}

/**
 * @param {any} layout
 * @param {string} title
 */
const section = (layout, title) => {
  /** @type {any[]} */
  const stack = [layout.stateTree.root]
  while (stack.length) {
    const node = stack.pop()
    if (node.children?.some((/** @type {any} */child) => child.layout.title === title)) return node
    stack.push(...(node.children ?? []))
  }
  throw new Error(`no section holds "${title}"`)
}

describe('open sections of tabbed containers', () => {
  it('opens the first visible section by default, and keeps a section chosen', () => {
    const calls = /** @type {any[]} */([])
    const layout = makeLayout({ onSections: (/** @type {any} */sections) => calls.push(sections) })
    const root = layout.stateTree.root
    assert.equal(layout.activeSectionIndex(root), 0)
    layout.activateSection(root, 1)
    assert.equal(layout.activeSectionIndex(root), 1)
    assert.deepEqual(calls.at(-1), { [root.fullKey]: 1 })
    // choosing the open section again is not a change
    layout.activateSection(root, 1)
    assert.equal(calls.length, 1)
  })

  it('reveals a field by opening every section that contains it', () => {
    const layout = makeLayout()
    const menuNode = section(layout, 'Menu').children[1].children[0]
    const opened = layout.revealNode(menuNode.fullKey)
    assert.deepEqual(opened, ['Barre de navigation', 'Menu'])
    assert.equal(layout.activeSectionIndex(layout.stateTree.root), 1)
    assert.equal(layout.activeSectionIndex(section(layout, 'Menu')), 1)
    // already in view: nothing to open
    assert.deepEqual(layout.revealNode(menuNode.fullKey), [])
  })

  it('calls vertical tabs tabs: where they show is the rendering\'s, not the layout\'s', () => {
    // a judged run read « vertical-tabs » and sent the person looking for a vertical list; the
    // portal editor shows them as a row of tabs above the form
    const layout = makeLayout()
    const text = projectStateTreeToMarkdown(layout.stateTree, layout)
    assert.match(text, /^- \/ \(tabs/m)
    assert.doesNotMatch(text, /vertical/)
  })

  it('says which section is open when describing the form', () => {
    const layout = makeLayout()
    let text = projectStateTreeToMarkdown(layout.stateTree, layout)
    assert.match(text, /Général.*\(open\)/)
    assert.doesNotMatch(text, /Barre de navigation.*\(open\)/)
    layout.activateSection(layout.stateTree.root, 1)
    text = projectStateTreeToMarkdown(layout.stateTree, layout)
    assert.match(text, /Barre de navigation.*\(open\)/)
    assert.match(text, /Options.*\(open\)/)
  })

  it('opens the section of a field a tool writes, and says it is now on screen', async () => {
    const layout = makeLayout()
    const webmcp = new WebMCP(layout, { dataTitle: 'portal', prefixName: 'p_' })
    const tools = webmcp.getTools()
    const setFieldValue = /** @type {any} */(tools.find(t => t.name === 'p_setFieldValue'))
    const result = await setFieldValue.execute({ path: '/navColor', value: 'secondary' })
    const text = result.content[0].text
    assert.equal(layout.activeSectionIndex(layout.stateTree.root), 1)
    assert.match(text, /now on screen: « Barre de navigation » > « Options »/)
    // a field already on screen: nothing said
    const again = await setFieldValue.execute({ path: '/navColor', value: 'primary' })
    assert.doesNotMatch(again.content[0].text, /now on screen/)
    const editArray = /** @type {any} */(tools.find(t => t.name === 'p_editArray'))
    const added = await editArray.execute({ path: '/menu', action: 'add' })
    assert.match(added.content[0].text, /now on screen: « Barre de navigation » > « Menu »/)
  })
})

describe('the tool that opens a section', () => {
  it('opens the section of a path and says what is on screen', async () => {
    const layout = makeLayout()
    const tools = new WebMCP(layout, { dataTitle: 'portal', prefixName: 'p_' }).getTools()
    const openSection = /** @type {any} */(tools.find(t => t.name === 'p_openSection'))
    assert.ok(openSection, 'an openSection tool')
    // by a section's own path, as describeState lists it
    let result = await openSection.execute({ path: '/$comp-2/$comp-2' })
    assert.match(result.content[0].text, /now on screen: « Barre de navigation » > « Menu »/)
    assert.equal(layout.activeSectionIndex(layout.stateTree.root), 1)
    // by the data path of a field
    result = await openSection.execute({ path: '/title' })
    assert.match(result.content[0].text, /now on screen: « Général »/)
    result = await openSection.execute({ path: '/title' })
    assert.match(result.content[0].text, /already on screen: « Général »/)
    // nothing to open
    result = await openSection.execute({ path: '/nope' })
    assert.equal(result.isError, true)
  })
})

describe('the guide of the form tools', () => {
  it('says how the tabs and steps on screen are told and opened', () => {
    const layout = makeLayout()
    const tools = new WebMCP(layout, { dataTitle: 'portal', prefixName: 'p_', includeFillFormSkill: true }).getTools()
    const skill = /** @type {any} */(tools.find(t => t.name === 'p_fillFormSkill'))
    return skill.execute({}).then((/** @type {any} */result) => {
      assert.match(result.content[0].text, /p_openSection/)
      assert.match(result.content[0].text, /\(open\)/)
    })
  })
})

// Judged eval runs: an agent chose a datasets catalogue for « a block with a search field »,
// saw its filters empty in the response, stopped there, and told the person a search field was
// included.
describe('the guide on what a choice sets', () => {
  it('says a chosen branch only holds its defaults, and that a report says what the data holds', () => {
    const skill = generateSkill('page', 'p_')
    assert.match(skill, /only fills its defaults/)
    assert.match(skill, /say only what the data now holds/)
  })
})
