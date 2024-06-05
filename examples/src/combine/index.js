import oneOf from './one-of.js'
import allOf from './all-of.js'
import layoutIf from './layout-if.js'
import layoutSwitch from './layout-switch.js'
import depedentSchemas from './dependent-schemas.js'
import ifThenElse from './if-then-else.js'

/** @type {import('../types.js').JSONLayoutExamplesCategory} */
const category = {
  title: 'Combinations',
  id: 'combine',
  description: 'This section contains examples of combining schemas and layout options using conditions and higher level keywords than simple properties.',
  examples: [oneOf, allOf, layoutIf, layoutSwitch, depedentSchemas, ifThenElse]
}

export default category
