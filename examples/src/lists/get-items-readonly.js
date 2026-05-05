/** @type {import("../types.js").JSONLayoutExample } */
const example = {
  title: 'Lists with getItems and read-only items',
  id: 'lists-get-items-readonly',
  description: 'When list items are not editable locally (`listActions` does not include `edit` and `listEditMode` is not `inline`), each `getItems` re-fetch refreshes the values for matching keys: the server is the source of truth. When items are editable, local values are kept (current behavior). Switch the "Item set" select to trigger a re-fetch and compare.',
  schema: {
    type: 'object',
    properties: {
      set: {
        type: 'string',
        title: 'Item set',
        description: 'Switch this to trigger a getItems re-fetch on both lists below.',
        enum: ['initial', 'updated'],
        default: 'initial'
      },
      arrEditable: {
        type: 'array',
        title: 'Editable items — local edits win on re-fetch',
        layout: {
          comp: 'list',
          getItems: 'parent.data.set === "initial" ? options.context.setInitial : options.context.setUpdated',
          listActions: ['edit', 'delete']
        },
        items: {
          type: 'object',
          properties: {
            key: { type: 'string', title: 'Key', readOnly: true },
            status: { type: 'string', title: 'Status' }
          }
        }
      },
      arrReadOnly: {
        type: 'array',
        title: 'Read-only items — getItems values win on every re-fetch',
        layout: {
          comp: 'list',
          getItems: 'parent.data.set === "initial" ? options.context.setInitial : options.context.setUpdated',
          listActions: ['delete']
        },
        items: {
          type: 'object',
          properties: {
            key: { type: 'string', title: 'Key', readOnly: true },
            status: { type: 'string', title: 'Status', readOnly: true }
          }
        }
      }
    }
  },
  options: {
    context: {
      setInitial: [
        { key: 'task1', status: 'pending' },
        { key: 'task2', status: 'pending' },
        { key: 'task3', status: 'pending' }
      ],
      setUpdated: [
        { key: 'task1', status: 'done' },
        { key: 'task2', status: 'in-progress' },
        { key: 'task3', status: 'pending' }
      ]
    }
  },
  data: {
    set: 'initial',
    arrEditable: [],
    arrReadOnly: []
  }
}

export default example
