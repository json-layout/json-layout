import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { normalizeLayoutFragment as normalize, standardComponents } from '../src/index.js'

const components = standardComponents.reduce((acc, component) => {
  acc[component.name] = component
  return acc
}, /** @type {Record<string, import('@json-layout/vocabulary').ComponentInfo>} */({}))

describe('normalize schema fragment function', () => {
  const defaultTextFieldComp = { comp: 'text-field', label: 'prop' }
  const defaultTextareaComp = { comp: 'textarea', label: 'prop' }

  it('should transform schema fragments with optional layout keywords in normalized layout information', () => {
    assert.deepEqual(normalize({ type: 'string' }, '/prop', components).layout, defaultTextFieldComp)
    assert.deepEqual(normalize({ type: 'string', layout: 'textarea' }, '/prop', components).layout, defaultTextareaComp)
  })

  it('reject an unknown component', () => {
    const normalized = normalize({ type: 'string', layout: 'unknown' }, '/prop', components)
    assert.deepEqual(normalized.layout, defaultTextFieldComp)
    assert.equal(normalized.errors.length, 2)
  })

  it('should manage a layout expressed as a switch', () => {
    assert.deepEqual(
      normalize({ type: 'string', layout: { switch: [{ if: 'read', comp: 'text-field' }, { if: 'write', comp: 'textarea' }] } }, '/prop', components).layout,
      {
        switch: [
          { ...defaultTextFieldComp, if: { type: 'js-eval', expr: 'read', pure: true, dataAlias: 'value' } },
          { ...defaultTextareaComp, if: { type: 'js-eval', expr: 'write', pure: true, dataAlias: 'value' } },
          { ...defaultTextFieldComp }
        ]
      }
    )
  })

  it('should calculate a label for a field', () => {
    assert.deepEqual(normalize({ type: 'string' }, '/prop', components).layout, { comp: 'text-field', label: 'prop' })
    assert.deepEqual(normalize({ type: 'string', title: 'Prop' }, '/prop', components).layout, { comp: 'text-field', label: 'Prop' })
    assert.deepEqual(normalize({ type: 'string', title: 'Prop', layout: { label: 'Prop label' } }, '/prop', components).layout, { comp: 'text-field', label: 'Prop label' })
    assert.deepEqual(normalize({ type: 'object', title: 'Prop', layout: { comp: 'select', items: [{ key: '1' }] } }, '/prop', components).layout, { comp: 'select', label: 'Prop', items: [{ key: '1', value: '1', title: '1' }] })
  })

  it('should handle number types', () => {
    assert.deepEqual(normalize({ type: 'number' }, '/prop', components).layout, { comp: 'number-field', label: 'prop' })
    assert.deepEqual(normalize({ type: 'number', layout: { step: 0.1 } }, '/prop', components).layout, { comp: 'number-field', label: 'prop', step: 0.1 })
    assert.deepEqual(normalize({ type: 'integer' }, '/prop', components).layout, { comp: 'number-field', label: 'prop', step: 1 })
  })

  it('should accept layout as a string', () => {
    assert.deepEqual(normalize({ type: 'object', layout: 'file-input' }, '/prop', components).layout, { comp: 'file-input', label: 'prop' })
    assert.deepEqual(normalize({ type: 'array', layout: 'file-input' }, '/prop', components).layout, { comp: 'file-input', label: 'prop', multiple: true })
  })

  it('should handle "none" display', () => {
    assert.deepEqual(normalize({ type: 'number', layout: 'none' }, '/prop', components).layout, { comp: 'none' })
  })

  it('should manage children array', () => {
    assert.deepEqual(
      normalize({ type: 'object', properties: { nb1: { type: 'number' }, nb2: { type: 'number' } } }, '/prop', components).layout,
      { comp: 'section', title: null, children: [{ key: 'nb1' }, { key: 'nb2' }] }
    )
    assert.deepEqual(
      normalize({ layout: ['nb1'], type: 'object', properties: { nb1: { type: 'number' }, nb2: { type: 'number' } } }, '/prop', components).layout,
      { comp: 'section', title: null, children: [{ key: 'nb1' }] }
    )
  })

  it('should accept wrapper composite children', () => {
    /** @type {import('../src/index.js').LayoutKeyword} */
    const layout = [{ comp: 'section', title: 'Sec 1', children: ['nb1'] }, { comp: 'section', title: 'Sec 2', children: ['nb2'] }]
    assert.deepEqual(
      normalize({
        layout,
        type: 'object',
        properties: { nb1: { type: 'number' }, nb2: { type: 'number' } }
      }, '/prop', components).layout,
      {
        comp: 'section',
        title: null,
        children: [
          { key: '$comp-0', comp: 'section', title: 'Sec 1', children: [{ key: 'nb1' }] },
          { key: '$comp-1', comp: 'section', title: 'Sec 2', children: [{ key: 'nb2' }] }
        ]
      }
    )
  })

  it('should manage select on enums and oneOf', () => {
    assert.deepEqual(
      normalize({ type: 'string', enum: ['val1', 'val2'] }, '/prop', components).layout,
      {
        comp: 'select',
        label: 'prop',
        getItems: { type: 'js-eval', expr: JSON.stringify([{ key: 'val1', title: 'val1', value: 'val1' }, { key: 'val2', title: 'val2', value: 'val2' }]), pure: true, immutable: true, dataAlias: 'value' }
      }
    )

    assert.deepEqual(
      normalize({ type: 'string', oneOf: [{ const: 'val1', title: 'Val 1' }, { const: 'val2' }] }, '/prop', components).layout,
      {
        comp: 'select',
        label: 'prop',
        getItems: { type: 'js-eval', expr: JSON.stringify([{ const: 'val1', title: 'Val 1', key: 'val1', value: 'val1' }, { const: 'val2', key: 'val2', title: 'val2', value: 'val2' }]), pure: true, immutable: true, dataAlias: 'value' }
      }
    )

    assert.deepEqual(
      normalize({ type: 'string', layout: { items: [{ value: 'val1', title: 'Val 1' }, 'val2'] } }, '/prop', components).layout,
      { comp: 'select', label: 'prop', items: [{ key: 'val1', title: 'Val 1', value: 'val1' }, { key: 'val2', title: 'val2', value: 'val2' }] }
    )
  })

  it('should manage select with getItems', () => {
    assert.deepEqual(
      normalize({ type: 'string', layout: { getItems: 'context.items' } }, '/prop', components).layout,
      { comp: 'select', label: 'prop', getItems: { expr: 'context.items', type: 'js-eval', pure: true, dataAlias: 'value' } }
    )
  })

  it('should manage select with getItems from URL', () => {
    assert.deepEqual(
      normalize({ type: 'string', layout: { getItems: { url: 'http://test.com/${parent.data.path}' } } }, '/prop', components).layout,
      { comp: 'select', label: 'prop', getItems: { url: { expr: 'http://test.com/${parent.data.path}', type: 'js-tpl', pure: false, dataAlias: 'value' } } }
    )
  })

  it('should manage select on arrays with enums and oneOf', () => {
    assert.deepEqual(
      normalize({ type: 'array', items: { type: 'string', enum: ['val1', 'val2'] } }, '/prop', components).layout,
      {
        comp: 'select',
        label: 'prop',
        multiple: true,
        getItems: { type: 'js-eval', expr: JSON.stringify([{ key: 'val1', title: 'val1', value: 'val1' }, { key: 'val2', title: 'val2', value: 'val2' }]), pure: true, immutable: true, dataAlias: 'value' }
      }
    )
  })

  it('should manage a select of subtypes based on a oneOf', () => {
    /** @type {any} */
    const schema = {
      type: 'object',
      title: 'Subtypes section',
      description: 'A section with subtypes',
      oneOf: [{
        key: { type: 'string', const: 'val1', title: 'Key' },
        str1: { type: 'string' }
      }, {
        key: { type: 'string', const: 'val2' },
        str2: { type: 'string' }
      }]
    }
    assert.deepEqual(
      normalize(schema, '/prop', components).layout,
      {
        comp: 'section',
        title: 'Subtypes section',
        subtitle: 'A section with subtypes',
        children: [{ key: '$oneOf' }]
      }
    )
    assert.deepEqual(
      normalize(schema, '/prop', components, undefined, undefined, 'oneOf').layout,
      {
        comp: 'one-of-select'
      }
    )
    schema.oneOfLayout = { label: 'Select a subtype' }
    assert.deepEqual(
      normalize(schema, '/prop', components, undefined, undefined, 'oneOf').layout,
      {
        comp: 'one-of-select',
        label: 'Select a subtype'
      }
    )
  })

  it('should manage combobox with examples on simple types', () => {
    assert.deepEqual(
      normalize({ type: 'string', examples: ['val1', 'val2'] }, '/prop', components).layout,
      { comp: 'combobox', label: 'prop', getItems: { type: 'js-eval', expr: '[{"key":"val1","title":"val1","value":"val1"},{"key":"val2","title":"val2","value":"val2"}]', pure: true, immutable: true, dataAlias: 'value' } }
    )
  })

  it('should manage combobox with open-ended anyOf on simple types', () => {
    assert.deepEqual(
      normalize({
        type: 'string',
        anyOf: [
          {
            const: 'value1',
            title: 'Value 1'
          },
          {
            const: 'value2',
            title: 'Value 2'
          },
          {}
        ]
      }, '/prop', components).layout,
      { comp: 'combobox', label: 'prop', getItems: { type: 'js-eval', expr: '[{"const":"value1","title":"Value 1","key":"value1","value":"value1"},{"const":"value2","title":"Value 2","key":"value2","value":"value2"}]', pure: true, immutable: true, dataAlias: 'value' } }
    )
  })

  it('should accept lib specific props, slots and options', () => {
    assert.deepEqual(
      normalize({ type: 'string', layout: { props: { prop1: 'Prop 1' }, slots: { before: 'Before **slot**', component: 'slot-comp' }, options: { opt1: 'Opt 1' }, opt2: 'Opt 2' } }, '/prop', components, (str) => `markdown: ${str}`, ['opt1', 'opt2']).layout,
      {
        comp: 'text-field',
        label: 'prop',
        props: { prop1: 'Prop 1' },
        slots: {
          before: { markdown: 'markdown: Before **slot**' },
          component: { name: 'slot-comp' }
        },
        options: { opt1: 'Opt 1', opt2: 'Opt 2' }
      }
    )
  })

  it('should manage nullable', () => {
    assert.deepEqual(
      normalize({ type: 'string', layout: { getItems: 'context.items' } }, '/prop', components).layout,
      { comp: 'select', label: 'prop', getItems: { expr: 'context.items', type: 'js-eval', pure: true, dataAlias: 'value' } }
    )
  })

  it('should manage tabs layout', () => {
    assert.deepEqual(
      normalize({ type: 'object', layout: { comp: 'tabs', children: [{ title: 'Tab 1', children: ['str1'] }, { title: 'Tab 2', children: ['str2'] }] }, properties: { str1: { type: 'string' }, str2: { type: 'string' } } }, '/prop', components).layout,
      { comp: 'tabs', title: null, children: [{ comp: 'section', key: '$comp-0', title: 'Tab 1', children: [{ key: 'str1' }] }, { comp: 'section', key: '$comp-1', title: 'Tab 2', children: [{ key: 'str2' }] }] }
    )
  })

  it('should accept titles and subtitles for sections', () => {
    assert.deepEqual(
      normalize({ type: 'object', title: 'Title', layout: { subtitle: 'A subtitle' }, properties: {} }, '/prop', components).layout,
      { comp: 'section', title: 'Title', subtitle: 'A subtitle', children: [] }
    )
    assert.deepEqual(
      normalize({ type: 'object', layout: { title: 'Title' }, properties: {} }, '/prop', components).layout,
      { comp: 'section', title: 'Title', children: [] }
    )
    assert.deepEqual(
      normalize({ type: 'object', title: 'Title', layout: { title: null }, properties: {} }, '/prop', components).layout,
      { comp: 'section', title: null, children: [] }
    )
  })

  it('should manage a list of pattern properties', () => {
    /** @type {any} */
    const schema = {
      type: 'object',
      title: 'Pattern properties section',
      patternProperties: {
        '.*': {
          type: 'string'
        }
      }
    }
    assert.deepEqual(
      normalize(schema, '/prop', components).layout,
      {
        comp: 'section',
        title: 'Pattern properties section',
        children: [{ key: '$patternProperties' }]
      }
    )
    assert.deepEqual(
      normalize(schema, '/prop', components, undefined, undefined, 'patternProperties').layout,
      {
        comp: 'list',
        listActions: [
          'add',
          'edit',
          'delete',
          'duplicate',
          'sort'
        ],
        listEditMode: 'inline-single'
      }
    )
    schema.patternPropertiesLayout = { title: 'Add a pattern property' }
    assert.deepEqual(
      normalize(schema, '/prop', components, undefined, undefined, 'patternProperties').layout,
      {
        comp: 'list',
        title: 'Add a pattern property',
        listActions: [
          'add',
          'edit',
          'delete',
          'duplicate',
          'sort'
        ],
        listEditMode: 'inline-single'
      }
    )
    assert.deepEqual(
      normalize(schema, '/prop', components, undefined, undefined, 'patternPropertiesKey').layout,
      {
        comp: 'text-field'
      }
    )
    schema.patternPropertiesKeyLayout = { label: 'Name' }
    assert.deepEqual(
      normalize(schema, '/prop', components, undefined, undefined, 'patternPropertiesKey').layout,
      {
        comp: 'text-field',
        label: 'Name'
      }
    )
  })
})
