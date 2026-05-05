/** @type {import("../types.js").JSONLayoutExample } */
const example = {
  title: 'Lists with getItems and sort',
  id: 'lists-get-items-sort',
  description: 'When a `list` component is filled by `getItems`, the data merge with previous content normally takes its order from the fresh `getItems` result. When `listActions` includes `sort`, the user\'s local order is preserved across re-fetches: items still present keep their position, items new in `getItems` are appended at the end, items absent are dropped. Switch the "Item set" select to trigger a re-fetch and compare the two lists side by side.',
  schema: {
    type: 'object',
    properties: {
      set: {
        type: 'string',
        title: 'Item set',
        description: 'Switch this to trigger a getItems re-fetch on both lists below.',
        enum: ['A', 'A+'],
        default: 'A'
      },
      arrUnsorted: {
        type: 'array',
        title: 'Without sort — order always comes from getItems',
        layout: {
          comp: 'list',
          getItems: 'parent.data.set === "A" ? options.context.setA : options.context.setAplus'
        },
        items: {
          type: 'object',
          properties: {
            key: { type: 'string', title: 'Key', readOnly: true },
            note: { type: 'string', title: 'Local note (editable)' }
          }
        }
      },
      arrSorted: {
        type: 'array',
        title: 'With sort — local order is preserved across re-fetches',
        layout: {
          comp: 'list',
          getItems: 'parent.data.set === "A" ? options.context.setA : options.context.setAplus',
          listActions: ['edit', 'sort']
        },
        items: {
          type: 'object',
          properties: {
            key: { type: 'string', title: 'Key', readOnly: true },
            note: { type: 'string', title: 'Local note (editable)' }
          }
        }
      }
    }
  },
  options: {
    context: {
      setA: [{ key: 'val1' }, { key: 'val2' }, { key: 'val3' }],
      setAplus: [{ key: 'val1' }, { key: 'val2' }, { key: 'val3' }, { key: 'val4' }]
    }
  },
  data: {
    set: 'A',
    arrUnsorted: [],
    arrSorted: []
  }
}

export default example
