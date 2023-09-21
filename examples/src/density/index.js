import defaultDensity from './default.js'
import comfortable from './comfortable.js'
import compact from './compact.js'

/** @type {import('../types.js').JSONLayoutExamplesCategory} */
const category = {
  title: 'Density',
  id: 'density',
  description: `Many vuetify components accept a density prop with possible values \`default\`, \`comfortable\` and \`compact\`.

Vjsf also accepts this parameter as an option. It is applied to all relevant vuetify components and is also used to modify title sizes, margins, etc.`,
  examples: [defaultDensity, comfortable, compact]
}

export default category
