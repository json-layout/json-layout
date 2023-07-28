import { strict as assert } from 'assert'
import { normalizeLayoutFragment as normalize } from '../src/normalize'

describe('normalize schema fragment function', () => {
  const defaultTextFieldComp = { comp: 'text-field', label: 'prop' }
  const defaultTextareaComp = { comp: 'textarea', label: 'prop' }

  it('should transform schema fragments with optional layout keywords in normalized layout information', () => {
    assert.deepEqual(normalize({ type: 'string' }, '/prop'), {
      read: {
        xs: defaultTextFieldComp,
        sm: defaultTextFieldComp,
        md: defaultTextFieldComp,
        lg: defaultTextFieldComp,
        xl: defaultTextFieldComp
      },
      write: {
        xs: defaultTextFieldComp,
        sm: defaultTextFieldComp,
        md: defaultTextFieldComp,
        lg: defaultTextFieldComp,
        xl: defaultTextFieldComp
      }
    })

    assert.deepEqual(normalize({ type: 'string', layout: 'textarea' }, '/prop'), {
      read: {
        xs: defaultTextareaComp,
        sm: defaultTextareaComp,
        md: defaultTextareaComp,
        lg: defaultTextareaComp,
        xl: defaultTextareaComp
      },
      write: {
        xs: defaultTextareaComp,
        sm: defaultTextareaComp,
        md: defaultTextareaComp,
        lg: defaultTextareaComp,
        xl: defaultTextareaComp
      }
    })
  })

  it('should apply different layout for read and write modes', () => {
    assert.deepEqual(normalize({ type: 'string', layout: { read: 'textarea' } }, '/prop'), {
      read: {
        xs: defaultTextareaComp,
        sm: defaultTextareaComp,
        md: defaultTextareaComp,
        lg: defaultTextareaComp,
        xl: defaultTextareaComp
      },
      write: {
        xs: defaultTextFieldComp,
        sm: defaultTextFieldComp,
        md: defaultTextFieldComp,
        lg: defaultTextFieldComp,
        xl: defaultTextFieldComp
      }
    })
  })

  it('should apply different layout for responsive breakpoints', () => {
    assert.deepEqual(normalize({ type: 'string', layout: { md: 'textarea' } }, '/prop'), {
      read: {
        xs: defaultTextFieldComp,
        sm: defaultTextFieldComp,
        md: defaultTextareaComp,
        lg: defaultTextareaComp,
        xl: defaultTextareaComp
      },
      write: {
        xs: defaultTextFieldComp,
        sm: defaultTextFieldComp,
        md: defaultTextareaComp,
        lg: defaultTextareaComp,
        xl: defaultTextareaComp
      }
    })
  })

  it('should calculate a label for a field', () => {
    assert.deepEqual(normalize({ type: 'string' }, '/prop').write.xs, { comp: 'text-field', label: 'prop' })
    assert.deepEqual(normalize({ type: 'string', title: 'Prop' }, '/prop').write.xs, { comp: 'text-field', label: 'Prop' })
    assert.deepEqual(normalize({ type: 'string', title: 'Prop', layout: { label: 'Prop label' } }, '/prop').write.xs, { comp: 'text-field', label: 'Prop label' })
  })

  it('should handle number types', () => {
    assert.deepEqual(normalize({ type: 'number' }, '/prop').write.xs, { comp: 'number-field', label: 'prop' })
    assert.deepEqual(normalize({ type: 'number', layout: { step: 0.1 } }, '/prop').write.xs, { comp: 'number-field', label: 'prop', step: 0.1 })
    assert.deepEqual(normalize({ type: 'integer' }, '/prop').write.xs, { comp: 'number-field', label: 'prop', step: 1 })
  })
})
