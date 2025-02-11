import neostandard from 'neostandard'
import jsdoc from 'eslint-plugin-jsdoc'

export default [
  { ignores: ['**/tmp/*', '**/types/*', '**/types.ts', '**/*.d.ts', '**/schema.js'] },
  ...neostandard({ ts: true, noJsx: true }),
  jsdoc.configs['flat/recommended-typescript-flavor'],
  {
    rules: {
      'no-undef': 'off', // taken care of by typescript
      'jsdoc/require-param-description': 'off',
      'jsdoc/require-returns-description': 'off',
      'jsdoc/require-returns': 'off'
    }
  }
]
