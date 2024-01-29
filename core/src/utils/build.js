// these dependencies are not pure ESM, users will probably need to inform their bundler to treat them as commonjs

/** @type {string[]} */
export const commonjsDeps = [
  'ajv',
  'ajv/dist/2019.js',
  'ajv-formats',
  'ajv-formats/dist/formats.js',
  'ajv-i18n',
  'ajv-errors',
  'markdown-it',
  'debug'
]

/** @type {string[][]} */
export const commonjsDepsPaths = [
  ['@json-layout/core', 'ajv'],
  ['@json-layout/core', 'ajv/dist/2019.js'],
  ['@json-layout/core', 'ajv-formats'],
  ['@json-layout/core', 'ajv-formats/dist/formats.js'],
  ['@json-layout/core', 'ajv-i18n'],
  ['@json-layout/core', 'ajv-errors'],
  ['@json-layout/core', 'markdown-it'],
  ['@json-layout/core', 'debug']
]
