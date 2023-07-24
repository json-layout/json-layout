## Development environment

The project is written in [TypeScript](https://www.typescriptlang.org/).

## Getting started

Install dependencies and run the tests:

```
npm install
npm test
npm run build
```

## Quality checks

This project uses [husky](https://typicode.github.io/husky/) to ensure quality of contributions in a pre-commit hook.

  - code source is linted using [eslint](https://eslint.org/), you can run the linter manually with `npm run lint`
  - code source is tested, you can run the tests manually with `npm test`
  - commit messages are checked against [conventional rules](https://www.conventionalcommits.org/en/v1.0.0/)

## Watch changes

This command is useful for fast iterations. It will run tests and builds on source file changes.

```
npm run dev
```