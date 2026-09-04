# Agent-Driven, LLM-Judged WebMCP Eval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the WebMCP eval harness's hardcoded expected-data scoring with runs performed by an isolated subagent and verdicts produced by an LLM judge.

**Architecture:** Cases carry a goal and declared properties but no expected data. A generator writes `.mcp.json` and one restricted runner agent definition per case from a single source. A skill dispatches one runner per case in parallel, each driving its own case's MCP server; a judge subagent then turns each transcript into a verdict plus friction points anchored to individual tool calls. CI keeps only the assertions that need no model.

**Tech Stack:** Node.js v24, ESM, JSDoc type annotations, `node:test` + `node:assert`, Claude Code agent definitions and skills.

**Spec:** `docs/superpowers/specs/2026-09-04-webmcp-eval-agent-judged-design.md`

## Global Constraints

- ESM everywhere; always use the `.js` extension in relative imports
- Source is `.js` with JSDoc type annotations; shared types in `types.ts`
- neostandard style: no semicolons, 2-space indent, no trailing commas
- Tests use `node:test` `describe`/`it` and `node:assert` strict; names follow `'should <verb> ...'`
- Never add a runtime dependency to `core`; `nock` and `@mcp-b/webmcp-types` are existing devDependencies
- `npm run quality` (lint → build → test) must pass before every commit
- Conventional Commits, enforced by commitlint
- The runner agent definition must never list `Read`, `Grep`, `Bash`, `Write`, `Edit` or `WebFetch` — this is the isolation guarantee
- `SCHEMA_MAX_LENGTH` is 20000, exported from `core/src/webmcp/tools/get-schema.js`
- `getComplexity` bands: `> 50` large, `> 15` medium, otherwise small

---

### Task 1: Case format, vendored schemas, and CI band guards

Replaces synthetic cases with real vendored schemas and adds the assertions that would have caught the old `dataset` case being mislabelled.

**Files:**
- Create: `core/webmcp-eval/cases/schemas/app-charts.json` (copied)
- Create: `core/webmcp-eval/cases/schemas/app-calendar.json` (copied)
- Modify: `core/webmcp-eval/cases/index.js` (full rewrite)
- Modify: `core/webmcp-eval/cases/types.ts` (full rewrite)
- Modify: `core/src/webmcp/index.js` (export `getComplexity`)
- Test: `core/test/webmcp-eval.spec.js` (full rewrite)

**Interfaces:**
- Consumes: nothing
- Produces: `cases: EvalCase[]`, `getCase(name: string): EvalCase` from `core/webmcp-eval/cases/index.js`; `getComplexity(statefulLayout): 'small'|'medium'|'large'` exported from `core/src/webmcp/index.js`. `EvalCase` has `{ name, title, goal, schema, data, expectedComplexity, expectedSchemaFits }` — no `expected`, no `budget`.

- [ ] **Step 1: Vendor the two real schemas**

Copy the **source** schema for charts, not the published one — `public/config-schema.json` is generated from `resolved-schema.json` and is 6× the size for an identical projection.

```bash
mkdir -p core/webmcp-eval/cases/schemas
cp ~/data-fair/app-charts/src/config/schema.json core/webmcp-eval/cases/schemas/app-charts.json
cp ~/data-fair/app-calendar/public/config-schema.json core/webmcp-eval/cases/schemas/app-calendar.json
```

Verify the sizes match what the spec measured (29472 and 5941 compact chars):

```bash
node -e "for (const f of ['app-charts','app-calendar']) console.log(f, JSON.stringify(JSON.parse(require('fs').readFileSync('core/webmcp-eval/cases/schemas/'+f+'.json','utf8'))).length)"
```

Expected: `app-charts 29472` and `app-calendar 5941`. If they differ, the apps have changed since measurement — record the new numbers and update the spec's table rather than forcing the old values.

- [ ] **Step 2: Write the failing CI guards**

Replace the whole of `core/test/webmcp-eval.spec.js`:

```js
import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'

import { compile } from '../src/compile/index.js'
import { StatefulLayout } from '../src/state/index.js'
import { getComplexity } from '../src/webmcp/index.js'
import * as getSchema from '../src/webmcp/tools/get-schema.js'

import { cases, getCase } from '../webmcp-eval/cases/index.js'
import { EvalSession } from '../webmcp-eval/session.js'

/**
 * These assertions need no model. They cannot tell you whether a form is usable by an
 * agent — that is the judged eval's job — but they pin that each case is the case it
 * claims to be. The previous suite could not: it replayed sequences written alongside
 * the fixtures, and passed while `dataset` was labelled large, returned its whole
 * schema, and finished in a quarter of its call budget.
 */
describe('webmcp eval cases', () => {
  for (const evalCase of cases) {
    it(`should compile the ${evalCase.name} schema`, () => {
      const compiled = compile(evalCase.schema)
      assert.ok(compiled.skeletonTrees[compiled.mainTree], 'should produce a main tree')
    })

    it(`should place ${evalCase.name} in its declared complexity band`, () => {
      // The check the old dataset case slipped past: it was labelled large and was medium.
      const compiled = compile(evalCase.schema)
      const mainTree = compiled.skeletonTrees[compiled.mainTree]
      const layout = new StatefulLayout(compiled, mainTree, {}, evalCase.data)
      assert.equal(getComplexity(layout), evalCase.expectedComplexity)
    })

    it(`should match the declared getSchema behaviour for ${evalCase.name}`, () => {
      // Band and schema size are independent — calendar is large yet its schema fits —
      // so only a case declaring expectedSchemaFits false exercises path navigation.
      const compiled = compile(evalCase.schema)
      const mainTree = compiled.skeletonTrees[compiled.mainTree]
      const layout = new StatefulLayout(compiled, mainTree, {}, evalCase.data)
      const result = getSchema.execute(layout, evalCase.schema, {})
      assert.equal(!result.tooLarge, evalCase.expectedSchemaFits)
    })

    it(`should state a usable goal for ${evalCase.name}`, () => {
      // The goal is the runner's only input, so it must read as a user request.
      assert.ok(evalCase.goal.length > 20, 'goal should be a sentence')
      for (const toolName of ['setFieldValue', 'getSchema', 'describeState', 'editArray', 'setData']) {
        assert.ok(!evalCase.goal.includes(toolName), `goal must not name the ${toolName} tool`)
      }
    })
  }

  it('should cover both getSchema branches across the case set', () => {
    // Without at least one oversized schema, nothing reaches the refusal path.
    assert.ok(cases.some((c) => c.expectedSchemaFits === false), 'need a case whose schema is refused')
    assert.ok(cases.some((c) => c.expectedSchemaFits === true), 'need a case whose schema is returned whole')
  })
})

describe('webmcp eval session', () => {
  it('should expose the same tools a page would register, including the skill', () => {
    const session = new EvalSession(getCase('contact'))
    const names = session.tools.map((t) => t.name)
    for (const expected of ['fillFormSkill', 'getData', 'getSchema', 'describeState', 'setData', 'setFieldValue', 'editArray', 'getFieldSuggestions']) {
      assert.ok(names.includes(expected), `missing tool ${expected}, got ${names.join(', ')}`)
    }
  })

  it('should record the cost of every call', async () => {
    const session = new EvalSession(getCase('contact'))
    await session.call('getData', {})
    assert.equal(session.calls.length, 1)
    assert.equal(session.calls[0].tool, 'getData')
    assert.ok(session.calls[0].outputBytes > 0, 'output size should be recorded')
    assert.equal(session.calls[0].isError, false)
    assert.equal(session.totalOutputBytes, session.calls[0].outputBytes)
  })

  it('should record an unknown tool as a failed call rather than throwing', async () => {
    const session = new EvalSession(getCase('contact'))
    const result = await session.call('setFieldValu', { path: '/name', value: 'x' })
    assert.equal(result.isError, true)
    assert.equal(session.calls[0].isError, true)
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `node --test core/test/webmcp-eval.spec.js`
Expected: FAIL — `getComplexity` is not exported, and the `charts`/`calendar` cases do not exist.

- [ ] **Step 4: Export `getComplexity`**

In `core/src/webmcp/index.js`, change the declaration so the band function is testable rather than duplicated in the test:

```js
/**
 * @param {import('../state/index.js').StatefulLayout} statefulLayout
 * @returns {"small"|"medium"|"large"}
 */
export function getComplexity (statefulLayout) {
```

- [ ] **Step 5: Rewrite the case types**

Replace the whole of `core/webmcp-eval/cases/types.ts`:

```ts
export type ComplexityBand = 'small' | 'medium' | 'large'

export type EvalCase = {
  name: string
  /** Passed to WebMCP as dataTitle, so it appears in the tool descriptions. */
  title: string
  /**
   * The task, phrased as a user would. The ONLY text the runner sees: it must name no
   * tools and describe an outcome, not a procedure.
   */
  goal: string
  schema: Record<string, unknown>
  /** Initial form data, usually empty. */
  data: Record<string, unknown>
  /** Band getComplexity must report. Asserted in CI, never read at runtime. */
  expectedComplexity: ComplexityBand
  /**
   * Whether getSchema returns the whole schema. Independent of the band — a case can be
   * large by node count while its schema still fits under SCHEMA_MAX_LENGTH.
   */
  expectedSchemaFits: boolean
}
```

- [ ] **Step 6: Rewrite the case registry**

Replace the whole of `core/webmcp-eval/cases/index.js`:

```js
/**
 * @file Eval cases: forms an agent is asked to fill through the WebMCP tools.
 *
 * Each case is a schema and a goal phrased as a user would phrase it. There is
 * deliberately no expected result: a run is judged by reading its transcript, not by
 * comparing its data to a blob written by whoever wrote the case. The declared band and
 * schema-fit are assertions about the case itself, checked in CI so a case cannot drift
 * into claiming a branch it never reaches.
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/** @typedef {import('./types.js').EvalCase} EvalCase */

const here = dirname(fileURLToPath(import.meta.url))

/**
 * @param {string} file
 * @returns {Record<string, unknown>}
 */
function loadSchema (file) {
  return JSON.parse(readFileSync(join(here, 'schemas', file), 'utf8'))
}

/**
 * Small hand-written control. Fast, and the only case whose shape is fully under our
 * control, which makes it the one to reach for when debugging the harness itself.
 * @type {EvalCase}
 */
const contact = {
  name: 'contact',
  title: 'contact form',
  goal: 'Fill in the contact form for Ada Lovelace, born in 1815, email ada@analytical.org, who prefers to be contacted by email.',
  schema: {
    type: 'object',
    title: 'Contact',
    required: ['name', 'email'],
    properties: {
      name: { type: 'string', title: 'Full name' },
      birthYear: { type: 'integer', title: 'Year of birth', minimum: 1800, maximum: 2100 },
      email: { type: 'string', title: 'Email', format: 'email' },
      contactMethod: { type: 'string', title: 'Preferred contact method', enum: ['email', 'phone', 'post'] }
    }
  },
  data: {},
  expectedComplexity: 'small',
  expectedSchemaFits: true
}

/**
 * Real app schema, large band but small enough that getSchema still returns it whole.
 * The pair with `charts` is the point: same band, opposite schema behaviour, which is
 * the evidence that the band alone says nothing about what an agent can read.
 * @type {EvalCase}
 */
const calendar = {
  name: 'calendar',
  title: 'calendar configuration',
  goal: 'Set up the calendar on the events dataset, use the event name column as the label shown on each event, and turn on crowd sourcing so visitors can propose new events.',
  schema: loadSchema('app-calendar.json'),
  data: {},
  expectedComplexity: 'large',
  expectedSchemaFits: true
}

/**
 * Real app schema large enough that getSchema refuses it, so the agent has to navigate
 * by path. The only case that reaches that branch.
 * @type {EvalCase}
 */
const charts = {
  name: 'charts',
  title: 'chart configuration',
  goal: 'Make a bar chart of the average PM10 level per city from the air quality dataset, title it "PM10 by city" and put the legend on the right.',
  schema: loadSchema('app-charts.json'),
  data: {},
  expectedComplexity: 'large',
  expectedSchemaFits: false
}

/** @type {EvalCase[]} */
export const cases = [contact, calendar, charts]

/**
 * @param {string} name
 * @returns {EvalCase}
 */
export function getCase (name) {
  const found = cases.find((c) => c.name === name)
  if (!found) throw new Error(`unknown eval case "${name}", available: ${cases.map((c) => c.name).join(', ')}`)
  return found
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `node --test core/test/webmcp-eval.spec.js`
Expected: PASS.

If the band assertion fails, do **not** change `expectedComplexity` to match — first confirm the schema you vendored is the source and not the resolved one, since resolving inflates the node count (`app-charts` goes 286 → 828).

- [ ] **Step 8: Run the full quality gate**

Run: `npm run quality`
Expected: lint clean, build clean, all tests pass.

- [ ] **Step 9: Commit**

```bash
git add core/webmcp-eval/cases core/src/webmcp/index.js core/test/webmcp-eval.spec.js
git commit -m "test(core): base eval cases on real schemas and assert their declared bands"
```

---

### Task 2: Strip scoring from the session and server

Removes the expected-data comparison and the budget thresholds, leaving the session as a recorder of evidence.

**Files:**
- Modify: `core/webmcp-eval/session.js` (remove `score()`, rewrite `report()`)
- Modify: `core/webmcp-eval/server.js` (persist evidence, not a score)
- Test: `core/test/webmcp-eval.spec.js` (add evidence-shape tests)

**Interfaces:**
- Consumes: `EvalCase` and `getCase` from Task 1
- Produces: `EvalSession` with `calls`, `data`, `valid`, `totalOutputBytes`, `tools`, `call(name, args)`, `evidence()` returning `{ case, goal, calls, data, valid, metrics: { toolCalls, outputBytes } }`, and `report()` returning a plain-text transcript dump. `score()` no longer exists.

- [ ] **Step 1: Write the failing test**

Append to `core/test/webmcp-eval.spec.js`, inside the `webmcp eval session` describe block:

```js
  it('should produce judge evidence without a verdict of its own', async () => {
    // The session records; it does not decide. A score() here would re-introduce the
    // hardcoded expectations the judge exists to replace.
    const session = new EvalSession(getCase('contact'))
    await session.call('setFieldValue', { path: '/name', value: 'Ada Lovelace' })

    const evidence = session.evidence()
    assert.equal(evidence.case, 'contact')
    assert.equal(evidence.goal, getCase('contact').goal)
    assert.equal(evidence.metrics.toolCalls, 1)
    assert.ok(evidence.metrics.outputBytes > 0)
    assert.equal(evidence.valid, false, 'email is still missing')
    assert.deepEqual(evidence.data, { name: 'Ada Lovelace' })
    assert.equal(evidence.calls[0].tool, 'setFieldValue')
    assert.ok('response' in evidence.calls[0], 'the judge needs the response text, not just its size')
    assert.equal(typeof (/** @type {any} */(session).score), 'undefined', 'score() must be gone')
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test core/test/webmcp-eval.spec.js`
Expected: FAIL with `session.evidence is not a function`.

- [ ] **Step 3: Record response text on each call**

In `core/webmcp-eval/session.js`, extend the `RecordedCall` typedef and the push in `call()` so the judge can read what the agent read:

```js
/**
 * @typedef {object} RecordedCall
 * @property {string} tool - name of the tool the agent called
 * @property {unknown} args - arguments it passed
 * @property {string} response - the text the agent read back, verbatim
 * @property {number} outputBytes - size of that text
 * @property {boolean} isError - whether the tool reported a failure
 */
```

In `call()`, both push sites gain `response`:

```js
      this.calls.push({ tool: name, args, response: message, outputBytes: message.length, isError: true })
```

```js
    this.calls.push({
      tool: name,
      args,
      response: text,
      outputBytes: Buffer.byteLength(text, 'utf8'),
      isError: !!result?.isError
    })
```

- [ ] **Step 4: Replace `score()` and `report()`**

Delete the entire `score ()` method and replace `report ()` in `core/webmcp-eval/session.js`:

```js
  /**
   * Everything the judge reads. No verdict: the point of the redesign is that whether a
   * session went well is a judgement about the transcript, not a comparison against a
   * blob written by whoever wrote the case.
   * @returns {object}
   */
  evidence () {
    return {
      case: this._case.name,
      goal: this._case.goal,
      calls: this.calls,
      data: this.data,
      valid: this.valid,
      metrics: {
        toolCalls: this.calls.length,
        outputBytes: this.totalOutputBytes
      }
    }
  }

  /**
   * Human-readable transcript, for reading a run in the terminal.
   * @returns {string}
   */
  report () {
    const lines = [`eval case "${this._case.name}" — ${this.calls.length} calls, ${this.totalOutputBytes} bytes, valid=${this.valid}`]
    for (const [i, call] of this.calls.entries()) {
      lines.push(`  ${i + 1}. ${call.tool}${call.isError ? ' (error)' : ''} ${JSON.stringify(call.args)} → ${call.outputBytes}b`)
    }
    return lines.join('\n')
  }
```

- [ ] **Step 5: Persist evidence from the server**

In `core/webmcp-eval/server.js`, replace the body of `persist()`'s `writeFileSync` call so it writes evidence rather than a score:

```js
    writeFileSync(transcriptPath, JSON.stringify(session.evidence(), null, 2))
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `node --test core/test/webmcp-eval.spec.js`
Expected: PASS.

- [ ] **Step 7: Verify the server still speaks MCP end to end**

```bash
printf '%s\n' \
 '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{}}}' \
 '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"setFieldValue","arguments":{"path":"/name","value":"Ada"}}}' \
 | JL_WEBMCP_EVAL_CASE=contact node core/webmcp-eval/server.js
cat core/tmp/webmcp-eval-contact.json
```

Expected: two JSON-RPC results, and a transcript file containing `goal`, `calls[0].response` and `metrics`, with no `score` key.

- [ ] **Step 8: Commit**

```bash
npm run quality
git add core/webmcp-eval/session.js core/webmcp-eval/server.js core/test/webmcp-eval.spec.js
git commit -m "refactor(core): make the eval session record evidence instead of scoring"
```

---

### Task 3: Generated MCP and runner agent configuration

Generates `.mcp.json` and the isolated runner agent definitions from the case registry, so the two cannot drift apart.

**Files:**
- Create: `core/webmcp-eval/generate-config.js`
- Create: `core/test/webmcp-eval-config.spec.js`
- Modify: `core/package.json` (add `webmcp-eval:config` script)
- Regenerate: `.mcp.json`, `.claude/agents/webmcp-eval-runner-*.md`

**Interfaces:**
- Consumes: `cases` from Task 1
- Produces: `buildConfig(cases): { mcpJson: object, agents: Array<{ path: string, content: string }> }` and `TOOL_NAMES: string[]` from `core/webmcp-eval/generate-config.js`

- [ ] **Step 1: Write the failing test**

Create `core/test/webmcp-eval-config.spec.js`:

```js
import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'

import { cases } from '../webmcp-eval/cases/index.js'
import { buildConfig, TOOL_NAMES } from '../webmcp-eval/generate-config.js'

/**
 * The isolation guarantee is enforced here. A runner that could read the repository
 * would find its case's goal, the tool implementations and the review report, and the
 * run would be worthless without anyone noticing — so the absence of filesystem tools
 * is asserted, not assumed.
 */
describe('webmcp eval config generation', () => {
  const config = buildConfig(cases)

  it('should declare one MCP server per case', () => {
    const servers = Object.keys(config.mcpJson.mcpServers)
    assert.equal(servers.length, cases.length)
    for (const evalCase of cases) {
      const server = config.mcpJson.mcpServers[`webmcp-eval-${evalCase.name}`]
      assert.ok(server, `missing server for ${evalCase.name}`)
      assert.deepEqual(server.args, ['core/webmcp-eval/server.js'])
      assert.equal(server.env.JL_WEBMCP_EVAL_CASE, evalCase.name)
    }
  })

  it('should write one runner agent definition per case', () => {
    assert.equal(config.agents.length, cases.length)
    for (const evalCase of cases) {
      assert.ok(
        config.agents.some((a) => a.path === `.claude/agents/webmcp-eval-runner-${evalCase.name}.md`),
        `missing agent for ${evalCase.name}`
      )
    }
  })

  it('should grant a runner only its own case tools', () => {
    // Cross-case tools would let one runner see another form; filesystem tools would
    // let it read the case file. Both must be absent.
    const agent = config.agents.find((a) => a.path.endsWith('webmcp-eval-runner-contact.md'))
    assert.ok(agent)
    for (const tool of TOOL_NAMES) {
      assert.ok(agent.content.includes(`mcp__webmcp-eval-contact__${tool}`), `missing ${tool}`)
    }
    assert.ok(!agent.content.includes('webmcp-eval-charts'), 'must not reach another case')
  })

  it('should never grant a runner a filesystem or network tool', () => {
    for (const agent of config.agents) {
      for (const forbidden of ['Read', 'Grep', 'Bash', 'Write', 'Edit', 'WebFetch', 'WebSearch', 'Glob']) {
        assert.ok(
          !new RegExp(`(^|[\\s,:])${forbidden}([\\s,]|$)`, 'm').test(agent.content),
          `${agent.path} must not grant ${forbidden}`
        )
      }
    }
  })

  it('should not tell the runner it is being evaluated', () => {
    // Being told changes behaviour; the run must look like an ordinary page visit.
    for (const agent of config.agents) {
      const body = agent.content.split('---')[2] ?? ''
      for (const leak of ['eval', 'judge', 'benchmark', 'test', 'score']) {
        assert.ok(!body.toLowerCase().includes(leak), `${agent.path} prompt leaks "${leak}"`)
      }
    }
  })

  it('should not put the goal in the agent definition', () => {
    // The goal is passed at dispatch. Baking it in would make every run of a case
    // identical and would leak all goals into one file.
    for (const agent of config.agents) {
      for (const evalCase of cases) {
        assert.ok(!agent.content.includes(evalCase.goal), `${agent.path} must not embed a goal`)
      }
    }
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test core/test/webmcp-eval-config.spec.js`
Expected: FAIL — cannot resolve `../webmcp-eval/generate-config.js`.

- [ ] **Step 3: Write the generator**

Create `core/webmcp-eval/generate-config.js`:

```js
#!/usr/bin/env node
/**
 * @file Generate .mcp.json and the runner agent definitions from the case registry.
 *
 * Both are generated from one source because drift between them breaks isolation
 * silently: an agent definition naming a server that no longer exists produces a runner
 * with no tools, which looks like a bad run rather than a broken setup.
 *
 * Usage: npm run webmcp-eval:config -w core
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { cases } from './cases/index.js'

/** @typedef {import('./cases/types.js').EvalCase} EvalCase */

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..')

/**
 * Tool names WebMCP registers when no prefixName is set. Listed explicitly rather than
 * derived from a live session, so the generator needs no compiled form to run.
 */
export const TOOL_NAMES = [
  'fillFormSkill',
  'getData',
  'setData',
  'describeState',
  'setFieldValue',
  'getFieldSuggestions',
  'editArray',
  'getSchema'
]

/**
 * The runner's whole system prompt. It describes an ordinary page visit: no mention of
 * evaluation, no tool names, no goal — the goal arrives at dispatch.
 */
const RUNNER_PROMPT = `You are assisting a user with a form on the page they are currently viewing.

Use the tools available to you to inspect the form and fill it in according to what the
user asks for. Work carefully: read the form's structure before writing to it, and check
that the values you write were accepted.

If you cannot determine a value from what the tools tell you, say so in your final
answer rather than guessing. When you are done, summarise what you filled in and
anything you could not complete.`

/**
 * @param {EvalCase[]} evalCases
 * @returns {{ mcpJson: object, agents: Array<{ path: string, content: string }> }}
 */
export function buildConfig (evalCases) {
  /** @type {Record<string, object>} */
  const mcpServers = {}
  /** @type {Array<{ path: string, content: string }>} */
  const agents = []

  for (const evalCase of evalCases) {
    const server = `webmcp-eval-${evalCase.name}`
    mcpServers[server] = {
      type: 'stdio',
      command: 'node',
      args: ['core/webmcp-eval/server.js'],
      env: { JL_WEBMCP_EVAL_CASE: evalCase.name }
    }

    const tools = TOOL_NAMES.map((tool) => `mcp__${server}__${tool}`).join(', ')
    agents.push({
      path: `.claude/agents/webmcp-eval-runner-${evalCase.name}.md`,
      content: `---
name: webmcp-eval-runner-${evalCase.name}
description: Fills in the form on the page the user is viewing.
tools: ${tools}
---

${RUNNER_PROMPT}
`
    })
  }

  return { mcpJson: { mcpServers }, agents }
}

// Only write files when run as a CLI, so importing this in a test has no side effects.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { mcpJson, agents } = buildConfig(cases)
  writeFileSync(join(repoRoot, '.mcp.json'), JSON.stringify(mcpJson, null, 2) + '\n')
  mkdirSync(join(repoRoot, '.claude', 'agents'), { recursive: true })
  for (const agent of agents) {
    writeFileSync(join(repoRoot, agent.path), agent.content)
  }
  console.log(`wrote .mcp.json and ${agents.length} runner agent definitions`)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test core/test/webmcp-eval-config.spec.js`
Expected: PASS, 6 tests.

- [ ] **Step 5: Add the script and generate the files**

In `core/package.json` scripts, after `"test"`:

```json
    "webmcp-eval:config": "node webmcp-eval/generate-config.js",
```

Then run it:

```bash
npm run webmcp-eval:config -w core
cat .mcp.json
cat .claude/agents/webmcp-eval-runner-contact.md
```

Expected: three servers named `webmcp-eval-{contact,calendar,charts}`, and three agent files whose `tools:` lines contain only `mcp__webmcp-eval-<case>__*` entries.

- [ ] **Step 6: Commit**

```bash
npm run quality
git add core/webmcp-eval/generate-config.js core/test/webmcp-eval-config.spec.js core/package.json .mcp.json .claude/agents
git commit -m "feat(core): generate isolated runner agents and mcp config from the cases"
```

---

### Task 4: Judge agent and orchestration skill

Adds the judge and the skill that runs a full session: dispatch runners, then judge each transcript.

**Files:**
- Create: `.claude/agents/webmcp-eval-judge.md`
- Create: `.claude/skills/webmcp-eval/SKILL.md`
- Create: `core/webmcp-eval/verdict.js`
- Create: `core/test/webmcp-eval-verdict.spec.js`

**Interfaces:**
- Consumes: evidence files written by Task 2's server
- Produces: `parseVerdict(text: string): Verdict` from `core/webmcp-eval/verdict.js`, where `Verdict` is `{ case, verdict: 'satisfactory'|'unsatisfactory', reasoning: string, friction: Array<{ call: number, tool: string, observed: string, inferred: string, severity: 'high'|'medium'|'low' }> }`. Throws `Error` with a specific message on malformed input.

- [ ] **Step 1: Write the failing test**

Create `core/test/webmcp-eval-verdict.spec.js`:

```js
import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'

import { parseVerdict } from '../webmcp-eval/verdict.js'

const valid = JSON.stringify({
  case: 'charts',
  verdict: 'unsatisfactory',
  reasoning: 'The agent invented a column name after the suggestions call returned nothing.',
  friction: [
    {
      call: 7,
      tool: 'getFieldSuggestions',
      observed: 'No suggestions available',
      inferred: 'concluded the field was free text and invented a value',
      severity: 'high'
    }
  ]
})

describe('webmcp eval verdict parsing', () => {
  it('should parse a well-formed verdict', () => {
    const verdict = parseVerdict(valid)
    assert.equal(verdict.case, 'charts')
    assert.equal(verdict.verdict, 'unsatisfactory')
    assert.equal(verdict.friction.length, 1)
    assert.equal(verdict.friction[0].call, 7)
    assert.equal(verdict.friction[0].severity, 'high')
  })

  it('should tolerate a verdict wrapped in a fenced code block', () => {
    // A judge is a language model; it will sometimes fence its JSON.
    assert.equal(parseVerdict('```json\n' + valid + '\n```').case, 'charts')
  })

  it('should reject an unknown verdict value', () => {
    // A judge that answers "partially" has not answered the question asked.
    const bad = JSON.stringify({ ...JSON.parse(valid), verdict: 'partially' })
    assert.throws(() => parseVerdict(bad), /verdict must be/)
  })

  it('should reject friction that is not anchored to a call', () => {
    // Unanchored friction is an opinion; anchored friction is evidence.
    const bad = JSON.stringify({ ...JSON.parse(valid), friction: [{ tool: 'getData', observed: 'x', inferred: 'y', severity: 'low' }] })
    assert.throws(() => parseVerdict(bad), /friction\[0\].call/)
  })

  it('should accept an empty friction list on a satisfactory run', () => {
    const clean = JSON.stringify({ case: 'contact', verdict: 'satisfactory', reasoning: 'Filled every field on the first attempt.', friction: [] })
    assert.equal(parseVerdict(clean).friction.length, 0)
  })

  it('should reject text that is not JSON at all', () => {
    assert.throws(() => parseVerdict('The run went fine.'), /could not be parsed as JSON/)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test core/test/webmcp-eval-verdict.spec.js`
Expected: FAIL — cannot resolve `../webmcp-eval/verdict.js`.

- [ ] **Step 3: Write the verdict parser**

Create `core/webmcp-eval/verdict.js`:

```js
/**
 * @file Parse and validate a judge's verdict.
 *
 * The judge is a language model, so its output is untrusted text. Validating here means
 * a malformed verdict fails loudly at parse time rather than silently producing an empty
 * friction list that reads as "no problems found".
 */

/** @typedef {import('./cases/types.js').EvalCase} EvalCase */

const VERDICTS = ['satisfactory', 'unsatisfactory']
const SEVERITIES = ['high', 'medium', 'low']

/**
 * @param {string} text
 * @returns {object}
 */
export function parseVerdict (text) {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text)
  const raw = (fenced ? fenced[1] : text).trim()

  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error(`the judge's answer could not be parsed as JSON: ${raw.slice(0, 200)}`)
  }

  if (typeof parsed?.case !== 'string') throw new Error('verdict.case must be the case name')
  if (!VERDICTS.includes(parsed.verdict)) {
    throw new Error(`verdict must be one of ${VERDICTS.join(', ')}, got ${JSON.stringify(parsed.verdict)}`)
  }
  if (typeof parsed.reasoning !== 'string' || !parsed.reasoning.trim()) {
    throw new Error('verdict.reasoning must explain the verdict')
  }
  if (!Array.isArray(parsed.friction)) throw new Error('verdict.friction must be an array')

  for (const [i, point] of parsed.friction.entries()) {
    // Anchoring is what makes a friction point actionable: without a call number nobody
    // can find the response that misled the agent.
    if (!Number.isInteger(point?.call)) throw new Error(`friction[${i}].call must be the 1-based call number`)
    if (typeof point.tool !== 'string') throw new Error(`friction[${i}].tool must name the tool`)
    if (typeof point.observed !== 'string') throw new Error(`friction[${i}].observed must quote what the tool returned`)
    if (typeof point.inferred !== 'string') throw new Error(`friction[${i}].inferred must say what the agent apparently concluded`)
    if (!SEVERITIES.includes(point.severity)) {
      throw new Error(`friction[${i}].severity must be one of ${SEVERITIES.join(', ')}`)
    }
  }

  return parsed
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test core/test/webmcp-eval-verdict.spec.js`
Expected: PASS, 6 tests.

- [ ] **Step 5: Write the judge agent definition**

Create `.claude/agents/webmcp-eval-judge.md`:

```markdown
---
name: webmcp-eval-judge
description: Judges whether a WebMCP form-filling session was satisfactory, and reports friction anchored to individual tool calls.
tools: Read, Grep
---

You judge one recorded session in which an agent tried to fill a form using the
WebMCP tools of the json-layout library. You are given the user's goal, the form's JSON
schema, the full transcript of tool calls with their responses, and the run's metrics.

Your job is not to check the data against an expected answer — there isn't one. It is to
read the transcript and answer: **did this agent find its way through this protocol?**

Judge the session, not the agent. A run where the agent guessed a value that happened to
be right is unsatisfactory. A run where the agent could not proceed because a tool told
it something untrue is unsatisfactory, however sensibly the agent then behaved.

You may Read the tool implementations under `core/src/webmcp/` to explain *why* a
response misled the agent. Use that to be specific about cause; do not use it to excuse a
response that misled in practice.

Pay particular attention to:

- a tool response that is true but reads as something else — `No suggestions available`
  when the real reason is that another field must be filled first
- the agent inventing a value it could not have known
- paths the agent guessed wrongly, and whether the error told it enough to recover
- calls that bought no information, or repeated work already done
- the number of round-trips relative to what the form actually required

The metrics are evidence, not thresholds. A high call count on a genuinely large form is
fine; five calls to read five closed lists that the form already knew is not.

Answer with JSON and nothing else:

```json
{
  "case": "<case name as given>",
  "verdict": "satisfactory" | "unsatisfactory",
  "reasoning": "one paragraph on whether the session achieved the goal, and why",
  "friction": [
    {
      "call": 7,
      "tool": "getFieldSuggestions",
      "observed": "quote what the tool returned",
      "inferred": "what the agent apparently concluded from it",
      "severity": "high" | "medium" | "low"
    }
  ]
}
```

Every friction point must carry the 1-based number of the call that caused it. Report an
empty `friction` array if the session had none. Do not propose fixes — naming the
response and what it caused is the deliverable.
```

- [ ] **Step 6: Write the orchestration skill**

Create `.claude/skills/webmcp-eval/SKILL.md`:

```markdown
---
name: webmcp-eval
description: Run the WebMCP eval - dispatch an isolated runner subagent per case to fill a real form, then judge each transcript. Use when asked to evaluate the webmcp form tools, run the eval, or check whether an agent can drive json-layout forms.
---

# Running the WebMCP eval

Measures whether an agent can find its way through the WebMCP form-filling protocol,
by having one actually try and then judging the transcript.

## Before you start

The MCP servers are declared in `.mcp.json` and load at session start. If you do not see
`mcp__webmcp-eval-*` tools available, the session began before they were generated: run
`npm run webmcp-eval:config -w core`, then restart the session.

Each case's server holds one form state for the life of the session, so **each case can
be run once per session**. A second run of the same case would start from the first run's
data. To re-run, start a fresh session.

## Steps

1. Read the case list from `core/webmcp-eval/cases/index.js`. Note each case's `name` and
   `goal`.

2. Dispatch one runner per case, **in parallel, in a single message**. Use the agent type
   `webmcp-eval-runner-<case>` and pass **only the goal string** as the prompt.

   Do not add context. Do not mention json-layout, the eval, the schema, or what you know
   about the tools. The runner has no filesystem access by design; anything you tell it is
   the only thing it knows, and every extra sentence makes the result less like a real
   page visit.

3. When a runner finishes, its transcript is at `core/tmp/webmcp-eval-<case>.json`. Read
   it.

4. Dispatch a `webmcp-eval-judge` subagent per case. Give it, in the prompt: the goal, the
   case's schema, the transcript's `calls` array, and its `metrics`, `data` and `valid`
   fields. Ask for the JSON verdict its definition describes.

5. Write each verdict to `core/tmp/webmcp-eval-<case>.verdict.json`.

6. Run `npm run webmcp-eval:report -w core` and relay the summary.

## Reading the result

The friction list is the point. A verdict says a run went badly; a friction point says
which response misled the agent and what it concluded, which is what turns a run into a
change to a tool description or a tool's output.

Treat an unresolvable `getItems` list as a finding, not an environment problem. Without a
reachable data-fair those lists cannot resolve, and how the tools report that — and what
the runner does next — is one of the things worth measuring.
```

- [ ] **Step 7: Commit**

```bash
npm run quality
git add core/webmcp-eval/verdict.js core/test/webmcp-eval-verdict.spec.js .claude/agents/webmcp-eval-judge.md .claude/skills/webmcp-eval
git commit -m "feat(core): add the eval judge and its orchestration skill"
```

---

### Task 5: Verdict aggregation report

Replaces the budget-threshold scorer with a report over judge verdicts.

**Files:**
- Delete: `core/webmcp-eval/score.js`
- Create: `core/webmcp-eval/report.js`
- Create: `core/test/webmcp-eval-report.spec.js`
- Modify: `core/package.json` (`webmcp-eval:score` → `webmcp-eval:report`)
- Modify: `core/webmcp-eval/README.md`

**Interfaces:**
- Consumes: `parseVerdict` from Task 4, evidence files from Task 2
- Produces: `summarise(runs): { lines: string[], failed: boolean }` from `core/webmcp-eval/report.js`, where `runs` is `Array<{ evidence: object, verdict: object|null }>`

- [ ] **Step 1: Write the failing test**

Create `core/test/webmcp-eval-report.spec.js`:

```js
import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'

import { summarise } from '../webmcp-eval/report.js'

const run = (name, verdict, friction = []) => ({
  evidence: {
    case: name,
    goal: `fill the ${name} form`,
    metrics: { toolCalls: 12, outputBytes: 8000 },
    valid: true,
    calls: []
  },
  verdict: verdict ? { case: name, verdict, reasoning: 'because', friction } : null
})

describe('webmcp eval reporting', () => {
  it('should pass when every judged run was satisfactory', () => {
    const { failed } = summarise([run('contact', 'satisfactory')])
    assert.equal(failed, false)
  })

  it('should fail when any run was unsatisfactory', () => {
    const { failed } = summarise([run('contact', 'satisfactory'), run('charts', 'unsatisfactory')])
    assert.equal(failed, true)
  })

  it('should report metrics as context rather than as a judgement', () => {
    // Numbers describe the run; they never decide it.
    const { lines } = summarise([run('contact', 'satisfactory')])
    const text = lines.join('\n')
    assert.ok(text.includes('12 calls'))
    assert.ok(text.includes('8000 bytes'))
    assert.ok(!/allowed|budget|limit/.test(text), 'must not imply a threshold')
  })

  it('should list friction points with their call anchors', () => {
    const { lines } = summarise([run('charts', 'unsatisfactory', [
      { call: 7, tool: 'getFieldSuggestions', observed: 'No suggestions available', inferred: 'invented a value', severity: 'high' }
    ])])
    const text = lines.join('\n')
    assert.ok(text.includes('call 7'))
    assert.ok(text.includes('getFieldSuggestions'))
    assert.ok(text.includes('high'))
  })

  it('should fail when a run has no verdict', () => {
    // An unjudged run is not a passing run.
    const { failed, lines } = summarise([run('charts', null)])
    assert.equal(failed, true)
    assert.ok(lines.join('\n').includes('not judged'))
  })

  it('should fail when there is nothing to report', () => {
    const { failed } = summarise([])
    assert.equal(failed, true)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test core/test/webmcp-eval-report.spec.js`
Expected: FAIL — cannot resolve `../webmcp-eval/report.js`.

- [ ] **Step 3: Write the report module**

Create `core/webmcp-eval/report.js`:

```js
#!/usr/bin/env node
/**
 * @file Summarise judged eval runs.
 *
 * Deliberately has no thresholds. The old scorer failed a run whose call count exceeded
 * a number someone guessed; here the numbers are printed as context and the verdict is
 * the judge's. An unjudged run counts as a failure — a transcript nobody read is not
 * evidence of anything.
 *
 * Usage: npm run webmcp-eval:report -w core [case ...]
 */

import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { cases } from './cases/index.js'

const here = dirname(fileURLToPath(import.meta.url))

/**
 * @param {Array<{ evidence: object, verdict: object|null }>} runs
 * @returns {{ lines: string[], failed: boolean }}
 */
export function summarise (runs) {
  /** @type {string[]} */
  const lines = []
  let failed = false

  if (!runs.length) {
    lines.push('no runs found — see core/webmcp-eval/README.md for how to run the eval')
    return { lines, failed: true }
  }

  for (const { evidence, verdict } of runs) {
    const ev = /** @type {any} */(evidence)
    const metrics = ev.metrics ?? {}
    lines.push('')
    if (!verdict) {
      failed = true
      lines.push(`${ev.case}: not judged`)
    } else {
      const v = /** @type {any} */(verdict)
      if (v.verdict !== 'satisfactory') failed = true
      lines.push(`${ev.case}: ${v.verdict.toUpperCase()}`)
      lines.push(`  ${v.reasoning}`)
    }
    lines.push(`  goal: ${ev.goal}`)
    lines.push(`  ran ${metrics.toolCalls} calls, read ${metrics.outputBytes} bytes, form valid=${ev.valid}`)

    const friction = /** @type {any} */(verdict)?.friction ?? []
    if (friction.length) {
      lines.push('  friction:')
      for (const point of friction) {
        lines.push(`    [${point.severity}] call ${point.call} ${point.tool}: ${point.observed}`)
        lines.push(`      → ${point.inferred}`)
      }
    }
  }

  return { lines, failed }
}

/**
 * @param {string[]} names
 * @returns {Array<{ evidence: object, verdict: object|null }>}
 */
function loadRuns (names) {
  /** @type {Array<{ evidence: object, verdict: object|null }>} */
  const runs = []
  for (const name of names) {
    const evidencePath = join(here, '..', 'tmp', `webmcp-eval-${name}.json`)
    if (!existsSync(evidencePath)) continue
    const verdictPath = join(here, '..', 'tmp', `webmcp-eval-${name}.verdict.json`)
    runs.push({
      evidence: JSON.parse(readFileSync(evidencePath, 'utf8')),
      verdict: existsSync(verdictPath) ? JSON.parse(readFileSync(verdictPath, 'utf8')) : null
    })
  }
  return runs
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const wanted = process.argv.slice(2)
  const { lines, failed } = summarise(loadRuns(wanted.length ? wanted : cases.map((c) => c.name)))
  console.log(lines.join('\n'))
  process.exit(failed ? 1 : 0)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test core/test/webmcp-eval-report.spec.js`
Expected: PASS, 6 tests.

- [ ] **Step 5: Delete the old scorer and rename the script**

```bash
git rm core/webmcp-eval/score.js
```

In `core/package.json`, replace the `webmcp-eval:score` line with:

```json
    "webmcp-eval:report": "node webmcp-eval/report.js",
```

- [ ] **Step 6: Rewrite the README**

Replace `core/webmcp-eval/README.md` so it documents the judged flow. It must state: what a case is and that there is no expected data; that runs are performed by isolated runner subagents via the `/webmcp-eval` skill; that each case can be run once per session because its server holds one form state; that verdicts come from the judge and metrics are context, not thresholds; that `npm run webmcp-eval:report -w core` aggregates and exits non-zero on any unsatisfactory or unjudged run; and that `npm run webmcp-eval:config -w core` regenerates `.mcp.json` and the runner agents after a case change. Include the case table from the spec (`contact` small/fits, `calendar` large/fits, `charts` large/refused) and note that no `medium` band exists among the available real schemas.

- [ ] **Step 7: Verify the whole gate**

Run: `npm run quality`
Expected: lint clean, build clean, all tests pass.

- [ ] **Step 8: Commit**

```bash
git add core/webmcp-eval core/test core/package.json
git commit -m "feat(core): report judged eval runs instead of scoring against budgets"
```

---

## Self-Review

**Spec coverage**

| Spec section | Task |
|---|---|
| Case format, `expectedSchemaFits` | 1 |
| Vendored schemas, band findings | 1 |
| Runner isolation, generated config | 3 |
| Orchestration, one-run-per-session | 4 |
| Judge contract | 4 |
| Reporting | 5 |
| What stays deterministic | 1, 2 |

**Deferred deliberately** — `getItems` dependency chains, a standalone API-driven runner, and re-keying `getComplexity` are all listed Out of Scope in the spec and have no task here.

**Open risk carried into Task 3** — that `tools:` accepts `mcp__server__tool` entries is unverified. The generated definition is correct either way for the isolation guarantee, since that rests on the absence of filesystem tools. If a dispatched runner turns out to have no tools at all, the fallback is an agent definition with no `tools:` line, which inherits the session's tools; the config spec's forbidden-tool assertions must then be re-pointed at the dispatch instructions in the skill instead.
