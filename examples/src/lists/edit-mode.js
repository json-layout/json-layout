/** @type {import("../types.js").JSONLayoutExample } */
const example = {
  title: 'Edition modes',
  id: 'edit-mode',
  description: `The \`layout.listEditMode\` attribute can be used to control the edition mode of a list of objects.
Possible values are:
  - "inline" - all items are editable in place, items will never be in summary/readOnly state
  - "inline-single" (default) - the user must select an item for edition, this item is then editable in place
  - "dialog" - the user must select an item for edition, this is then editable in a dialog
  - "menu" - the user must select an item for edition, this is then editable in a menu
  `,
  schema: {
    type: 'object',
    properties: {
      arrInlineSingle: {
        type: 'array',
        title: 'List in "inline-single" mode',
        layout: {
          cols: 6,
          listEditMode: 'inline-single'
        },
        items: {
          $ref: '#/$defs/item'
        }
      },
      arrInline: {
        type: 'array',
        title: 'List in "inline" mode',
        layout: {
          cols: 6,
          listEditMode: 'inline'
        },
        items: {
          $ref: '#/$defs/item'
        }
      },
      arrDialog: {
        type: 'array',
        title: 'List in "dialog" mode',
        layout: {
          cols: 6,
          listEditMode: 'dialog'
        },
        items: {
          $ref: '#/$defs/item'
        }
      },
      arrMenu: {
        type: 'array',
        title: 'List in "menu" mode',
        layout: {
          cols: 6,
          listEditMode: 'menu'
        },
        items: {
          $ref: '#/$defs/item'
        }
      }
    },
    $defs: {
      item: {
        type: 'object',
        title: 'Object item',
        properties: {
          str1: { type: 'string', title: 'String 1' },
        }
      }
    }
  },
  data: {
    arrInlineSingle: [{ str1: 'a string' }],
    arrInline: [{ str1: 'a string' }],
    arrDialog: [{ str1: 'a string' }],
    arrMenu: [{ str1: 'a string' }],
  }
}

export default example
