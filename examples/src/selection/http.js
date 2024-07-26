/** @type {import("../types.js").JSONLayoutExample } */
const example = {
  title: 'Items from HTTP requests',
  id: 'http',
  description: 'It is also possible to fetch items from HTTP requests by defining the expression `getItems.url`.',
  schema: {
    type: 'object',
    properties: {
      fromUrl: {
        type: 'string',
        title: 'A select from a URL',
        layout: {
          getItems: {
            // eslint-disable-next-line no-template-curly-in-string
            url: 'https://koumoul.com/data-fair/api/v1/datasets?status=finalized&select=id,title&owner=${context.owner.type}:${context.owner.id}',
            itemsResults: 'data.results',
            itemTitle: 'item.title',
            itemValue: 'item.id'
          }
        }
      },
      fromUrlMultiple: {
        type: 'array',
        title: 'A select of multiple objects from a URL',
        layout: {
          getItems: {
            // eslint-disable-next-line no-template-curly-in-string
            url: 'https://koumoul.com/data-fair/api/v1/datasets?status=finalized&select=id,title&owner=${context.owner.type}:${context.owner.id}',
            itemsResults: 'data.results',
            itemTitle: 'item.title',
            itemKey: 'item.id'
          }
        },
        items: {
          type: 'object',
          properties: {
            id: {
              type: 'string'
            },
            title: {
              type: 'string'
            }
          }
        }
      },
      fromUrlWithQ: {
        type: 'object',
        title: 'A autocomplete from a URL with a query',
        layout: {
          getItems: {
            // eslint-disable-next-line no-template-curly-in-string
            url: 'https://koumoul.com/data-fair/api/v1/datasets?status=finalized&select=id,title&q={q}&owner=${context.owner.type}:${context.owner.id}',
            itemsResults: 'data.results',
            itemTitle: 'item.title',
            itemKey: 'item.id'
          }
        }
      }
    }
  },
  options: {
    context: { owner: { type: 'organization', id: '5a5dc47163ebd4a6f438589b' } }
  }
}

export default example
