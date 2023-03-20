import { strict as assert } from 'assert'
import { normalizeLayoutFragment as normalize } from '../src/normalized-layout/normalize'

describe('normalize schema fragment function', () => {
  it('should transform schema fragments with optional layout keywords in normalized layout information', () => {
    assert.deepEqual(normalize({ type: 'string' }, '/'), {
      read: {
        xs: { comp: 'text-field' },
        sm: { comp: 'text-field' },
        md: { comp: 'text-field' },
        lg: { comp: 'text-field' },
        xl: { comp: 'text-field' }
      },
      write: {
        xs: { comp: 'text-field' },
        sm: { comp: 'text-field' },
        md: { comp: 'text-field' },
        lg: { comp: 'text-field' },
        xl: { comp: 'text-field' }
      }
    })

    assert.deepEqual(normalize({ type: 'string', layout: 'textarea' }, '/'), {
      read: {
        xs: { comp: 'textarea' },
        sm: { comp: 'textarea' },
        md: { comp: 'textarea' },
        lg: { comp: 'textarea' },
        xl: { comp: 'textarea' }
      },
      write: {
        xs: { comp: 'textarea' },
        sm: { comp: 'textarea' },
        md: { comp: 'textarea' },
        lg: { comp: 'textarea' },
        xl: { comp: 'textarea' }
      }
    }
    )
  })
})
