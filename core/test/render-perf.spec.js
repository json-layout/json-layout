import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'
import { compile, StatefulLayout } from '../src/index.js'

describe('render performance - cache efficiency', () => {
  const defaultOptions = { debounceInputMs: 0 }

  it('should have cache hits for unchanged siblings after validation settles', async () => {
    // After initial input, validation state changes cause cache misses for all nodes.
    // But once the validation state has settled, subsequent inputs on the same field
    // should produce cache hits for unchanged siblings.
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        str1: { type: 'string' },
        str2: { type: 'string' },
        str3: { type: 'string' },
        str4: { type: 'string' },
        str5: { type: 'string' }
      }
    })

    const statefulLayout = new StatefulLayout(
      compiledLayout,
      compiledLayout.skeletonTrees[compiledLayout.mainTree],
      { ...defaultOptions, _debugCache: true },
      { str1: 'a', str2: 'b', str3: 'c', str4: 'd', str5: 'e' }
    )

    const root1 = statefulLayout.stateTree.root
    assert.ok(root1.children)
    assert.equal(root1.children.length, 5)

    // First input triggers validation state change → all nodes get cache misses
    statefulLayout.input(root1.children[0], 'first_change')
    const root2 = statefulLayout.stateTree.root

    // Clear debug cache to isolate the next input
    const debugCache = statefulLayout._lastCreateStateTreeContext._debugCache
    for (const key of Object.keys(debugCache)) {
      delete debugCache[key]
    }

    // Second input: validation state is already settled
    statefulLayout.input(root2.children[0], 'second_change')
    const root3 = statefulLayout.stateTree.root
    const cache = statefulLayout._lastCreateStateTreeContext._debugCache

    // Changed field → cache miss
    assert.ok(
      cache['/str1']?.includes('miss'),
      `changed field /str1 should have cache miss, got: ${cache['/str1']}`
    )

    // Sibling fields → cache hit (validation state hasn't changed)
    for (const key of ['/str2', '/str3', '/str4', '/str5']) {
      assert.ok(
        cache[key]?.includes('hit'),
        `sibling ${key} should have cache hit, got: ${cache[key]}`
      )
    }

    // Reference equality: unchanged siblings are the exact same object
    assert.equal(root2.children[1], root3.children[1], 'str2 should be same reference')
    assert.equal(root2.children[2], root3.children[2], 'str3 should be same reference')
    assert.equal(root2.children[3], root3.children[3], 'str4 should be same reference')
    assert.equal(root2.children[4], root3.children[4], 'str5 should be same reference')

    // Changed field and root are new references
    assert.notEqual(root2.children[0], root3.children[0], 'str1 should be new reference')
    assert.notEqual(root2, root3, 'root should be new reference')
  })

  it('should preserve reference equality despite cache misses on first input', async () => {
    // On the first input, validation state changes cause cache misses,
    // but Immer's structural sharing still preserves node references
    // for nodes whose actual content hasn't changed.
    const compiledLayout = await compile({
      type: 'object',
      properties: {
        str1: { type: 'string' },
        str2: { type: 'string' },
        str3: { type: 'string' }
      }
    })

    const statefulLayout = new StatefulLayout(
      compiledLayout,
      compiledLayout.skeletonTrees[compiledLayout.mainTree],
      defaultOptions,
      { str1: 'val1', str2: 'val2', str3: 'val3' }
    )

    const root1 = statefulLayout.stateTree.root

    // Change str1 — first input triggers validation
    statefulLayout.input(root1.children[0], 'changed')
    const root2 = statefulLayout.stateTree.root

    // Even though the cache reports misses for siblings (due to validation state),
    // Immer's structural sharing preserves references for unchanged nodes
    assert.equal(root1.children[1], root2.children[1], 'str2 should be same reference')
    assert.equal(root1.children[2], root2.children[2], 'str3 should be same reference')

    // Changed node and root are new references
    assert.notEqual(root1.children[0], root2.children[0], 'str1 should be new reference')
    assert.notEqual(root1, root2, 'root should be new reference')

    // No-op input should not change anything
    const currentStr1 = root2.children[0]
    statefulLayout.input(currentStr1, 'changed')
    const root3 = statefulLayout.stateTree.root
    assert.equal(root2, root3, 'no-op input should not create new root')
  })

  it('should have cache hits for unchanged sections and their children', async () => {
    // With titleDepth tracked separately from options, section wrappers ($comp nodes)
    // no longer break the cache. Unchanged sections and their leaf children
    // get cache hits and preserve reference equality.
    const compiledLayout = await compile({
      type: 'object',
      layout: [
        { title: 'Section A', children: ['a1', 'a2', 'a3'] },
        { title: 'Section B', children: ['b1', 'b2', 'b3'] },
        { title: 'Section C', children: ['c1', 'c2'] }
      ],
      properties: {
        a1: { type: 'string' },
        a2: { type: 'string' },
        a3: { type: 'string' },
        b1: { type: 'string' },
        b2: { type: 'string' },
        b3: { type: 'string' },
        c1: { type: 'string' },
        c2: { type: 'string' }
      }
    })

    const statefulLayout = new StatefulLayout(
      compiledLayout,
      compiledLayout.skeletonTrees[compiledLayout.mainTree],
      { ...defaultOptions, _debugCache: true },
      { a1: 'v1', a2: 'v2', a3: 'v3', b1: 'v4', b2: 'v5', b3: 'v6', c1: 'v7', c2: 'v8' }
    )

    const root1 = statefulLayout.stateTree.root
    assert.ok(root1.children)
    assert.equal(root1.children.length, 3, 'root should have 3 section children')

    // First input to settle validation
    statefulLayout.input(root1.children[0].children[0], 'first')
    const root2 = statefulLayout.stateTree.root

    // Clear cache
    const debugCache = statefulLayout._lastCreateStateTreeContext._debugCache
    for (const key of Object.keys(debugCache)) {
      delete debugCache[key]
    }

    // Second input on same field
    statefulLayout.input(root2.children[0].children[0], 'second')
    const root3 = statefulLayout.stateTree.root
    const cache = statefulLayout._lastCreateStateTreeContext._debugCache

    // Root and changed field are cache misses
    assert.ok(cache['']?.includes('miss'), 'root should be a cache miss')
    assert.ok(cache['/$comp-1']?.includes('miss'), 'changed section should be a cache miss')
    assert.ok(cache['/$comp-1/a1']?.includes('miss'), 'changed field should be a cache miss')

    // Section wrappers are cache misses because they reference the parent object data,
    // but their leaf children get cache hits since their own data is unchanged
    assert.ok(cache['/$comp-2']?.includes('miss'), 'section B is a cache miss (parent data changed)')
    assert.ok(cache['/$comp-3']?.includes('miss'), 'section C is a cache miss (parent data changed)')

    // Unchanged fields in the changed section should be cache hits
    assert.ok(cache['/$comp-1/a2']?.includes('hit'), 'unchanged field a2 in changed section should be a cache hit')
    assert.ok(cache['/$comp-1/a3']?.includes('hit'), 'unchanged field a3 in changed section should be a cache hit')

    // Leaf children in untouched sections should be cache hits
    for (const key of ['/$comp-2/b1', '/$comp-2/b2', '/$comp-2/b3', '/$comp-3/c1', '/$comp-3/c2']) {
      assert.ok(cache[key]?.includes('hit'), `${key} should be a cache hit`)
    }

    // Reference equality: leaf children in untouched sections are the exact same objects
    for (const sectionIdx of [1, 2]) {
      for (let i = 0; i < root2.children[sectionIdx].children.length; i++) {
        assert.equal(
          root2.children[sectionIdx].children[i],
          root3.children[sectionIdx].children[i],
          `leaf ${root2.children[sectionIdx].children[i].fullKey} should be same reference`
        )
      }
    }
  })
})
