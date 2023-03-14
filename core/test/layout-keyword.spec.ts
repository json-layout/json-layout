import { strict as assert } from 'assert'
import { validateLayoutKeyword as validate } from '../src/layout-keyword'

const assertValid = (data: any) => { assert.ok(validate(data), JSON.stringify(validate.errors)) }

describe('layout keyword validation', () => {
  it('should accept various forms of layout keyword values', async () => {
    assertValid('text-field')
    assert.ok(!validate('textfield'))
    assertValid(['child1', 'child2'])
    assertValid({ xs: 'text-field', md: 'textarea' })
    assertValid({ read: 'text-field', write: 'textarea' })
  })
})
