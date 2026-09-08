# Baseline — 2026-09-08 (fourth run of the day, the simplified protocol)

Recorded from `json-layout` at `c931e57`, against `data-fair/portals` at `19f3a68c`.
Supersedes `../2026-09-08c/`. **This is the first baseline of a protocol with one shape:**
`getSchema` and the small/medium/large complexity bands are gone, so there are six tools,
one guide with one path, and no description that varies. The `no-schema` ablation went with
them — there is no second configuration left to compare against, so the suite is four runs
rather than five.

| case | calls | bytes | cost | verdict |
|---|---|---|---|---|
| contact | 5 | 927 | $0.092 | satisfactory |
| calendar | 10 | 8358 | $0.543 | satisfactory |
| charts | 15 | 15997 | $0.301 | satisfactory |
| portal-page | 10 | 7492 | $0.215 | satisfactory |

$1.151 total, every form valid, zero errored calls.

## What the simplification cost

Against the same four controls in `2026-09-08c`: +2 calls, +3.6% bytes, +8% cost — **all of
it contact**, which went 3 → 5. It was the only case using `getSchema`, and it used it to
read one enum. The three real forms are unchanged within their established variance; charts
is at 15, its joint best.

That is the accepted price, and it is worth stating plainly: a small form that ships its
schema was genuinely cheaper before. It is a configuration production does not ship —
`serialize()` emits no raw schema, so a build-time compiled layout never had the tool.

Contact's two extra calls are not both the missing schema. One is: reading a schema put the
enum in front of the agent. The other is the enum-fetch habit — call 1 stated
`values=["email","phone","post"]` on the field's line and the agent fetched the list anyway.

## What the judges confirmed

- **Nothing was lost with `getSchema`.** Calendar: "describeState inlined the closed lists
  ... the agent never reached for schema-level information". Contact: the enum "did arrive on
  describeState's line exactly as the new design intends; no information was lost with the
  schema tool, and no call was made to work around its absence".
- **The single path fits every size.** No case shows an agent doing something sized for the
  wrong form.
- **`values=[...]` mostly holds.** Charts used it for 3 of its 4 list needs; the fourth,
  `legendPosition`, was fetched despite being stated in call 1.
- **The variants memo still pays.** portal-page emits the 39-branch union once and replaces
  the next two with a pointer, ~2.8 KB saved.

## Open, and each now has a located cause rather than a symptom

- **The enum-fetch habit is a contradiction between two voices, not a prompt problem.**
  `getFieldSuggestions`' own description reads unconditionally — "Get the accepted values of
  a select/autocomplete/combobox field" — with no carve-out for fields `describeState` has
  already stated, so it invites exactly the call the guide forbids. Three rewordings of the
  guide moved nothing; the description was never changed. Same failure mode as `7d3814e`.
- **The abbreviation pointer is circular for a leaf.** `<object, 12486 chars — describeState
  its path to read it>` leads back to the same sentence: `abbreviateValue` has no depth-0
  exemption, unlike `help`, which got one earlier the same day. Verified by following it.
- **The guide never mentions variant selectors.** On portal-page, whose whole content model
  is a recursive discriminated union, the index-as-value protocol exists only inside
  `setFieldValue`'s description, and the guide's "values=[...] or suggestions" dichotomy does
  not cover the third shape the agent has to read, `variant N: label`.
- **A variant selector prints no `selected=` when its branch was activated by defaults**, yet
  that branch's fields are rendered underneath it. portal-page's outcome depends on inferring
  the default is `text`.
- **The "became available" line still names bare paths**, and calendar's two identically
  labelled contributions-dataset slots remain indistinguishable from tool output.
- **The closing `getData` persists in all four cases.** On charts it is 30% of the run.
