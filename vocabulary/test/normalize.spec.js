import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { normalizeLayoutFragment as normalize } from '../src/index.js'

describe('normalize schema fragment function', () => {
  const defaultTextFieldComp = { comp: 'text-field', label: 'prop' }
  const defaultTextareaComp = { comp: 'textarea', label: 'prop' }

  it('should transform schema fragments with optional layout keywords in normalized layout information', () => {
    assert.deepEqual(normalize({ type: 'string' }, '/prop').layout, defaultTextFieldComp)
    assert.deepEqual(normalize({ type: 'string', layout: 'textarea' }, '/prop').layout, defaultTextareaComp)
  })

  it('should manage a layout expressed as a switch', () => {
    assert.deepEqual(
      normalize({ type: 'string', layout: { switch: [{ if: 'read', comp: 'text-field' }, { if: 'write', comp: 'textarea' }] } }, '/prop').layout,
      {
        switch: [
          { ...defaultTextFieldComp, if: { type: 'js-eval', expr: 'read', pure: true } },
          { ...defaultTextareaComp, if: { type: 'js-eval', expr: 'write', pure: true } },
          { ...defaultTextFieldComp }
        ]
      }
    )
  })

  it('should calculate a label for a field', () => {
    assert.deepEqual(normalize({ type: 'string' }, '/prop').layout, { comp: 'text-field', label: 'prop' })
    assert.deepEqual(normalize({ type: 'string', title: 'Prop' }, '/prop').layout, { comp: 'text-field', label: 'Prop' })
    assert.deepEqual(normalize({ type: 'string', title: 'Prop', layout: { label: 'Prop label' } }, '/prop').layout, { comp: 'text-field', label: 'Prop label' })
    assert.deepEqual(normalize({ type: 'object', title: 'Prop', layout: { comp: 'select', items: [{ key: '1' }] } }, '/prop').layout, { comp: 'select', label: 'Prop', items: [{ key: '1', value: '1', title: '1' }] })
  })

  it('should handle number types', () => {
    assert.deepEqual(normalize({ type: 'number' }, '/prop').layout, { comp: 'number-field', label: 'prop' })
    assert.deepEqual(normalize({ type: 'number', layout: { step: 0.1 } }, '/prop').layout, { comp: 'number-field', label: 'prop', step: 0.1 })
    assert.deepEqual(normalize({ type: 'integer' }, '/prop').layout, { comp: 'number-field', label: 'prop', step: 1 })
  })

  it('should handle "none" display', () => {
    assert.deepEqual(normalize({ type: 'number', layout: 'none' }, '/prop').layout, { comp: 'none' })
  })

  it('should manage children array', () => {
    assert.deepEqual(
      normalize({ type: 'object', properties: { nb1: { type: 'number' }, nb2: { type: 'number' } } }, '/prop').layout,
      { comp: 'section', title: null, children: [{ key: 'nb1' }, { key: 'nb2' }] }
    )
    assert.deepEqual(
      normalize({ layout: ['nb1'], type: 'object', properties: { nb1: { type: 'number' }, nb2: { type: 'number' } } }, '/prop').layout,
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
      }, '/prop').layout,
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
      normalize({ type: 'string', enum: ['val1', 'val2'] }, '/prop').layout,
      {
        comp: 'select',
        label: 'prop',
        getItems: { type: 'js-eval', expr: JSON.stringify([{ key: 'val1', title: 'val1', value: 'val1' }, { key: 'val2', title: 'val2', value: 'val2' }]), pure: true }
      }
    )

    assert.deepEqual(
      normalize({ type: 'string', oneOf: [{ const: 'val1', title: 'Val 1' }, { const: 'val2' }] }, '/prop').layout,
      {
        comp: 'select',
        label: 'prop',
        getItems: { type: 'js-eval', expr: JSON.stringify([{ const: 'val1', title: 'Val 1', key: 'val1', value: 'val1' }, { const: 'val2', key: 'val2', title: 'val2', value: 'val2' }]), pure: true }
      }
    )

    assert.deepEqual(
      normalize({ type: 'string', layout: { items: [{ value: 'val1', title: 'Val 1' }, 'val2'] } }, '/prop').layout,
      { comp: 'select', label: 'prop', items: [{ key: 'val1', title: 'Val 1', value: 'val1' }, { key: 'val2', title: 'val2', value: 'val2' }] }
    )
  })

  it('should manage select with getItems', () => {
    assert.deepEqual(
      normalize({ type: 'string', layout: { getItems: 'context.items' } }, '/prop').layout,
      { comp: 'select', label: 'prop', getItems: { expr: 'context.items', type: 'js-eval', pure: true } }
    )
  })

  it('should manage select on arrays with enums and oneOf', () => {
    assert.deepEqual(
      normalize({ type: 'array', items: { type: 'string', enum: ['val1', 'val2'] } }, '/prop').layout,
      {
        comp: 'select',
        label: 'prop',
        multiple: true,
        getItems: { type: 'js-eval', expr: JSON.stringify([{ key: 'val1', title: 'val1', value: 'val1' }, { key: 'val2', title: 'val2', value: 'val2' }]), pure: true }
      }
    )
  })

  it('should manage combobox with examples on simple types', () => {
    assert.deepEqual(
      normalize({ type: 'string', examples: ['val1', 'val2'] }, '/prop').layout,
      { comp: 'combobox', label: 'prop', getItems: { type: 'js-eval', expr: '[{"key":"val1","title":"val1","value":"val1"},{"key":"val2","title":"val2","value":"val2"}]', pure: true } }
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
      }, '/prop').layout,
      { comp: 'combobox', label: 'prop', getItems: { type: 'js-eval', expr: '[{"const":"value1","title":"Value 1","key":"value1","value":"value1"},{"const":"value2","title":"Value 2","key":"value2","value":"value2"}]', pure: true } }
    )
  })

  it('should accept lib specific props, slots and options', () => {
    assert.deepEqual(
      normalize({ type: 'string', layout: { props: { prop1: 'Prop 1' }, slots: { before: 'Before **slot**', component: 'slot-comp' }, options: { opt1: 'Opt 1' } } }, '/prop', (str) => `markdown: ${str}`).layout,
      {
        comp: 'text-field',
        label: 'prop',
        props: { prop1: 'Prop 1' },
        slots: {
          before: { markdown: 'markdown: Before **slot**' },
          component: { name: 'slot-comp' }
        },
        options: { opt1: 'Opt 1' }
      }
    )
  })

  it('should manage nullable', () => {
    assert.deepEqual(
      normalize({ type: 'string', layout: { getItems: 'context.items' } }, '/prop').layout,
      { comp: 'select', label: 'prop', getItems: { expr: 'context.items', type: 'js-eval', pure: true } }
    )
  })

  it('should manage tabs layout', () => {
    assert.deepEqual(
      normalize({ type: 'object', layout: { comp: 'tabs', children: [{ title: 'Tab 1', children: ['str1'] }, { title: 'Tab 2', children: ['str2'] }] }, properties: { str1: { type: 'string' }, str2: { type: 'string' } } }, '/prop').layout,
      { comp: 'tabs', title: null, children: [{ comp: 'section', key: '$comp-0', title: 'Tab 1', children: [{ key: 'str1' }] }, { comp: 'section', key: '$comp-1', title: 'Tab 2', children: [{ key: 'str2' }] }] }
    )
  })

  it('should accept titles and subtitles for sections', () => {
    assert.deepEqual(
      normalize({ type: 'object', title: 'Title', layout: { subtitle: 'A subtitle' }, properties: {} }, '/prop').layout,
      { comp: 'section', title: 'Title', subtitle: 'A subtitle', children: [] }
    )
    assert.deepEqual(
      normalize({ type: 'object', layout: { title: 'Title' }, properties: {} }, '/prop').layout,
      { comp: 'section', title: 'Title', children: [] }
    )
    assert.deepEqual(
      normalize({ type: 'object', title: 'Title', layout: { title: null }, properties: {} }, '/prop').layout,
      { comp: 'section', title: null, children: [] }
    )
  })
})
