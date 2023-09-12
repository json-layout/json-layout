import type { JSONLayoutExamplesCategory } from '../'
import section from './section'
import sectionParent from './section-parent'
import tabs from './tabs'
import verticalTabs from './vertical-tabs'
import expansionPanels from './expansion-panels'
import complexChildren from './complex-children'

const category: JSONLayoutExamplesCategory = {
  title: 'Composite components',
  id: 'composite',
  description: 'There are a few components available to structure the layout and wrap fields : sections, tabs, etc.',
  examples: [section, sectionParent, tabs, verticalTabs, expansionPanels, complexChildren]
}

export default category
