import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { pathURL } from '../src/state/utils/urls.js'

describe('pathURL', () => {
  it('should resolve a relative path against an absolute fetchBaseURL', () => {
    // Outside a browser the origin is a placeholder, and an absolute base used to be
    // glued onto it: "http://test.comhttps://koumoul.com/..." — unusable in Node.
    const url = pathURL('api/v1/datasets?q=x', 'https://koumoul.com/data-fair/')
    assert.equal(url.href, 'https://koumoul.com/data-fair/api/v1/datasets?q=x')
  })

  it('should keep resolving a relative path against a path fetchBaseURL', () => {
    const url = pathURL('api/v1/datasets', '/data-fair/')
    assert.equal(url.pathname, '/data-fair/api/v1/datasets')
  })
})
