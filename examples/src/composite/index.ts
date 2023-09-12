import type { JSONLayoutExamplesCategory } from '../'
import section from './section'
import sectionParent from './section-parent'

const category: JSONLayoutExamplesCategory = {
  title: 'Composite components',
  id: 'composite',
  description: 'There are a few components available to structure the layout and wrap fields : sections, tabs, etc.',
  examples: [section, sectionParent]
}

export default category
