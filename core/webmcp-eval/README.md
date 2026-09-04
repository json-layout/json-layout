# WebMCP eval harness

Unit tests in `core/test/webmcp.spec.js` prove each tool returns the right shape. They
cannot tell you whether a form is *fillable*: whether an agent can find its way from a
plain-language goal to valid data through the WebMCP protocol, without getting misled by
a response along the way. That is what this harness measures.

## What a case is

`cases/index.js` holds a schema, a title and a goal phrased the way a user would phrase
it. **There is no expected data.** A run is judged by reading its transcript — what the
agent asked, what each tool told it back, and what it did next — not by comparing the
final data to a blob written by whoever wrote the case. The declared complexity band and
`expectedSchemaFits` are assertions about the case itself, checked deterministically in
`core/test/webmcp-eval.spec.js` so a case cannot drift into claiming a branch it never
reaches.

| case | source | chars | nodes | band | `getSchema` |
|---|---|---|---|---|---|
| `contact` | hand-written | 368 | 5 | small | returns whole |
| `calendar` | app-calendar | 5941 | 58 | large | returns whole |
| `charts` | app-charts (source schema) | 29472 | 286 | large | **refuses**, path navigation |

No `medium` band exists among the available real schemas. Band and schema size are also
independent of each other: `calendar` is `large` yet its schema still fits in a single
`getSchema` response, so `charts` is the only case that exercises the refusal path and
forces the agent to navigate by path instead.

## Deterministic runs (CI)

`core/test/webmcp-eval.spec.js` compiles every case and pins its declared band and
`getSchema` behaviour. No model is involved, so it is reproducible and runs with
`npm test`. It cannot tell you whether an agent can actually use the tools — that is the
judged flow below — only that each case is the case it claims to be.

## Judged runs

Real runs are driven by isolated coding-agent subagents, orchestrated through the
`/webmcp-eval` skill:

1. `.mcp.json` registers one stdio MCP server per case, `page-form-<case>`, generated
   from the case registry — the same tool descriptors, descriptions and skill text a
   browser page would expose. Run `npm run webmcp-eval:config -w core` to (re)generate
   `.mcp.json` and the per-case runner agent definitions after adding or changing a
   case, then restart the session so the new servers load.
2. The skill dispatches one `page-form-runner-<case>` subagent per case, in parallel,
   giving it only the case's goal — no mention of json-layout, the schema, or the tools
   available. Those runners have no filesystem access, so what they see is what a real
   page visit would give them.
3. Each server records every call it receives to `core/tmp/webmcp-eval-<case>.json` as
   it goes — this is the evidence, not a score.
4. Because a case's server holds one form's state for the life of the session, **each
   case can be run at most once per session**. A second dispatch against the same case
   would continue from the first run's data rather than starting clean. To re-run a
   case, start a fresh session.
5. A `webmcp-eval-judge` subagent reads the goal, the schema and the recorded transcript
   for each case, and returns a verdict — `satisfactory` or `unsatisfactory` — with
   reasoning and a list of friction points, each anchored to the call number that caused
   it. The skill writes each verdict to
   `core/tmp/webmcp-eval-<case>.verdict.json`.

Transcripts and verdicts land in `core/tmp/` (gitignored) and are overwritten per case,
so re-running a case discards its previous run and verdict.

## Reporting

```bash
npm run webmcp-eval:report -w core            # every case with a transcript
npm run webmcp-eval:report -w core -- charts  # one case
```

This aggregates the evidence and verdict files and prints, per case, the verdict and
reasoning, the goal, and the metrics (`toolCalls`, `outputBytes`, `valid`) as *context*
— they describe the run, they never decide it. There is deliberately no budget or
threshold: a run within any call count can still be judged unsatisfactory, and a run
with a high call count on a genuinely large form can still be satisfactory.

The report — and its exit code — fails whenever any run is `unsatisfactory` **or**
unjudged. A transcript nobody read is not evidence of anything, so a missing or
unreadable verdict counts the same as a bad one.

## Reading a result

The friction list is the point. A verdict says a run went badly; a friction point says
which response misled the agent and what it apparently concluded from it — that is what
turns a run into a change to a tool description or a tool's output, rather than a number
to shrug at. Compare a friction point against the tool implementation under
`core/src/webmcp/` to judge whether the response was actually misleading or merely
terse.
