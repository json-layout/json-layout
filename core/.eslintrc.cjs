module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    // project: './tsconfig.json'
    project: require('path').join(__dirname, "tsconfig.json")
  },
  extends: ['standard-with-typescript'],
  env: {
    node: true // Enable Node.js global variables
  },
  ignorePatterns: ['/node_modules', '/cjs', '/mjs', '/src/layout-keyword', '/src/normalized-layout', '/.eslintrc.cjs'],
  plugins: ['no-only-tests'],
  rules: {
    '@typescript-eslint/explicit-function-return-type': 0,
    '@typescript-eslint/restrict-template-expressions': 0,
    '@typescript-eslint/strict-boolean-expressions': 0,
    '@typescript-eslint/consistent-type-assertions': 0,
    "no-only-tests/no-only-tests": "error"
  }
}
