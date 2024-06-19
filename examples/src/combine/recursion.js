/** @type {import("../types.js").JSONLayoutExample } */
const example = {
  title: 'Support of recursion',
  id: 'recursion',
  description: 'In some cases, like nested arrays of objects some recursion based on the `$ref` keyword is supported.',
  schema: {
    $ref: '#/$defs/recursiveObject',
    $defs: {
      recursiveObject: {
        type: 'object',
        title: 'An object with an array of children of the same type',
        properties: {
          key: { type: 'string' },
          children: {
            type: 'array',
            items: {
              $ref: '#/$defs/recursiveObject'
            },
            layout: {
              if: '!options.summary || data?.length > 0'
            }
          }
        }
      }
    }
  }
}

export default example
