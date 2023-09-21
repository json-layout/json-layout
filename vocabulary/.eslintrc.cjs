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
      extends: 'standard-with-typescript'
    }
  ],
  ignorePatterns: ['/node_modules', '/types', '/src/layout-keyword', '/src/normalized-layout', '.eslintrc.cjs'],
  plugins: ['jsdoc'],
  rules: {
    'jsdoc/require-param-description': 0,
    'jsdoc/require-returns-description': 0
  }
}
