import standard from './standard.js'
import codeSlots from './code-slots.js'
import layoutSlots from './layout-slots.js'

/** @type {import('../types.js').JSONLayoutExamplesCategory} */
const category = {
  title: 'Slots',
  id: 'slots',
  description: `Some additional content can be injected in various places of the components tree using \`slots\`.
  
A slot can contain markdown content, simple textual content or reference some injected code by a name.

A slot is defined as an object with a single property, for example \`{"text": "a text slot"}\`,  \`{"markdown": "a **markdown** slot"}\` or  \`{"name": "named-code-slot"}\`.`,
  examples: [standard, codeSlots, layoutSlots]
}

export default category
