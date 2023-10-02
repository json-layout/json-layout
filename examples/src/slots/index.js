import standard from './standard.js'

/** @type {import('../types.js').JSONLayoutExamplesCategory} */
const category = {
  title: 'Slots',
  id: 'slots',
  description: `Some additional content can be injected in various places of the components tree using \`slots\`.
  
A slot can contain markdown content, simple textual content or reference some injected code by a name.`,
  examples: [standard]
}

export default category
