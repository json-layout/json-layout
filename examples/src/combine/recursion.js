/** @type {import("../types.js").JSONLayoutExample } */
const example = {
  title: 'Support of recursion',
  id: 'recursion',
  description: `Some recursion based on the \`$ref\` keyword is supported.
  
Warning: recursion can easily create infinite loops.`,
  schema: {
    required: ['recursiveObject1', 'recursiveObject2'],
    properties: {
      recursiveObject1: { $ref: '#/$defs/recursiveObject1' },
      recursiveObject2: { $ref: '#/$defs/recursiveObject2' },
      recursiveObject3: { $ref: '#/$defs/recursiveObject3' }
    },
    $defs: {
      recursiveObject1: {
        type: 'object',
        title: 'An object with an array of children of the same type',
        required: ['key'],
        properties: {
          key: { type: 'string', pattern: '^[A-Z]+$' },
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
        title: 'An object with a recursive child in a card',
        description: 'Without the condition on the recursive child (expressed using the if keyword) this example will create an infinite loop.',
        required: ['key'],
        properties: {
          key: { type: 'string', pattern: '^[A-Z]+$' },
          activeChild: { type: 'boolean', title: 'show recursive child' },
          child: {
            $ref: '#/$defs/recursiveObject2',
            default: {},
            layout: {
              if: {
                pure: false,
                expr: 'parent.data.activeChild'
              },
              comp: 'card'
            }
          }
        }
      },
      recursiveObject3: {
        type: 'object',
        title: 'An object with a recursive child in a indented section',
        description: 'Without the condition on the recursive child (expressed using the dependencies keyword) this example will create an infinite loop.',
        required: ['key'],
        properties: {
          key: { type: 'string', pattern: '^[A-Z]+$' },
          activeChild: { type: 'boolean', title: 'show recursive child' }
        },
        dependencies: {
          activeChild: {
            properties: {
              child: {
                $ref: '#/$defs/recursiveObject3',
                default: {},
                layout: { options: { indent: true } }
              }
            }
          }
        }
      }
    }
  }
}

export default example
