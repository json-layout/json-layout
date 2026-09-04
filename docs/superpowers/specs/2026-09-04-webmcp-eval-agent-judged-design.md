# Agent-Driven, LLM-Judged WebMCP Eval

## Overview

Replace the WebMCP eval harness's deterministic scoring with a real agent run judged
by an LLM. The current harness poses a form-filling goal, compares the resulting data
against a hardcoded `expected` blob, and checks tool-call and output-byte counts
against fixed budgets. That design cannot answer the question the harness exists to
ask — *did an agent find its way through this protocol?* — because nothing in it ever
plays the agent.

Two changes follow from that. Runs are performed by a subagent with **no filesystem
access**, so it cannot read the expected data, the tool implementations, or the review
report that motivated this work. Verdicts are produced by a second subagent that reads
the transcript and decides whether the session was satisfactory, with the recorded
measurements as evidence rather than as thresholds.

### Why the current design fails

A live run of the `dataset` case exposed three defects at once, none of which the
deterministic suite could see:

- The case is classified `medium` (26 `normalizedLayouts`), while its test is named
  "should fill the large form field by field" and its README entry claims the schema
  is too large for `getSchema`. Both are false.
- Its schema returns whole at 1621 characters, against a 20 000 limit, so the
  path-navigation branch is never exercised. **No case in the harness is `large`.**
- It completed in 4 calls of an allowed 16 and 2906 bytes of an allowed 40 000. Budgets
  that loose cannot detect a regression.

The suite passed because it replays sequences written in the same sitting as the
fixtures. It confirmed the sequences worked; it never asked whether the case was the
case it claimed to be.

## Requirements

- Runs are performed by a subagent that cannot read the repository
- The runner is given only a user-phrased goal, and is not told it is being evaluated
- Verdicts come from an LLM judge, not from comparison against expected data
- The judge produces friction points anchored to specific tool calls
- Measurements (call count, output bytes, final data, validity) are recorded and passed
  to the judge as evidence, and are not pass/fail gates
- Case schemas are real, vendored, and pinned
- CI keeps a deterministic guard over everything that does not need a model
- Cases declare their complexity band, and CI asserts the declaration is true

## Case Format

`expected`, `expectedIsPartial` and `budget` are removed. A case carries the minimum
needed to pose a task and to verify in CI that it is the case it claims to be.

```js
{
  name: 'charts',
  title: 'chart configuration',          // WebMCP dataTitle
  schema: <loaded from schemas/app-charts.json>,
  data: {},                              // initial form state
  goal: 'Show average PM10 by city as a bar chart, from the air quality dataset.',
  expectedComplexity: 'large',           // asserted in CI, never read at runtime
  expectedSchemaFits: false              // does getSchema return the whole schema?
}
```

`expectedSchemaFits` exists because complexity band and schema size are independent, and
conflating them is what let the old `dataset` case claim a branch it never reached. A
case can be `large` by node count while its schema still fits under `SCHEMA_MAX_LENGTH`
and comes back whole. Only a case with `expectedSchemaFits: false` exercises the
path-navigation branch.

`goal` is the only text the runner ever sees. It must read as a user request, carry no
tool names, and describe an outcome rather than a procedure.

### Vendored schemas

Real schemas live in `core/webmcp-eval/cases/schemas/`, pinned so a run today is
comparable to one months later.

Measured by compiling each candidate with this branch:

| case | source file | chars | nodes | band | `getSchema` |
|------|-------------|-------|-------|------|-------------|
| `charts` | `app-charts/src/config/schema.json` | 29 472 | 286 | large | **refuses**, path navigation |
| `calendar` | `app-calendar/public/config-schema.json` | 5 941 | 58 | large | returns whole |
| `contact` | hand-written | 368 | 5 | small | returns whole |

**Vendor the source schema, not the published one.** `app-charts/public/config-schema.json`
is not the source: its build script is `df-build-types && ncp src/config/.type/resolved-schema.json
public/config-schema.json`, so the published file *is* the resolved schema. The true
source is `src/config/schema.json`, and the difference is 29 472 characters against
185 660 — 6× the weight, for what the review found to be a byte-identical state
projection. `app-calendar` has no `src/config/schema.json`, so its published file is
used.

Two findings this measurement forced, both worth keeping:

- **No `medium` band exists among the available real schemas** — they land at 5, 58 and
  286 nodes. `expectedComplexity` records what is true rather than inventing a case to
  fill a band, and the absence is itself evidence for the review's finding that the
  heuristic no longer separates anything.
- **`calendar` is `large` yet its schema fits.** Band and schema size are independent,
  which is why `expectedSchemaFits` is a separate field and why only `charts` covers the
  refusal path.

`app-charts` also emits `unknown format "hexcolor" ignored` warnings on compile — the
class of silent component degradation the review flagged, out of scope here but visible
in every run against this case.

Only `contact` stays hand-written, as a deliberate small-band control. The existing
`team` and `dataset` cases are removed: both are synthetic, neither reaches the band it
was written for, and the array editing `team` covered is present in the real schemas
that replace it. If a first run shows the vendored schemas exercise no `editArray`
path, a fourth case is added rather than `team` being restored — a case whose schema
provokes the behaviour is worth more than one built to demonstrate it.

Runs will encounter `getItems` lists whose URLs cannot resolve without a reachable
data-fair. That is not a defect of the harness: it is the exact condition the review
identified as the costliest failure, where the tool answers `No suggestions available`
instead of naming the field it depends on. Observing how a runner reacts is a purpose
of the eval, not an obstacle to it.

## Runner Isolation

One agent definition per case, so a runner is only ever exposed to one form. The
MCP server (and therefore every tool name) is named `page-form-<case>`, not
`webmcp-eval-<case>`: tool names sit in the runner's live context the same way the
prompt body does, so a runner-visible identifier that read "eval" would defeat the
guarantee below just as surely as a prompt that said so directly.

```
.claude/agents/page-form-runner-charts.md
---
name: page-form-runner-charts
tools: mcp__page-form-charts__getData, mcp__page-form-charts__setFieldValue, ...
---
You are helping a user fill in a form on the page they are viewing.
```

The isolation guarantee is the **absence** of `Read`, `Grep`, `Bash` and `WebFetch`.
That holds regardless of how MCP tool names resolve in the `tools:` list, which is the
one mechanism detail to verify before building on it. If MCP names cannot be enumerated
there, the fallback is an agent definition that grants no filesystem tools at all and
inherits MCP access — the guarantee is unchanged.

Three properties make a run trustworthy:

- the runner is granted no filesystem, shell or network tools, so it cannot read
  `cases/index.js`, `src/webmcp/`, or the review report
- no generated surface the runner can see carries evaluation language: the MCP server
  name, every tool name derived from it, and the agent's `name`, `description` and prompt
  body are all asserted leak-free in `core/test/webmcp-eval-config.spec.js`. The tool
  descriptions and the fill-form skill text are not generated here at all — they are the
  ones `src/webmcp/` gives a browser page, which is the point of running against them
- the goal string is the only text *this harness* gives it: nothing about the case, the
  schema, the tools, or the fact that a run is being judged

### Residual leakage

The goal string is not the runner's only input in absolute terms, and the spec should not
claim it is. Claude Code injects its own preamble into every subagent, including an
environment block naming the working directory (`/home/alban/github/json-layout`). A
runner therefore knows it is inside the json-layout repository while holding tools named
`page-form-*`, and could in principle infer what it is participating in. No rename of a
generated identifier removes that inference; only a runner dispatched outside this
repository would.

What holds is narrower and still worth having: the runner cannot *read* anything —
neither the goal it was not given, the expected behaviour, the tool implementations, nor
another case — and nothing this harness writes tells it that it is being evaluated.

### Generated configuration

`core/webmcp-eval/generate-config.js` writes `.mcp.json` and the per-case runner agent
definitions from `cases/index.js`. Generating both from one source prevents the drift
that would silently break isolation — an agent definition naming a server that no
longer exists yields a runner with no tools rather than a visible error.

## Orchestration

A `/webmcp-eval` skill drives a session:

1. Dispatch one runner subagent per case, in parallel, each handed only its `goal`.
2. Each runner drives its own case's MCP server. Per-case server processes are what
   make parallel runs safe: one form state per process, no interference.
3. On completion, dispatch one judge subagent per case with that case's evidence.
4. Aggregate verdicts and friction into a report.

**One run per case per session.** A server process holds a single form state, so a
second run of the same case would start from the first run's data. Re-running requires
a fresh session. This is a deliberate trade for the isolation that per-case processes
provide.

## Judge Contract

A `webmcp-eval-judge` subagent receives, in its prompt: the goal, the case schema, the
full transcript (each call's tool, arguments, response text and byte size), and the
run metrics (call count, total output bytes, final data, validity flag).

```json
{
  "verdict": "satisfactory | unsatisfactory",
  "reasoning": "one paragraph on whether the session achieved the goal",
  "friction": [
    {
      "call": 7,
      "tool": "getFieldSuggestions",
      "observed": "No suggestions available",
      "inferred": "concluded the field was free-text and invented a value",
      "severity": "high | medium | low"
    }
  ]
}
```

The friction list is the deliverable. A verdict alone says a run went badly; a friction
point says which response misled the agent and what it apparently concluded, which is
what turns a run into a change to a tool description.

Unlike the runner, the judge is granted `Read`. It needs the tool implementation to
explain *why* a response misled rather than only that it did. This admits a mild pull
toward excusing the tools; specificity is judged the better trade, and the judge never
sees the runner's isolation constraint because it is not the thing under test.

Verdicts are written to `core/tmp/webmcp-eval-<case>.verdict.json`.

## Reporting

`score.js` becomes `report.js`. It aggregates verdicts and friction across every case
with a transcript, prints the measurements as context rather than as judgements, and
exits non-zero if any verdict is `unsatisfactory`. `EvalSession.score()` is removed;
`EvalSession.report()` becomes a transcript dump.

## What Stays Deterministic

`core/test/webmcp-eval.spec.js` drops every `expected`-matching sequence and every
budget assertion, and keeps what remains honest without a model:

- every case's schema compiles
- **each case lands in the complexity band it declares** — the check that catches a
  mislabelled case, which is how the current `dataset` defect went unnoticed
- **`getSchema` matches each case's `expectedSchemaFits`** — a case declaring `false`
  must actually refuse and offer sub-paths, one declaring `true` must return the whole
  schema. Kept separate from the band assertion because `calendar` proves the two can
  disagree
- tools register with the expected names, including the skill
- the session records call costs, and reports an unknown tool as a failed call rather
  than throwing

These run free on every commit and need no model. The agent-driven eval is a separate,
deliberate act.

## Files

| action | path |
|--------|------|
| add | `core/webmcp-eval/cases/schemas/*.json` |
| add | `core/webmcp-eval/generate-config.js` |
| add | `.claude/agents/page-form-runner-<case>.md`, `.claude/agents/webmcp-eval-judge.md` |
| add | `.claude/skills/webmcp-eval/SKILL.md` |
| rewrite | `core/webmcp-eval/cases/index.js`, `cases/types.ts` |
| rewrite | `core/webmcp-eval/session.js` (drop scoring) |
| rewrite | `core/webmcp-eval/score.js` → `report.js` |
| rewrite | `core/test/webmcp-eval.spec.js` |
| rewrite | `core/webmcp-eval/README.md` |
| regenerate | `.mcp.json` |
| update | `core/package.json` (`webmcp-eval:score` → `webmcp-eval:report`) |

## Out of Scope

- **A standalone Node runner driving an API tool-loop.** Would make the eval CI-able and
  let models be pinned and compared, which the review's big-model/small-model question
  eventually needs. Deferred: it adds an SDK dependency to a package with almost none,
  and reimplements an agent loop already available. Nothing here blocks adding it later
  against the same cases and judge prompt.
- **`getItems` dependency chains.** The review found 45% of real option lists resolve
  only after another field is written, and that no host-side patch can reproduce that.
  Covering it needs mocked `getItems` URLs (`nock` is already a core devDependency).
  The vendored real schemas contain such chains, so runs will encounter them; asserting
  on them deterministically is separate work.
- **Re-keying `getComplexity`.** The review found it classifies 25 of 30 real apps as
  `large`, so `expectedComplexity` inherits a measure known to be weak. Cases still
  assert against today's behaviour; changing the heuristic is a separate decision.
