import { strict as assert } from 'assert'
import { normalizeLayoutFragment as normalize } from '../src/normalize'

describe('normalize schema fragment function', () => {
  it('should transform schema fragments with optional layout keywords in normalized layout information', () => {
    const defaultTextFieldComp = { comp: 'text-field', label: 'prop' }
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

    const defaultTextareaComp = { comp: 'textarea', label: 'prop' }
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
    }
    )
  })

  it('should calculate a label for a field', () => {
    assert.deepEqual(normalize({ type: 'string' }, '/prop').write.xs, { comp: 'text-field', label: 'prop' })
    assert.deepEqual(normalize({ type: 'string', title: 'Prop' }, '/prop').write.xs, { comp: 'text-field', label: 'Prop' })
    assert.deepEqual(normalize({ type: 'string', title: 'Prop', layout: { label: 'Prop label' } }, '/prop').write.xs, { comp: 'text-field', label: 'Prop label' })
  })
})
