import sections from './sections.js'
import sectionsParent from './sections-parent.js'
import sectionsIndented from './sections-indented.js'
import tabs from './tabs.js'
import verticalTabs from './vertical-tabs.js'
import expansionPanels from './expansion-panels.js'
import cards from './cards.js'
import complexChildren from './complex-children.js'
import readonlyChildren from './readonly-children.js'

/** @type {import('../types.js').JSONLayoutExamplesCategory} */
const category = {
  title: 'Composite components',
  id: 'composite',
  description: 'There are a few components available to structure the layout and wrap fields : sections, tabs, etc.',
  examples: [sections, sectionsParent, sectionsIndented, tabs, verticalTabs, expansionPanels, cards, complexChildren, readonlyChildren]
}

export default category
