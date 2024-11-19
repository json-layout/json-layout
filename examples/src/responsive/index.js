import simpleGrid from './simple-grid.js'
import gridParent from './grid-parent.js'
import columnsLayout from './columns-layout.js'
import switchLayout from './switch.js'

/** @type {import('../types.js').JSONLayoutExamplesCategory} */
const category = {
  title: 'Responsive grid',
  id: 'responsive',
  description: `Many elements of layouts can be made responsive to the width of the container element.
The default thresholds in pixels are \`{xs:0, sm:600, md:960, lg:1280, xl:1920, xxl:2560}\`.

A specificity of the responsivity of our layouts is that the width taken into account to apply thresholds is the width of each containers and not the width of the full window nor the width of the root container.`,
  examples: [simpleGrid, gridParent, columnsLayout, switchLayout]
}

export default category
