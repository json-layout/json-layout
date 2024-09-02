/**
 * @typedef {import('./types.js').Section} Section
 * @typedef {import('./types.js').Select} Select
 * @typedef {import('./types.js').Autocomplete} Autocomplete
 * @typedef {import('./types.js').TextField} TextField
 * @typedef {import('./types.js').Textarea} Textarea
 * @typedef {import('./types.js').NumberField} NumberField
 * @typedef {import('./types.js').Slider} Slider
 * @typedef {import('./types.js').Checkbox} Checkbox
 * @typedef {import('./types.js').Switch} Switch
 * @typedef {import('./types.js').DatePicker} DatePicker
 * @typedef {import('./types.js').TimePicker} TimePicker
 * @typedef {import('./types.js').DateTimePicker} DateTimePicker
 * @typedef {import('./types.js').ColorPicker} ColorPicker
 * @typedef {import('./types.js').OneOfSelect} OneOfSelect
 * @typedef {import('./types.js').Tabs} Tabs
 * @typedef {import('./types.js').VerticalTabs} VerticalTabs
 * @typedef {import('./types.js').ExpansionPanels} ExpansionPanels
 * @typedef {import('./types.js').Stepper} Stepper
 * @typedef {import('./types.js').List} List
 * @typedef {import('./types.js').Combobox} Combobox
 * @typedef {import('./types.js').FileInput} FileInput
 * @typedef {import('./types.js').Card} Card
 */

/** @type {import('../types.js').ComponentInfo[]} */
export const standardComponents = [
  {
    name: 'none'
  },
  {
    name: 'section',
    composite: true
  },
  {
    name: 'tabs',
    composite: true
  },
  {
    name: 'vertical-tabs',
    composite: true
  },
  {
    name: 'expansion-panels',
    composite: true
  },
  {
    name: 'stepper',
    composite: true
  },
  {
    name: 'card',
    composite: true
  },
  {
    name: 'list',
    schema: {
      required: ['listEditMode', 'listActions'],
      properties: {
        title: { type: 'string' },
        listEditMode: { type: 'string', enum: ['inline', 'inline-single', 'menu', 'dialog'] },
        listActions: { type: 'array', items: { type: 'string', enum: ['add', 'edit', 'delete', 'sort', 'duplicate'] } },
        itemTitle: { $ref: 'https://json-layout.github.io/normalized-layout-keyword#/$defs/expression' },
        itemSubtitle: { $ref: 'https://json-layout.github.io/normalized-layout-keyword#/$defs/expression' },
        indexed: { type: 'array', items: { type: 'string' } },
        messages: {
          type: 'object',
          additionalProperties: false,
          properties: {
            addItem: { type: 'string' },
            delete: { type: 'string' },
            edit: { type: 'string' },
            duplicate: { type: 'string' },
            sort: { type: 'string' }
          }
        }
      }
    }
  },
  {
    name: 'text-field',
    shouldDebounce: true,
    focusable: true,
    emitsBlur: true,
    schema: {
      properties: {
        placeholder: { type: 'string' }
      }
    }
  },
  {
    name: 'textarea',
    shouldDebounce: true,
    focusable: true,
    emitsBlur: true,
    schema: {
      properties: {
        placeholder: { type: 'string' }
      }
    }
  },
  {
    name: 'number-field',
    shouldDebounce: true,
    focusable: true,
    emitsBlur: true,
    schema: {
      properties: {
        step: { type: 'number' },
        min: { type: 'number' },
        max: { type: 'number' },
        placeholder: { type: 'string' }
      }
    }
  },
  {
    name: 'checkbox'
  },
  {
    name: 'switch'
  },
  {
    name: 'slider',
    schema: {
      properties: {
        step: { type: 'number' },
        min: { type: 'number' },
        max: { type: 'number' }
      }
    }
  },
  {
    name: 'date-picker',
    schema: {
      properties: {
        min: { type: 'string', format: 'date' },
        max: { type: 'string', format: 'date' },
        format: { type: 'string', enum: ['date', 'date-time'], default: 'date' }
      }
    }
  },
  {
    name: 'date-time-picker',
    schema: {
      properties: {
        min: { type: 'string', format: 'date-time' },
        max: { type: 'string', format: 'date-time' }
      }
    }
  },
  {
    name: 'time-picker',
    schema: {
      properties: {
        min: { type: 'string', format: 'time' },
        max: { type: 'string', format: 'time' }
      }
    }
  },
  {
    name: 'color-picker'
  },
  {
    name: 'select',
    focusable: true,
    itemsBased: true,
    multipleCompat: true
  },
  {
    name: 'autocomplete',
    focusable: true,
    itemsBased: true,
    multipleCompat: true
  },
  {
    name: 'combobox',
    focusable: true,
    itemsBased: true,
    multipleCompat: true
  },
  {
    name: 'number-combobox',
    focusable: true,
    itemsBased: true,
    multipleCompat: true,
    schema: {
      properties: {
        step: { type: 'number' },
        min: { type: 'number' },
        max: { type: 'number' }
      }
    }
  },
  {
    name: 'checkbox-group',
    itemsBased: true,
    multipleCompat: true
  },
  {
    name: 'switch-group',
    itemsBased: true,
    multipleCompat: true
  },
  {
    name: 'radio-group',
    itemsBased: true
  },
  {
    name: 'file-input',
    focusable: true,
    multipleCompat: true,
    schema: {
      properties: {
        accept: { type: 'string' },
        placeholder: { type: 'string' }
      }
    }
  },
  {
    name: 'one-of-select',
    schema: {
      properties: {
        emptyData: { type: 'boolean' }
      }
    }
  }
]

/**
 * @param {import('../types.js').ComponentInfo} component
 * @returns {any}
 */
export function getComponentSchema (component) {
  /** @type {any} */
  const schema = {
    type: 'object',
    title: component.name,
    $id: `https://json-layout.github.io/component/${component.name}#`,
    unevaluatedProperties: false,
    allOf: [
      { properties: { comp: { const: component.name } } },
      { $ref: 'https://json-layout.github.io/normalized-layout-keyword#/$defs/base-comp-object' }
    ]
  }
  if (component.composite) {
    schema.allOf.push({ $ref: 'https://json-layout.github.io/normalized-layout-keyword#/$defs/composite-comp-object' })
  } else {
    schema.allOf.push({ $ref: 'https://json-layout.github.io/normalized-layout-keyword#/$defs/simple-comp-object' })
  }
  if (component.focusable) {
    schema.allOf.push({ $ref: 'https://json-layout.github.io/normalized-layout-keyword#/$defs/focusable-comp-object' })
  }
  if (component.itemsBased) {
    schema.allOf.push({ $ref: 'https://json-layout.github.io/normalized-layout-keyword#/$defs/items-based-comp-object' })
  }
  if (component.multipleCompat) {
    schema.allOf.push({ $ref: 'https://json-layout.github.io/normalized-layout-keyword#/$defs/multiple-compat-comp-object' })
  }
  if (component.schema) {
    schema.allOf.push(component.schema)
  }
  return schema
}
