import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { compile, StatefulLayout } from '../src/index.js'

describe('Recursivity in schema', () => {
  const defaultOptions = { debounceInputMs: 0 }

  it('should manage recursivity in arrays', async () => {
    const compiledLayout = await compile(
      {
        $ref: '#/$defs/recursiveObject',
        $defs: {
          recursiveObject: {
            type: 'object',
            properties: {
              key: { type: 'string' },
              children: {
                type: 'array',
                items: {
                  $ref: '#/$defs/recursiveObject'
                }
              }
            }
          }
        }
      })
    const statefulLayout = new StatefulLayout(
      compiledLayout, compiledLayout.skeletonTrees[compiledLayout.mainTree],
      defaultOptions,
      {}
    )
  })
})
