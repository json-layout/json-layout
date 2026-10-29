# WebMCP form tools — what they are and why they exist

A page that renders a json-layout form can expose it to an agent as a set of MCP tools.
This is the design of those tools, the choices behind them, and how far they have actually
been validated.

## Why not just hand the model the schema and let it emit JSON?

This is the first question anyone asks, and for a small form it is the right instinct —
`contact` is a 368-character schema with five fields, and a model would fill it blind.
The suite exists because real configuration forms are not that, and four properties break
the blind approach. Under each, what the first comparison against a plain JSON API measured
([baseline 2026-10-29](../../webmcp-eval/baselines/2026-10-29-plain-json-arm/README.md): haiku only, 3 runs per arm, every run of every arm correct, so
these are differences in effort and cost, not in outcome):

**1. Half the schema does not apply until you have chosen something.** `charts` is five
levels of nested `oneOf`: which fields are legal depends on the chart type, then on the
data-preparation mode, then on the grouping kind. `calendar` hides a whole section behind
`x-if: datasets.0.isRest` — the crowd-sourcing settings do not exist as valid keys until a
REST dataset is picked. A model emitting a document in one shot has to guess which branch's
fields are legal; the tools let it activate a branch and be told what that branch contains.
*Measured: tie.* With the raw schema the plain arm wrote `calendar`'s `x-if` field together
with the value that opens it, and a valid discriminated menu item on `portal-config-edit`, in
every run; no case asked for a branch the document did not already make obvious.

**2. The accepted values are not in the schema at all.** `calendar`'s label field takes its
options from `${rootData.datasets[0].href}/schema?calculated=false` — an HTTP request whose
URL is built from another field's current value. No amount of schema reading yields
`nomevenement`. `getFieldSuggestions` performs that lookup.
*Measured: tie, and "nothing else can" did not hold.* Given the URL templates in the raw
schema and an HTTP GET, the plain arm built the lookups itself in 9 of 9 runs (communes,
dataset listing, column listing, portal pages) and picked the same values.

**3. The values can be far larger than the answer.** A picked data-fair dataset is a 12,486-
character object of column definitions. The agent never handles it: it applies suggestion
index 0 and the form stores the object. Emitting that document by hand would mean
reproducing 12 KB of column metadata verbatim.
*Measured: partly.* The API accepted a three-key dataset reference, so two plain runs out of
three never reproduced the object; the third copied it and was the suite's most expensive run.
The plain documents differ from what the form stores, and whether the application renders
from them is not checked.

**4. The schema is bigger than the whole conversation.** `portal-page` is 285,874 characters,
814 layout nodes. A complete `portal-page` session costs about 7.4 KB of tool output. Sending
the schema once would cost roughly forty times the entire interaction.
*Measured on `portal-config-edit` only (128 KB raw schema): tie* on outcome and input tokens,
9 calls against 10–12. The figure above was not reproduced because the client did not let the
schema into the conversation: token counts show neither arm's largest response (128 KB
`readSchema`, 62 KB `describeState`) reached the model whole. On a small edit the form side
is cheaper: `charts-edit` took about half the plain arm's input tokens in every run.

There is a fifth reason that matters in production: the form is *live*. Writes land in the
state a user is looking at, validation runs on every one, and the errors come back scoped to
what just changed. The agent is editing a form, not drafting a file.
*Measured: mixed.* Scoped errors and "N field(s) became available" did steer recoveries; but
one whole-document 400 was as useful to the plain arm, and the plain arm's only real miss —
a write that cut a dataset's column list, accepted by the schema — is a value the form's
suggestion would have stored whole; the agent caught it itself.

The comparison also showed what is not among these reasons. **On a flat record built from
loose text, the plain arm wins clearly**: `data-fair-line` (15 columns, a remote referential)
took 4 calls and ~30k input tokens in all three plain runs, against 15–18 calls and 46–57k
for the page tools and 8–19 calls and 63–79k for `FormSession`. Two form-tool defects caused
most of the difference: a 14-digit SIRET reached `setFieldValue` as a JSON number in all six
page-tool and session runs and was refused, the quoted retry stored the quotes, and only `setData` fixed it;
and memorised suggestions were dropped by a `setData` that did not touch the field.

## The tools

Six, and one guide. The guide is not a tool — production pages pass it to the agent as its
prompt via `includeSubAgent`.

| tool | what it is for |
|---|---|
| `describeState` | every field with path, type, constraints, current value, errors. The starting point and the only way to see the form. |
| `setFieldValue` | write one field; switch a variant by writing its index. |
| `setData` | write the whole document at once, for when the goal already contains every value. |
| `editArray` | add or remove an item; an added item is activated and its fields returned. |
| `getFieldSuggestions` | fetch the accepted values of a field whose list is remote. |
| `getData` | the data itself, whole or at a path, for when the values are wanted rather than a description of them. |

## Choices, and what justified them

Each of these was measured, most of them after getting it wrong first.

**Responses are text, never `structuredContent`.** Tools used to return both a markdown text
and a JSON object. MCP clients substitute the JSON, so the markdown was never read — proved
by reading the runner's own transcript, where an agent can be seen receiving
`{"path":"/contactMethod","type":"select","getSuggestions":true}` with no values. Five
finished pieces of work were inert. Removing the structured half took what the model receives
for one `describeState` from 91,197 bytes to 2,212.

**One representation, one home per fact.** The suggestion protocol was once stated four times
— in two tool descriptions, a parameter, and the guide. Copies drift: a stale duplicate of
`getData`'s description in `index.js` silently overrode the real one for weeks and cost two
cases a call each. Tests now assert that exactly one description explains `suggestionIndex`.

**One guide, no complexity classification.** There used to be small/medium/large bands, from
counting layout nodes, feeding three different sets of advice. The threshold was
unjustifiable, it measured the schema when the question was about data, and it was duplicated
in two files. Four consecutive commits fixed contradictions between the branches, and across
four baselines the small and medium advice was never taken on a real form.

**No `getSchema`.** A build-time compiled layout carries no raw schema — `serialize()` emits
the skeleton, the layouts and the validators — so the tool cannot exist where production runs.
`calendar` and `charts` had it available in every run and never called it. What it uniquely
offered, the validation keywords, now reaches the state tree instead: `format`, `pattern`,
`minLength`, `maxLength`, `minItems`, `maxItems` and `uniqueItems` are carried onto the
skeleton node, because ajv enforces them and nothing else was telling the agent.

**Large values are named, never truncated.** `<object, 12486 chars — call getData with this
path to read it>`. A truncated value read as real would be forwarded to an API as a wrong
value with nothing looking wrong; a marker fails loudly. `getData` itself is never abbreviated
for the same reason — what it returns is the data.

**A closed list is stated, a remote one is flagged.** `describeState` prints
`values=["top","bottom","left","right"]` when the options are already resolved, and marks
`suggestions` when they are only reachable by request. Before this, agents spent a round trip
per enum.

**Repeated things are said once.** A recursive schema reaches the same union at every level;
`portal-page`'s 39 branches were printed three times in a ten-call run. They are now printed
once, then referred back to by path.

**Memorised suggestions are dropped only when they go stale.** Applying an option by index
needs the list remembered. Every write used to clear all of it, which broke a listing an
unrelated write could not have affected. Invalidation now compares each path's
`itemsCacheKey` — the same value the state layer uses to decide whether to re-fetch.

## How far this is validated

Unit tests: 463, covering tool shapes, projection rules and the compile-level changes in both
runtime and build-time compilation.

Behavioural: `core/webmcp-eval/` runs each case as a headless `claude -p` subprocess against
a real MCP server, and a judge reads the transcript. Six cases — a hand-written control, three
vendored from data-fair (`app-calendar`, `app-charts`, `portals` page editor), and two that
start from a populated document and ask for a change.

At the latest baseline, every case was judged satisfactory on **three model tiers**, with the
produced document checked field by field rather than trusting `valid: true`:

| | opus | sonnet | haiku |
|---|---|---|---|
| cases correct | 6/6 | 6/6 | 6/6 |
| errored calls | 1 | 0 | 0 |
| suite cost | $0.838 | $0.502 | $0.254 |

Haiku 4.5 completed `portal-page` — the 39-branch recursive union — in eight calls, the floor,
with no wasted read. The points where a smaller model was expected to slip are the ones the
protocol leaves to inference: which of `children`/`children2` is the left column, that a
rendered branch is the active one, that a field's options cannot be fetched before the field
they derive from is set. None of them bit.

## What is not established

- **One MCP client.** Everything ran through Claude Code. The `structuredContent` episode is
  the standing reminder that client behaviour can silently invalidate a whole line of work.
- **The judge is not independent** — it is the same model family reading its own transcripts.
  In the 2026-10-29 comparison it also saw the check results in the evidence file (told to
  ignore them).
- **n=1 per case per model** for the tier table above, against run-to-run variance that has
  reached 3× on cost for identical code. Single-run comparisons are noise; only repeated,
  large effects are signal. The plain-JSON comparison has n=3 per arm, on haiku only: two
  differences are repeated and large (`data-fair-line` for the plain arm, `charts-edit` for
  the form), the rest are ties within the spread.
- **What the model actually read.** Responses above some size between 29 KB and 62 KB did not
  reach the model whole in the 2026-10-29 runs (inferred from cache-write token counts; the
  mechanism is the client's). Byte counts are what the tools answered, not what was read.
- **The server session's auto-save** is not measured: `FormSession` has no auto mode yet, so
  its arm is not runnable on application configurations (`calendar`, `charts-edit`,
  `portal-config-edit`).
- **No branch-choice case.** Every `oneOf` in the comparison was either already chosen in the
  starting document or a discriminated union; reason 1 is untested where the right branch
  depends on reasoning.
- **`setData` with `merge: false`** has unit tests and no behavioural evidence — no agent has
  ever called it.
- Open findings are recorded per baseline in `core/webmcp-eval/baselines/`. All current ones
  are clarity, not correctness: none has produced a wrong value or an invalid form.

## A note on measuring

Output bytes are what a tool answers with; they are not what a run costs. A `calendar` run
consumes about 98,500 input-side tokens, 89,000 of them cache reads of the conversation
replayed each turn, against roughly 1,300 output. One 13 KB response is about 3% of that.
Three commits went into suppressing such a response before anyone measured it. The runner now
records token usage and the report prints it beside the byte count.
