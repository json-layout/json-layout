/** @type {import("../types.js").JSONLayoutExample } */
const example = {
  title: 'Support of recursion',
  id: 'recursion',
  description: `Some recursion based on the \`$ref\` keyword is supported.
  
Warning: recursion can easily create infinite loops.`,
  schema: {
    properties: {
      recursiveObject1: { $ref: '#/$defs/recursiveObject1' },
      recursiveObject2: { $ref: '#/$defs/recursiveObject2' }
    },
    $defs: {
      recursiveObject1: {
        type: 'object',
        title: 'An object with an array of children of the same type',
        properties: {
          key: { type: 'string' },
          children: {
            type: 'array',
            items: {
              $ref: '#/$defs/recursiveObject1'
            },
            layout: {
              if: '!options.summary || data?.length > 0'
            }
          }
        }
      },
      recursiveObject2: {
        type: 'object',
        title: 'An object with a conditional recursive child',
        description: 'Without the condition on the recursive child this example will create an infinite loop.',
        properties: {
          key: { type: 'string' },
          activeChild: { type: 'boolean', title: 'show recursive child' },
          child: {
            $ref: '#/$defs/recursiveObject2',
            layout: {
              if: {
                pure: false,
                expr: 'parent.data.activeChild'
              }
            }
          }
        }
      }
    }
  }
}

export default example
