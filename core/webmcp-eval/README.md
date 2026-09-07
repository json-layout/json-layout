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

### Where the vendored schemas came from

Copies live in `cases/schemas/`, pinned so a run today is comparable to one months later.
Both come from the [data-fair](https://github.com/data-fair) applications:

| file | upstream repo | upstream path |
|---|---|---|
| `cases/schemas/app-charts.json` | `data-fair/app-charts` | `src/config/schema.json` |
| `cases/schemas/app-calendar.json` | `data-fair/app-calendar` | `public/config-schema.json` |

`app-charts` is vendored from its **source** schema, not its published one:
`public/config-schema.json` there is a build artefact (`df-build-types && ncp
src/config/.type/resolved-schema.json public/config-schema.json`), so it is the resolved
schema — 185 660 characters against 29 472, for a byte-identical state projection.
`app-calendar` has no `src/config/schema.json`, so its published file is the source.

Both are labelled in French while the goals are in English, as real pages of theirs are.
The judge is told this so it does not score a translation step as protocol friction.

## Deterministic runs (CI)

`core/test/webmcp-eval.spec.js` compiles every case and pins its declared band and
`getSchema` behaviour. No model is involved, so it is reproducible and runs with
`npm test`. It cannot tell you whether an agent can actually use the tools — that is the
judged flow below — only that each case is the case it claims to be.

## Judged runs

Real runs are driven by isolated coding-agent subagents, orchestrated through the
`/webmcp-eval` skill (if that command does not resolve, follow
`.claude/skills/webmcp-eval/SKILL.md` directly — it is the same procedure):

1. `.mcp.json` registers one stdio MCP server per case, `page-form-<case>`, generated
   from the case registry — the same tool descriptors, descriptions and skill text a
   browser page would expose. Run `npm run webmcp-eval:config -w core` to (re)generate
   `.mcp.json` and the per-case runner agent definitions after adding or changing a
   case, then restart the session so the new servers load.

   `.mcp.json` sits at the repository root because that is where Claude Code reads it,
   so **every contributor session in this repository starts three extra stdio node
   processes**, one per case. They are cheap (a compiled form each, idle until called)
   and they must exist at session start: MCP servers connect once, when the session
   opens, so a server generated mid-session is not available until the next one. That is
   the trade for being able to dispatch a runner without any setup step.

2. The skill dispatches one `page-form-runner-<case>` subagent per case, in parallel,
   giving it only the case's goal — no mention of json-layout, the schema, or the tools
   available. Those runners have no filesystem access, so what they see is close to what
   a real page visit would give them.

   **Residual leakage.** "Close to", not "identical to": Claude Code injects its own
   preamble into every subagent, including an environment block naming the working
   directory. A runner therefore knows it is inside the json-layout repository, and no
   rename of a generated identifier can remove that inference. What the harness does
   guarantee is that the runner can read nothing — not the case registry, not the tool
   implementations, not another case — and that nothing generated here (server name, tool
   names, agent name, description or prompt) tells it that it is being evaluated.

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
npm run webmcp-eval:report -w core            # every case in the registry
npm run webmcp-eval:report -w core -- charts  # only the cases named
```

This aggregates the evidence and verdict files and prints, per case, the verdict and
reasoning, the goal, and the metrics (`toolCalls`, `outputBytes`, `valid`) as *context*
— they describe the run, they never decide it. There is deliberately no budget or
threshold: a run within any call count can still be judged unsatisfactory, and a run
with a high call count on a genuinely large form can still be satisfactory.

The report — and its exit code — fails whenever any run is `unsatisfactory`, unjudged,
or missing:

| line | means |
|---|---|
| `<case>: UNSATISFACTORY` | the judge read the transcript and found the session did not get through the protocol |
| `<case>: not judged` | a transcript exists but its verdict file is missing, malformed, or written for another case |
| `<case>: not run` | no transcript at all — the case never dispatched, usually because its MCP server was not loaded |

A transcript nobody read is not evidence of anything, and a case that never ran is not a
case that passed. Each line also prints `started <timestamp>`: evidence files persist
across sessions and are only overwritten when a case actually runs, so the timestamp is
what tells a leftover transcript from a fresh one. The `/webmcp-eval` skill deletes
`core/tmp/webmcp-eval-*` before dispatching for the same reason.

## Reading a result

The friction list is the point. A verdict says a run went badly; a friction point says
which response misled the agent and what it apparently concluded from it — that is what
turns a run into a change to a tool description or a tool's output, rather than a number
to shrug at. Compare a friction point against the tool implementation under
`core/src/webmcp/` to judge whether the response was actually misleading or merely
terse.
