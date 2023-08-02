import { strict as assert } from 'assert'
import { normalizeLayoutFragment as normalize } from '../src/normalize'

describe('normalize schema fragment function', () => {
  const defaultTextFieldComp = { comp: 'text-field', label: 'prop' }
  const defaultTextareaComp = { comp: 'textarea', label: 'prop' }

  it('should transform schema fragments with optional layout keywords in normalized layout information', () => {
    assert.deepEqual(normalize({ type: 'string' }, '/prop'), defaultTextFieldComp)
    assert.deepEqual(normalize({ type: 'string', layout: 'textarea' }, '/prop'), defaultTextareaComp)
  })

  it('should manage a layout expressed as a switch', () => {
    assert.deepEqual(
      normalize({ type: 'string', layout: [{ if: 'read', comp: 'text-field' }, { if: 'write', comp: 'textarea' }] }, '/prop'),
      [{ ...defaultTextFieldComp, if: { type: 'expr-eval', expr: 'read' } }, { ...defaultTextareaComp, if: { type: 'expr-eval', expr: 'write' } }]
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
})
