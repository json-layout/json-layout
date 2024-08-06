module.exports = {
  root: true,
  extends: ['standard', 'plugin:jsdoc/recommended-typescript-flavor-error'],
  overrides: [
    {
      files: ['*.ts'],
      parser: '@typescript-eslint/parser',
      parserOptions: {
        project: require('path').join(__dirname, "tsconfig.json")
      },
      extends: 'standard-with-typescript',
      rules: {
        '@typescript-eslint/explicit-function-return-type': 0,
        '@typescript-eslint/restrict-template-expressions': 0,
        '@typescript-eslint/strict-boolean-expressions': 0,
        '@typescript-eslint/consistent-type-assertions': 0
      }
    }
  ],
  ignorePatterns: ['/node_modules', '/types', '/.eslintrc.cjs', '/tmp'],
  plugins: ['jsdoc'],
  rules: {
    'jsdoc/require-param-description': 0,
    'jsdoc/require-returns': 0,
    'jsdoc/require-returns-description': 0
  }
}
