/** @type {import("../types.js").JSONLayoutExample } */
const example = {
  title: 'Cards',
  id: 'cards',
  description: 'An object can be rendered as a card using `layout: {comp: \'tabs\'}` or the shorter `layout: \'tabs\'.',
  schema: {
    type: 'object',
    title: 'Cards',
    properties: {
      card1: {
        layout: 'card',
        type: 'object',
        title: 'Card1',
        properties: {
          str1: {
            type: 'string',
            title: 'String 1'
          },
          str2: {
            type: 'string',
            title: 'String 2'
          }
        }
      },
      card2: {
        layout: 'card',
        type: 'object',
        title: 'Card 2',
        properties: {
          str3: {
            type: 'string',
            title: 'String 1'
          }
        }
      }
    }
  }
}

export default example
