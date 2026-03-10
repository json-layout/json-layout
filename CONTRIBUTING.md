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

## Agent toolkit evaluation

The `agents/` workspace provides MCP tools for AI agents to compile JSON schemas and fill forms. To evaluate these tools with a real LLM agent:

1. Make sure dependencies are installed and the project is built:

```
npm install
npm run build
```

2. Start [opencode](https://opencode.ai) in the project root. The MCP server and the `json-layout-form-filling` are configured in `opencode.jsonc` and will be available:

```
opencode
```

3. Prompt the agent with the eval document:

```
@agents/eval/EVAL.md follow these instructions
```

The agent will work through 7 progressive difficulty levels (basic fields, selection, validation, composite layouts, conditional schemas, lists, recursion) using the json-layout MCP tools against real schemas from `@json-layout/examples`. It reports on tool ergonomics, projection quality, and error clarity at the end. A report will be stored in agents/eval/report.md that can be used to iterate on improvements.

## Publishing

Release and publish using npm.

Create new version:

First modify the cross-references in the package.json files of the workspaces (core/package.json references @json-layout/vocabulary). Then create the new tags:

```
npm --workspaces version minor
```

Publish on npms:

```
npm --workspaces publish
```
