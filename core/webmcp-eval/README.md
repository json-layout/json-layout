# WebMCP eval harness

Unit tests in `core/test/webmcp.spec.js` prove each tool returns the right shape. They
cannot tell you whether a form is *fillable*: whether an agent can find its way from a
plain-language goal to valid data through the WebMCP protocol, without getting misled by
a response along the way. That is what this harness measures.

## What a case is

`cases/index.js` holds a schema, a title and a goal phrased the way a user would phrase
it, and for the editing cases a document to start from. **There is no expected document.** A
run is judged by reading its transcript — what the agent asked, what each tool told it back,
and what it did next — not by comparing the final data to a blob written by whoever wrote the
case. A case may carry a few [checks](#checks) on the final data, which pin only facts the goal
itself states; they are scored beside the verdict, never instead of it.

| case | source | schema chars | layout nodes | starts from |
|---|---|---|---|---|
| `contact` | hand-written | 368 | 5 | empty |
| `calendar` | app-calendar, through the vjsf v2 compat layer | 12244 | 58 | empty |
| `charts` | app-charts (source schema) | 57330 | 286 | empty |
| `portal-page` | portals page editor | 285874 | 814 | empty |
| `charts-edit` | app-charts | 57330 | 286 | a configured chart |
| `portal-page-edit` | portals page editor | 285874 | 814 | a page of three elements |
| `portal-config-edit` | portals portal editor (14 tabs) | 125813 | 600 | a seeded portal's draft |
| `choropleth` | app-choropleth-map | — | — | a configured map |
| `portal-menu-catalog` | portal editor | 125813 | 600 | the seeded portal's draft |
| `portal-menu-explain` | portal editor | 125813 | 600 | the seeded portal's draft |
| `portal-page-catalog` | portals page editor | 285874 | 814 | a page of three elements |
| `charts-pie` | app-charts | 57330 | 286 | a configured chart |
| `data-fair-line` | data-fair REST dataset line schema (about 15 columns) | — | — | empty |

The four build cases measure construction; the edit cases measure the other half, which
is what a configuration editor mostly does. `portal-menu-catalog`, `portal-menu-explain`,
`portal-page-catalog` and `charts-pie` each target one judged failure (choosing among
options none of which is chosen yet, describing what a form can hold without changing it,
two options that look alike, switching a chart to another type). `data-fair-line` is the
record form of the next section's comparison: a loosely written forwarded email to enter
into a register, with a commune picked from a referential. The edit cases start from a document **an agent produced
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
They come from [data-fair](https://github.com/data-fair) and its applications:

| file | upstream repo | upstream path |
|---|---|---|
| `cases/schemas/app-charts.json` | `data-fair/app-charts` | `src/config/schema.json` |
| `cases/schemas/app-calendar.json` | `data-fair/app-calendar` | `public/config-schema.json` |
| `cases/schemas/data-fair-line.json` | `data-fair/data-fair` @ `feat-autonomous-agents` | served by `GET /api/v1/datasets/<id>/schema?mimeType=application/schema+json&extension=true&arrays=true` for the register of `simulations/runner/line-edition-fixtures.ts` |

`app-charts` is vendored from its **source** schema, not its published one:
`public/config-schema.json` there is a build artefact (`df-build-types && ncp
src/config/.type/resolved-schema.json public/config-schema.json`), so it is the resolved
schema — 185 660 characters against 29 472, for a byte-identical state projection.
`app-calendar` has no `src/config/schema.json`, so its published file is the source.

`app-calendar` is written for vjsf v2 (`x-fromUrl`, `x-itemKey`, `x-if`, ...), which a
real page translates through the compatibility layer before json-layout sees it. The case
applies the same layer, now `src/compat/v2.js` in this package — it was vendored here from
vjsf until it moved, and moving it means the eval tracks the layer rather than a pinned
copy of it. Compiled raw, the first judged run showed why this matters: the pickers rendered as plain sections and
`getFieldSuggestions` refused them, while the schema still showed the vendor keywords —
two surfaces contradicting each other on the same path.

`data-fair-line` is a REST dataset's line schema as data-fair serves it, read live on
2026-10-29 from a register of the line edition experiment. Two rewrites only: the commune
single-search URL becomes the relative `communes?q={q}` that the case's offline fixture
(`cases/data/communes.json`, real communes from geo.api.gouv.fr) answers, and the
referential's id becomes `communes` in the vendor keywords. data-fair already emits a
`layout.getItems` beside its `x-fromUrl`, so `v2compat` leaves the vendor keywords in
place. The case then applies what data-fair/mcp's `prepareEditorSchema`
(`src/editor-schema.ts`, branch `fix-editor-line-edition`) does before its editor compiles
the schema: `v2compat`, string layouts expanded, extension columns hidden, the form closed
with `additionalProperties: false`.

### Where the pickers fetch from

`calendar` and `data-fair-line` are served offline (see below). The other app schemas fetch their dataset and column pickers from relative `api/v1/...`
paths, as the deployed apps do. `EvalSession` resolves them against koumoul.com's public
data-fair instance by default, so those lists actually resolve during a judged run and
the goals name datasets that exist there. Each app case also carries the expression
`context` a deployed app has — the owner filter its dataset queries interpolate — because
without it the public instance answers a picker with its twelve newest matches and the
named dataset is never among them. Set `JL_WEBMCP_EVAL_DATA_FAIR` (a base URL
ending in `/`) in the environment before running to point at another instance. Live data
drifts, which is accepted for a case with no check on a picked value: a judged run is
already driven by a model, and the transcript carries its timestamp. The deterministic spec
never calls `getItems`, so CI stays offline.

A case that checks a value coming from a remote list cannot live with that drift, so it
declares `remote` and every arm answers its lists from the fixture, whatever the base URL
(`caseFetch` in `remote.js`; a URL the fixture does not know answers 404). Two cases do:

- `calendar`: its pickers are served from a capture of koumoul.com in
  `cases/data/calendar-remote/`, so its checks can name the dataset and column the goal
  means. `node webmcp-eval/capture-remote.js calendar` drives the form through the goal's
pickers against the live instance and rewrites the capture: one file per URL, keyed in
`index.json` by path and sorted query (see `remoteKey` in `remote.js`), responses whole.
  It is run by hand, never by tests; a URL it did not capture answers 404.
- `data-fair-line`: the commune referential is a function of the URL
  (`cases/data/communes.json`, real communes from geo.api.gouv.fr), answering as data-fair's
  single search does: every word of `q` in the name or starting the code, sorted on the
  code, ten results. The email says "St-Sébastien ... à côté de Nantes"; the commune the
  goal means, Saint-Sébastien-sur-Loire (44190), is not the first result of a naive query
  and a homonym sits beside it. This is the case the invented-code defect came from: in a
  data-fair experiment an agent whose search never surfaced the commune typed `44173` from
  memory and the form answered `valid, no errors`. A judge reading the transcript cannot
  tell a right code from a wrong one; a check can.

The app-calendar and app-charts schemas are labelled in French while their goals are in
English, as real pages of theirs are. The judge is told this so it does not score a translation step as protocol friction.

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

1. `npm run webmcp-eval:run -w core [case ...] [--variant v] [--arm form|session|plain|all]
   [--runs n]` spawns one headless `claude -p` subprocess per case, arm and repeat,
   concurrently, at most 6 at a time (`MAX_CONCURRENT_RUNS`; more trips rate limits and
   starves the machine, and a queue costs only wall-clock time). Each subprocess is passed
   a single inline MCP server config via `--strict-mcp-config --mcp-config` — one server
   definition, `page-form`, shared by every case — so there is no repository-level MCP server file
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

   The prompt and the tool list belong to the arm, see [Arms](#arms).

3. **Models.** `JL_WEBMCP_EVAL_MODEL=opus|sonnet|haiku` pins the runner's model, which is
   recorded per run and printed by the report. Running the suite on more than one tier is
   how this harness answers whether the protocol leans on a large model or carries the work
   itself — a question it should measure rather than presume.

4. **Variants.** `--variant no-guide` runs a case with its schema's `x-agent-guide` removed,
   same tools and same server as the control, so the two differ only in that guide. The
   machinery lives in `session.js` (`VARIANTS`, `applyVariant`, `evidenceName`); variant
   evidence lands beside the control as `webmcp-eval-<case>--<variant>.json` and the report
   prints both. Variants are about the form guide; a different tool surface is an arm.

   **Isolation.** The same for every arm. The run happens from a temporary directory
   outside this repository, with `--setting-sources=`. That is load-bearing, not hygiene: a runner launched from
   inside the repository inherits ~5.7k tokens of context, including a SessionStart
   hook and Claude Code's auto-memory index — and that index can itself name this eval,
   telling the runner the one thing the isolation guarantee exists to prevent it from
   learning. `--setting-sources=` alone does not remove auto-memory; the neutral
   working directory does, because auto-memory is keyed to the project directory. What
   remains is ~3.5k tokens of generic Claude Code boilerplate, left deliberately:
   removing it would need `--system-prompt` to replace the whole system prompt, which
   would make the runner unlike the agent a real page actually meets.

5. Each server records every call it receives to `core/tmp/webmcp-eval-<name>.json` as
   it goes — this is the evidence, not a score — together with the final data and the
   result of the case's checks. The launcher also writes a provenance sidecar,
   `core/tmp/webmcp-eval-<name>.run.json`, recording the resolved model, cost, turn count
   and any permission denials. The model is pinned by `JL_WEBMCP_EVAL_MODEL` (default
   `haiku`) rather than inheriting whatever model happened to launch the run, so verdicts
   from different models are never compared silently.
6. A `webmcp-eval-judge` subagent reads the goal, the schema, the recorded transcript and
   the arm's name and tool list, and returns a verdict — `satisfactory` or
   `unsatisfactory` — with reasoning and a list of friction points, each anchored to the
   call number that caused it. The skill dispatches one judge per run file and writes each
   verdict to `core/tmp/webmcp-eval-<name>.verdict.json`. **The judge is not told the
   result of the checks**: a verdict that knew the data was wrong would be read backwards
   from the outcome, and the case where a transcript reads well but the data is wrong is
   precisely the one worth seeing as a disagreement.

`<name>` is `<case>[--<variant>][--<arm>][.r<n>]`: the `form` arm carries no arm suffix
(its names predate the others), and `.r<n>` is added only when `--runs` is above 1. Parsing
a name back is `parseEvidenceName` in `session.js`.

Transcripts, sidecars and verdicts land in `core/tmp/` (gitignored) and are overwritten
per name, so re-running a case discards its previous run, provenance and verdict.

## Arms

An arm is a tool surface for the same case: same goal, same starting document, same remote
data, same model, same isolation. Only the tools and the system prompt differ. `--arm`
picks one (`form` by default) or `all`; `arms.js` holds the list and `createArm`.

| arm | tools | prompt |
|---|---|---|
| `form` | the WebMCP page tools: `getData`, `setData`, `describeState`, `openSection`, `setFieldValue`, `getFieldSuggestions`, `editArray` | the form runner's, then the form-filling guide |
| `session` | the same tools served by `@json-layout/agents` `FormSession` (no `openSection`), plus `saveForm` and `reloadForm` | the session runner's, then the session's own skill |
| `plain` | a JSON API: `readDocument`, `readSchema` (both by JSON pointer), `writeDocument`, `patchDocument` (RFC 7396 merge patch), `httpGet` | the plain runner's, a neutral description of the API, then the schema's `x-agent-guide` |

- **`form`** is what a page exposes: no save, the page persists by data binding. What the
  checks score is the form's data at the end.
- **`session`** is what a server exposes (openapi-mcp editor groups): the record only
  exists once saved, so the checks score the last saved document, or the starting one when
  nothing was saved. A case whose resource auto-saves (`saveMode: 'auto'`, today
  `portal-config-edit`) is `not runnable` on this arm until `FormSession` announces an
  auto mode (`SAVE_MODES`): the run is not faked, the sidecar records `notRunnable` and the
  reason, and the report prints it without failing.
- **`plain`** is the baseline the form tools claim to beat (`core/src/webmcp/README.md`
  opens on that claim): what a well-made JSON API offers, honestly described and not
  sabotaged. The agent reads the raw schema as the case holds it, vendor keywords included
  (`x-if`, `x-fromUrl`, switch layouts), and interprets them itself. Every write is
  validated with the same ajv function the form's root node uses and refused with one line
  per error, `400 Bad Request` as an API would. Display conditions and suggestion lists are
  not enforced, as an API would not. `httpGet` fetches the lists from the same base as the
  form's `getItems` (or the case's fixture), and the special URL `context` answers the
  case's expression `context`, because without it a case like `charts` cannot be done on
  this arm. A case may declare `apiAccepts`, the input tolerance of the real API:
  `data-fair-line` mirrors data-fair's line API, which takes a multi-valued column as a
  joined string and a number for a string column. The schema's `x-agent-guide` is domain
  text, the schema author's and not the tools', so the plain arm gets it verbatim; the
  form-tool guide stays with the form arms.

## Checks

A case may carry `checks`, evaluated on each run's final data. Each arm's session runs
them through `runChecks` (`checks.js`) and records the results in the evidence, so they
are the same on every arm whatever path the agent took:

| check | passes when |
|---|---|
| `{ path, equals }` | the value at the JSON pointer equals it (an expected string also matches the number with that rendering) |
| `{ path, values, separator? }` | the value, a list or a string joined with the separator, holds exactly these values, in any order and spelling |
| `{ path, contains }` | an item of the array at the pointer includes this partial object |
| `{ unchangedExcept: [pointers] }` | the data equals the starting data once those pointers are removed from both |

Checks pin facts the goal states, not style: the commune code, the digits of a SIRET, a
multi-valued field as its list, "everything outside the edited tab is untouched". They are
what lets a large-document edit be scored for collateral damage, which no transcript
reading would catch. `unchangedExcept` compares each arm to its own starting state as its
tools present it (the form after loading, with its defaults and dropped hidden branches;
the raw file for `plain`), so what the form normalizes on load is a fact about the library,
not an agent failure.

Checks and verdicts are separate measures. A failed check fails the report whatever the
verdict, and a `satisfactory` verdict with `CHECK FAILED` is printed as such: that
combination is the finding, a session that read well and ended with wrong data.

## Reporting

```bash
npm run webmcp-eval:report -w core            # every case in the registry
npm run webmcp-eval:report -w core -- charts  # only the cases named
npm run webmcp-eval:report -w core -- data-fair-line --arm plain  # only one arm
```

This aggregates the evidence and verdict files and prints, per run, the verdict and
reasoning, the failed checks, the goal, and the metrics (`toolCalls`, `outputBytes`,
`valid`) as *context*
— they describe the run, they never decide it. There is deliberately no budget or
threshold: a run within any call count can still be judged unsatisfactory, and a run
with a high call count on a genuinely large form can still be satisfactory.

After the runs of a case comes a side-by-side block, `<case> — comparison`, one row per arm
(and variant): number of runs, ranges over them of calls, output bytes, input tokens
(input plus cache reads and writes, what the model actually read) and cost, checks passed
per run, and verdict counts. A single run per arm is noise, so compare with `--runs 3` or
more, and read a difference as a finding only when it repeats and is large. Delete
`core/tmp/webmcp-eval-*` before a comparison, or the block mixes in leftovers.

The report — and its exit code — fails whenever any run is `unsatisfactory`, invalid,
unjudged, missing, or has a failed check:

| line | means |
|---|---|
| `<case>: UNSATISFACTORY` | the judge read the transcript and found the session did not get through the protocol |
| `<case>: invalid run` | the subprocess failed or a tool call was denied — the transcript is not judgeable |
| `<case>: not judged` | a transcript exists but its verdict file is missing, malformed, or written for another case |
| `<case>: CHECK FAILED` | a check on the final data failed, printed with the verdict |
| `<case>: not runnable` | the arm cannot take the case; the reason is printed and the report does not fail on it |
| `<case>: not run` | no transcript at all — the case's subprocess was never dispatched, or produced no transcript |

A transcript nobody read is not evidence of anything, and a case that never ran is not a
case that passed. Run labels carry the variant, arm and repeat, e.g. `data-fair-line (plain, r2)`. Each line also prints `started <timestamp>`: evidence files persist
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
