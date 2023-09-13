import type { JSONLayoutExamplesCategory } from '../'
import defaultDensity from './default'
import comfortable from './comfortable'
import compact from './compact'

const category: JSONLayoutExamplesCategory = {
  title: 'Density',
  id: 'density',
  description: `Many vuetify components accept a density prop with possible values \`default\`, \`comfortable\` and \`compact\`.

Vjsf also accepts this parameter as an option. It is applied to all relevant vuetify components and is also used to modify title sizes, margins, etc.`,
  examples: [defaultDensity, comfortable, compact]
}

export default category
