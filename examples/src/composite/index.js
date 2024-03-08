import section from './section.js'
import sectionParent from './section-parent.js'
import tabs from './tabs.js'
import verticalTabs from './vertical-tabs.js'
import expansionPanels from './expansion-panels.js'
import complexChildren from './complex-children.js'
import readonlyChildren from './readonly-children.js'

/** @type {import('../types.js').JSONLayoutExamplesCategory} */
const category = {
  title: 'Composite components',
  id: 'composite',
  description: 'There are a few components available to structure the layout and wrap fields : sections, tabs, etc.',
  examples: [section, sectionParent, tabs, verticalTabs, expansionPanels, complexChildren, readonlyChildren]
}

export default category
