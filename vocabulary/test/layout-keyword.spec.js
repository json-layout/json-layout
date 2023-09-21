import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { validateLayoutKeyword as validate } from '../src/layout-keyword/index.js'

const assertValid = (/** @type {any} */ data) => { assert.ok(validate(data), JSON.stringify(validate.errors)) }

describe('layout keyword validation', () => {
  it('should accept various forms of layout keyword values', async () => {
    assertValid('text-field')
    assert.ok(!validate('textfield'))
    assertValid(['child1', 'child2'])
    assertValid([{ if: 'display.mdAndDown', comp: 'text-field' }, { if: 'display.lgAndUp', comp: 'textarea' }])
    assertValid([{ if: 'mode == "read"', comp: 'text-field' }, { if: 'mode == "write"', comp: 'textarea' }])
  })
})
