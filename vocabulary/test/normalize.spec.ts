import { strict as assert } from 'assert'
import { normalizeLayoutFragment as normalize } from '../src/normalize'
import { type PartialChildren } from '../src'

describe('normalize schema fragment function', () => {
  const defaultTextFieldComp = { comp: 'text-field', label: 'prop' }
  const defaultTextareaComp = { comp: 'textarea', label: 'prop' }

  it('should transform schema fragments with optional layout keywords in normalized layout information', () => {
    assert.deepEqual(normalize({ type: 'string' }, '/prop'), defaultTextFieldComp)
    assert.deepEqual(normalize({ type: 'string', layout: 'textarea' }, '/prop'), defaultTextareaComp)
  })

  it('should manage a layout expressed as a switch', () => {
    assert.deepEqual(
      normalize({ type: 'string', layout: { switch: [{ if: 'read', comp: 'text-field' }, { if: 'write', comp: 'textarea' }] } }, '/prop'),
      { switch: [{ ...defaultTextFieldComp, if: { type: 'expr-eval', expr: 'read' } }, { ...defaultTextareaComp, if: { type: 'expr-eval', expr: 'write' } }] }
    )
  })

  it('should calculate a label for a field', () => {
    assert.deepEqual(normalize({ type: 'string' }, '/prop'), { comp: 'text-field', label: 'prop' })
    assert.deepEqual(normalize({ type: 'string', title: 'Prop' }, '/prop'), { comp: 'text-field', label: 'Prop' })
    assert.deepEqual(normalize({ type: 'string', title: 'Prop', layout: { label: 'Prop label' } }, '/prop'), { comp: 'text-field', label: 'Prop label' })
  })

  it('should handle number types', () => {
    assert.deepEqual(normalize({ type: 'number' }, '/prop'), { comp: 'number-field', label: 'prop' })
    assert.deepEqual(normalize({ type: 'number', layout: { step: 0.1 } }, '/prop'), { comp: 'number-field', label: 'prop', step: 0.1 })
    assert.deepEqual(normalize({ type: 'integer' }, '/prop'), { comp: 'number-field', label: 'prop', step: 1 })
  })

  it('should handle "none" display', () => {
    assert.deepEqual(normalize({ type: 'number', layout: 'none' }, '/prop'), { comp: 'none' })
  })

  it('should manage children array', () => {
    assert.deepEqual(
      normalize({ type: 'object', properties: { nb1: { type: 'number' }, nb2: { type: 'number' } } }, '/prop'),
      { comp: 'section', title: null, children: [{ key: 'nb1' }, { key: 'nb2' }] }
    )
    assert.deepEqual(
      normalize({ layout: ['nb1'], type: 'object', properties: { nb1: { type: 'number' }, nb2: { type: 'number' } } }, '/prop'),
      { comp: 'section', title: null, children: [{ key: 'nb1' }] }
    )
  })

  it('should accept wrapper composite children', () => {
    const layout: PartialChildren = [{ comp: 'section', title: 'Sec 1', children: ['nb1'] }, { comp: 'section', title: 'Sec 2', children: ['nb2'] }]
    assert.deepEqual(
      normalize({
        layout,
        type: 'object',
        properties: { nb1: { type: 'number' }, nb2: { type: 'number' } }
      }, '/prop'),
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
})
