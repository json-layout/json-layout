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
these are differences in effort and cost, not in outcome). A second round on the same day
([round 2](../../webmcp-eval/baselines/2026-10-29-round-2/README.md), same model and n) took the plain arm's HTTP client away for targeted lookup tools, made
its patch single-level like data-fair's APIs, and added four nested-document cases on portal
pages and configurations. That round did have outcome differences; they are noted below.
[Round 3](../../webmcp-eval/baselines/2026-10-29-round-3/README.md) fixed round 2's form-tool leads and harness defects, added auto-save
sessions, and re-ran the same eight cases with the same model and n (round 3 figures replace
round 2's below where they changed):

**1. Half the schema does not apply until you have chosen something.** `charts` is five
levels of nested `oneOf`: which fields are legal depends on the chart type, then on the
data-preparation mode, then on the grouping kind. `calendar` hides a whole section behind
`x-if: datasets.0.isRest` — the crowd-sourcing settings do not exist as valid keys until a
REST dataset is picked. A model emitting a document in one shot has to guess which branch's
fields are legal; the tools let it activate a branch and be told what that branch contains.
*Measured: tie.* With the raw schema the plain arm wrote `calendar`'s `x-if` field together
with the value that opens it, and a valid discriminated menu item on `portal-config-edit`, in
every run; no case asked for a branch the document did not already make obvious.
*Round 3: for the form on a branch change.* Turning a page's text block into an alert
(`portal-page-switch`) is one `setFieldValue` on the block's variant selector: 4–5 calls and
56–73k input tokens, 3/3 clean, against 6–11 calls and 68–140k for the plain arm, which reads
the 135 KB block union to build the alert by hand. In round 2 the switch kept the text
block's `centered` and left 2 of 3 runs invalid. The fix holds where the variants refuse extra
keys. On open variants the previous variant's keys still stay (`choropleth`, one run: a stale
`enumOptions` beside the range options, form valid).

**2. The accepted values are not in the schema at all.** `calendar`'s label field takes its
options from `${rootData.datasets[0].href}/schema?calculated=false` — an HTTP request whose
URL is built from another field's current value. No amount of schema reading yields
`nomevenement`. `getFieldSuggestions` performs that lookup.
*Measured: tie, and "nothing else can" did not hold.* Given the URL templates in the raw
schema and an HTTP GET, the plain arm built the lookups itself in 9 of 9 runs (communes,
dataset listing, column listing, portal pages) and picked the same values.
*Rounds 2 and 3, with targeted lookup tools instead of HTTP* (no agent gets a generic HTTP
client in production), the plain arm again found every value: 9 of 9 runs in round 3, once the
lookup accepted the id as the schema writes it (a harness defect blocked one round-2 run).

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
*Round 3 on `portal-page` (145 KB raw schema): mixed.* `describeState` without a path now
answers a 16 KB outline instead of 95 KB. The form is cheaper on the variant switch (above),
ties in dollars on a rename deep in a grid (`portal-page-list-edit`, $0.004–0.005 both; plain
reads 29–55k input tokens against 60–84k but writes 4k output tokens), and is still costlier
on three edits in one request (`portal-page-reorder`: 6–7 calls and 97–100k against 3 calls
and 29k, 10–20% in dollars). The plain agent works from the 7.5 KB document and writes it back
whole. The form pays a call per edit and replays its 16 KB outline at every turn.

There is a fifth reason that matters in production: the form is *live*. Writes land in the
state a user is looking at, validation runs on every one, and the errors come back scoped to
what just changed. The agent is editing a form, not drafting a file.
*Measured: mixed.* Scoped errors and "N field(s) became available" did steer recoveries; but
one whole-document 400 was as useful to the plain arm, and the plain arm's only real miss —
a write that cut a dataset's column list, accepted by the schema — is a value the form's
suggestion would have stored whole; the agent caught it itself.
*Round 2: still mixed, with failures on both sides.* The form: the variant switch above
reported "form is invalid" without locating the error. The plain arm: whole-object resends
were accepted with damage the schema cannot see. A mangled dataset `href` (`charts-edit`), and
19 top-level sections copied inside the portal `theme`, whose schema accepts extra keys
(`portal-config-edit`, one run kept them and failed its check).
*Round 3: the plain arm's.* No form or session run failed. Two of three plain
`portal-config-edit` runs retyped `theme` and changed one character of a font file name in its
CSS, stored with `200 OK, stored 23 top-level key(s)`; the check caught it, the agents did
not.

The comparison also showed what is not among these reasons. **On a flat record built from
loose text, the plain arm wins clearly**: `data-fair-line` (15 columns, a remote referential)
took 4 calls and ~30k input tokens in all three plain runs, against 15–18 calls and 46–57k
for the page tools and 8–19 calls and 63–79k for `FormSession`. Two form-tool defects caused
most of the difference: a 14-digit SIRET reached `setFieldValue` as a JSON number in all six
page-tool and session runs and was refused, the quoted retry stored the quotes, and only `setData` fixed it;
and memorised suggestions were dropped by a `setData` that did not touch the field.
In round 2 the gap narrowed: 5–6 calls and 40–49k for plain, its lookup tool costing calls.
In round 3 it is a tie: 4–13 calls and 33–37k for the form, 4–5 calls and 31–40k for plain.
The SIRET written as a number is stored as the string, and suggestions survive `setData`.

Round 2 added a cost driver that none of the five reasons names: **where the edit sits
relative to what a single-level patch must resend.** When the change is inside a large
top-level object, the form is markedly cheaper. On `portal-config-edit` the colour sits in
`theme`, 9.3 KB with a 5 KB font CSS string, and the form took 90–91k input tokens in round 3.
The plain arm took 113–178k and 7–13k output tokens, 2–3× the form's cost, and 2 of 3 runs
damaged `theme` (round 2: 164–826k, one run never wrote `theme`). On `charts-edit` the form is
about 3× cheaper ($0.002–0.003 against $0.007). When
the whole document is small enough to resend (a 7.5 KB portal page), the plain arm needs fewer
calls and fewer input tokens than navigating the form. In round 2, on nested documents, what
made the form costlier was reading and locating, not writing: root descriptions larger than
the data, no field search, no array move, paths that need a variant index the agent does not
know. Round 3 fixed those: the worst form run on `portal-config-multi` fell from 343k to 151k
input tokens, now a tie with plain. The round-3 baseline lists what remains.

## The tools

Six, and one guide. The guide is not a tool — production pages pass it to the agent as its
prompt via `includeSubAgent`.

| tool | what it is for |
|---|---|
| `describeState` | every field with path, type, constraints, current value, errors; an outline past 16 KB, or the fields matching the words of `query`. The starting point and the only way to see the form. |
| `setFieldValue` | write one field; switch a variant by writing its index. |
| `setData` | write the whole document at once, for when the goal already contains every value. |
| `editArray` | add, remove or move an item; an added item is activated and its fields returned. |
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

**A large form is answered as an outline, a list's options once.** Round 2's `describeState`
answered 95 KB for the root of a 7.5 KB portal page and 91 KB for its `/elements`, and the
eval's MCP client cut both before the model read them. Past `OUTLINE_BUDGET_BYTES` (16 KB, the
plain arm's value) the answer is the live state shallower — sections and their fields with
values cut short, each list as its item count and one line per item with the option it holds
and a label — at the deepest level that fits, as `describeFormSchema` already did. Untitled
wrappers, a choice with its option's section, and a section of a single part are not levels.
What is left of the budget then opens what was only named, breadth first, so the root of the
page shows the grid's cards and the portal configuration's root its menu entries. The union
every item of a list holds is listed once, under the list, in full descriptions too. Measured:
root 95,798 → 15,958 bytes, `/elements` 92,173 → 15,441, the portal configuration's root
62,571 → 15,631.

**Paths mean what the agent read.** A path may mix the layout's (`/$oneOf/2`, a tab) and the
data's, and a key under a choice needs no index: `/menu/0/title` finds the option that holds
`title`. A form segment written without its `$` (`/comp-2/…`) reads as `/$comp-2/…` unless the
data holds a key of that name. A path that leads nowhere says where it stops and what is there. `describeState` with
`query` lists the fields whose name, title, description or short text value holds the words,
with their paths, so a field is found without knowing which tab holds it; a field a condition
hides is listed too, with the condition that reveals it. Switching a variant removes every key
of the one it leaves, and an invalid form always says which node is invalid.

**Input is read as it was meant.** A tool call is JSON, and a model writes a SIRET as a number or
one choice for a multi-valued field. A number for a text field becomes its text, a single value
for a list becomes a one-item list, a text for a list of a closed set is split on commas, or on
the field's `separator`, unless an allowed value itself holds it. A JSON-quoted text
(`"\"above-footer\""`) for a field with a closed set of values loses its quotes when only the
unquoted text is allowed; an open text field keeps whatever it is given. The answer says what
was read. These are a few explicit rules in `coerce.js`, not ajv `coerceTypes`, which also bends
values inside choices and turns `""` into 0.

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
unrelated write could not have affected. A write keeps the suggestions it does not touch, and
invalidation now compares each path's `itemsCacheKey` — the same value the state layer uses to decide whether to re-fetch. `setData`
also drops the paths whose data it changed, and nothing else; `editArray` drops the lists of
the items an add or a remove shifted, and a move takes each item's lists along with it. A list whose items
are reshaped by expressions that read other fields (`itemsResults` picking the values of the
selected concept out of one same URL) is compared by the items it lists now instead, reshaped
from its download without a request, so changing that field drops its suggestions and the
values picked from them. A search that matches nothing closely says so in its answer, while still listing the options.

**Picked, not invented.** A field whose options come from a remote list holds codes the form
cannot check: an agent typed commune 44173 from memory (the real one was 44190) and the form
said valid. A value written to such a field that no search listed for it, and that it did not
hold when loaded, is accepted with a warning naming it, and `WebMCP#unpickedValues()` lists
those still in the form so a host can hold a save on them (`resetBaseline()` after loading other
data). Only the tools' writes are tracked: a value a person picks on screen counts as unpicked
until the host calls `resetBaseline()`, so the hold belongs to server-side sessions, where no
person edits the form. A write that changes the list another field reads warns about that
field's value too. The guide says it in one line.

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
  In the first 2026-10-29 comparison it also saw the check results in the evidence file (told
  to ignore them); from round 3 it only gets its transcript copy.
- **n=1 per case per model** for the tier table above, against run-to-run variance that has
  reached 3× on cost for identical code. Single-run comparisons are noise; only repeated,
  large effects are signal. The plain-JSON comparison has n=3 per arm, on haiku only. In
  round 1, two differences were repeated and large (`data-fair-line` for the plain arm,
  `charts-edit` for the form). In round 2: `charts-edit` and `portal-config-edit` for the form,
  the three portal-page edits and `data-fair-line` for the plain arm. In round 3:
  `charts-edit`, `portal-config-edit` and `portal-page-switch` for the form,
  `portal-page-reorder` (input tokens) for the plain arm; the other four are ties.
- **What the model actually read.** Responses above some size between 29 KB and 62 KB did not
  reach the model whole in the 2026-10-29 runs (in round 2, 95 KB `describeState` and 128–145 KB
  `readSchema` answers were cut too) (inferred from cache-write token counts; the
  mechanism is the client's). Byte counts are what the tools answered, not what was read.
  In round 3 no form or session answer exceeded 16 KB.
- **The server session's auto-save** is measured from round 3 on seven cases: it cost the
  same as the page tools and added no calls.
- **No branch-choice case.** Every `oneOf` in the comparison was either already chosen in the
  starting document or a discriminated union; reason 1 is untested where the right branch
  depends on reasoning.
- **`setData` with `merge: false`** has unit tests and no behavioural evidence — no agent has
  ever called it.
- Open findings are recorded per baseline in `core/webmcp-eval/baselines/`. Until round 2 all
  were clarity, not correctness. Round 2 recorded one form-side correctness failure: a variant
  switch keeps the previous variant's keys and leaves the form invalid (`portal-page-switch`,
  2 of 3 runs). Round 3 fixed it for variants that refuse extra keys; on open variants the
  keys still stay (`choropleth`).

## A note on measuring

Output bytes are what a tool answers with; they are not what a run costs. A `calendar` run
consumes about 98,500 input-side tokens, 89,000 of them cache reads of the conversation
replayed each turn, against roughly 1,300 output. One 13 KB response is about 3% of that.
Three commits went into suppressing such a response before anyone measured it. The runner now
records token usage and the report prints it beside the byte count.
