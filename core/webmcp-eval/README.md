# WebMCP eval harness

Unit tests in `core/test/webmcp.spec.js` prove each tool returns the right shape. They
cannot tell you whether a form is *fillable*: whether an agent can find its way from a
plain-language goal to valid data through the WebMCP protocol, without getting misled by
a response along the way. That is what this harness measures.

## What a case is

`cases/index.js` holds a schema, a title and a goal phrased the way a user would phrase
it, and for the editing cases a document to start from. **There is no expected data.** A run
is judged by reading its transcript — what the agent asked, what each tool told it back, and
what it did next — not by comparing the final data to a blob written by whoever wrote the
case.

| case | source | schema chars | layout nodes | starts from |
|---|---|---|---|---|
| `contact` | hand-written | 368 | 5 | empty |
| `calendar` | app-calendar, through the vjsf v2 compat layer | 12244 | 58 | empty |
| `charts` | app-charts (source schema) | 57330 | 286 | empty |
| `portal-page` | portals page editor | 285874 | 814 | empty |
| `charts-edit` | app-charts | 57330 | 286 | a configured chart |
| `portal-page-edit` | portals page editor | 285874 | 814 | a page of three elements |

The four build cases measure construction; the two edit cases measure the other half, which
is what a configuration editor mostly does. Both start from a document **an agent produced
through these tools** and we kept — a starting document written by hand is a guess about what
the form accepts, and one that is subtly invalid measures the harness rather than the
protocol. They are also the only cases that reach `editArray`'s `remove`.

The model is pinned by `JL_WEBMCP_EVAL_MODEL` (`opus`, `sonnet`, `haiku`) and recorded per
run, so runs are comparable across time and across tiers. **The default is `haiku`, the
smallest**: a protocol that carries a small model carries a large one, and the reverse is not
true — what a big model works out for itself is what hides an unstated dependency or an
ambiguous message. It is also what makes the suite cheap enough to run often, which is the
real constraint here: $0.25 against $0.84 for the same six cases. Pin a larger tier when a
finding needs checking against one.

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

`app-calendar` is written for vjsf v2 (`x-fromUrl`, `x-itemKey`, `x-if`, ...), which a
real page translates through vjsf's compatibility layer before json-layout sees it. The
case applies the same layer, vendored as `cases/vjsf-compat-v2.js` from vjsf's
`lib/src/compat/v2.js` and pinned for the same reason the schemas are. Compiled raw, the
first judged run showed why this matters: the pickers rendered as plain sections and
`getFieldSuggestions` refused them, while the schema still showed the vendor keywords —
two surfaces contradicting each other on the same path.

### Where the pickers fetch from

Both app schemas fetch their dataset and column pickers from relative `api/v1/...`
paths, as the deployed apps do. `EvalSession` resolves them against koumoul.com's public
data-fair instance by default, so those lists actually resolve during a judged run and
the goals name datasets that exist there. Each app case also carries the expression
`context` a deployed app has — the owner filter its dataset queries interpolate — because
without it the public instance answers a picker with its twelve newest matches and the
named dataset is never among them. Set `JL_WEBMCP_EVAL_DATA_FAIR` (a base URL
ending in `/`) in the environment before running to point at another instance. Live data
drifts, which is accepted: a judged run is already driven by a model, and the transcript
carries its timestamp. The deterministic spec never calls `getItems`, so CI stays
offline.

Both are labelled in French while the goals are in English, as real pages of theirs are.
The judge is told this so it does not score a translation step as protocol friction.

## Deterministic runs (CI)

`core/test/webmcp-eval.spec.js` compiles every case, checks the vendored pickers still
resolve as item lists, and keeps the case set spanning both ends of the size range. No model
is involved, so it is reproducible and runs with `npm test`. It cannot tell you whether an
agent can actually use the tools — that is the judged flow below — only that each case is the
case it claims to be.

## Judged runs

Real runs are orchestrated through the `/webmcp-eval` skill (if that command does not
resolve, follow `.claude/skills/webmcp-eval/SKILL.md` directly — it is the same
procedure):

1. `npm run webmcp-eval:run -w core [case ...]` spawns one headless `claude -p`
   subprocess per case, concurrently. Each subprocess is passed a single inline MCP
   server config via `--strict-mcp-config --mcp-config` — one server definition,
   `page-form`, shared by every case — so there is no repository-level MCP server file
   to generate or register, and no per-case setup step. Which case a subprocess serves is
   chosen by the `JL_WEBMCP_EVAL_CASE` environment variable set on the `claude` process,
   which its MCP server child inherits; the runner itself never sees a case identifier.

   A fresh OS process per run means clean form state and a freshly imported `core/src`
   for every run, so a case can be re-run any number of times and a run always reflects
   the current code and case registry — nothing is pinned to what was true when a
   session opened.

2. Each runner has no built-in tools at all (`--tools ""`) and no other reachable MCP
   server (`--strict-mcp-config`); `--allowedTools` names exactly the `mcp__page-form__*`
   tools the case's server registers — the same descriptors and descriptions a browser
   page would expose.

   Its prompt is the case's goal plus the form-filling guide, which is how production
   delivers it: pages set `includeSubAgent`, whose tool hands a runner `{ prompt, tools }`
   — the guide as prompt, not as something to go and fetch. The eval used to register a
   `fillFormSkill` tool instead, and measured a configuration nobody ships: every
   contaminated runner called it and no clean one ever did, because the tool only looked
   load-bearing to agents carrying an "always invoke a skill first" instruction.

   Nothing else reaches the runner — no mention of json-layout, the schema, or the case.

3. **Models.** `JL_WEBMCP_EVAL_MODEL=opus|sonnet|haiku` pins the runner's model, which is
   recorded per run and printed by the report. Running the suite on more than one tier is
   how this harness answers whether the protocol leans on a large model or carries the work
   itself — a question it should measure rather than presume.

4. **Variants.** The machinery for running a case under a second tool configuration is
   still in `session.js` (`VARIANTS`, `applyVariant`, `evidenceName`), but there is nothing
   to vary since `getSchema` was removed: every page now gets the same six tools. Variant
   evidence would land beside the control as `webmcp-eval-<case>--<variant>.json`.

   **Isolation.** The run happens from a temporary directory outside this repository,
   with `--setting-sources=`. That is load-bearing, not hygiene: a runner launched from
   inside the repository inherits ~5.7k tokens of context, including a SessionStart
   hook and Claude Code's auto-memory index — and that index can itself name this eval,
   telling the runner the one thing the isolation guarantee exists to prevent it from
   learning. `--setting-sources=` alone does not remove auto-memory; the neutral
   working directory does, because auto-memory is keyed to the project directory. What
   remains is ~3.5k tokens of generic Claude Code boilerplate, left deliberately:
   removing it would need `--system-prompt` to replace the whole system prompt, which
   would make the runner unlike the agent a real page actually meets.

3. Each server records every call it receives to `core/tmp/webmcp-eval-<case>.json` as
   it goes — this is the evidence, not a score. The launcher also writes a provenance
   sidecar, `core/tmp/webmcp-eval-<case>.run.json`, recording the resolved model, cost,
   turn count and any permission denials. The model is pinned by `JL_WEBMCP_EVAL_MODEL`
   (default `opus`) rather than inheriting whatever model happened to launch the run, so
   verdicts from different models are never compared silently.
4. A `webmcp-eval-judge` subagent reads the goal, the schema and the recorded transcript
   for each case, and returns a verdict — `satisfactory` or `unsatisfactory` — with
   reasoning and a list of friction points, each anchored to the call number that caused
   it. The skill writes each verdict to
   `core/tmp/webmcp-eval-<case>.verdict.json`.

Transcripts, sidecars and verdicts land in `core/tmp/` (gitignored) and are overwritten
per case, so re-running a case discards its previous run, provenance and verdict.

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

The report — and its exit code — fails whenever any run is `unsatisfactory`, invalid,
unjudged, or missing:

| line | means |
|---|---|
| `<case>: UNSATISFACTORY` | the judge read the transcript and found the session did not get through the protocol |
| `<case>: invalid run` | the subprocess failed or a tool call was denied — the transcript is not judgeable |
| `<case>: not judged` | a transcript exists but its verdict file is missing, malformed, or written for another case |
| `<case>: not run` | no transcript at all — the case's subprocess was never dispatched, or produced no transcript |

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
