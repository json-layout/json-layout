# Baseline — 2026-09-08 (third run of the day)

Recorded from `json-layout` at `d92f9c9`, against `data-fair/portals` at `19f3a68c`.
Supersedes `../2026-09-08b/`, which predates the three fixes the eval itself surfaced:
tuple entries are no longer reported `required` unless `minItems` covers them (`efca68f`),
a repeated discriminated union is named rather than reprinted (`4f2fe61`), and help is
stripped of HTML and named rather than printed past 300 characters (`d92f9c9`).

| case | calls | bytes | cost | verdict |
|---|---|---|---|---|
| contact | 3 | 499 | $0.082 | satisfactory |
| contact (no-schema) | 4 | 832 | $0.088 | satisfactory |
| calendar | 9 | 7739 | $0.502 | satisfactory |
| charts | 17 | 16101 | $0.295 | satisfactory |
| portal-page | 9 | 7298 | $0.188 | satisfactory |

All on `claude-opus-5`, guide injected into the runner's prompt, $1.155 total, every form
valid. **One errored call**, on charts — see below; the suite had none in `2026-09-08b`.

## Against 2026-09-08b

| case | calls | bytes |
|---|---|---|
| contact | 3 → 3 | 499 → 499 |
| contact (no-schema) | 4 → 4 | 832 → 832 |
| calendar | 12 → **9** | 21216 → **7739** |
| charts | 16 → 17 | 15934 → 16101 |
| portal-page | 10 → **9** | 10797 → **7298** |

Suite totals: 49278 → 32469 bytes (−34%), 45 → 42 calls, $1.27 → $1.155.

Both contact variants are byte-identical: contact has no tuples, no repeated unions and no
help, so none of the three fixes touch it. Their verdicts are carried over unchanged.

Calendar's −64% is the largest single-case move the suite has recorded. Its shape changed
too: it now closes with three targeted `describeState` calls by path instead of the 13 KB
whole-document `getData` that was 66% of the previous run. One run does not establish that
the fixes caused that choice — the byte drop in its opening read is not a choice.

Charts is flat, which is consistent: it has one 70-character help, no repeated unions, and
its only tuple was already covered by the array's own error, so there was little for these
three fixes to touch. The +1 call is variance.

Portal-page: the variants memo suppressed two emissions of the 39-branch union (~2.4 KB
replaced by two one-line references) and the help change took ~780 bytes off the opening
read. The judge confirmed nothing was lost — the one named help is SEO advice on a field
the goal never touches, and the surviving inline helps read as clean prose.

## What the judges flag

**Medium, charts, and the one worth acting on.** At call 7 the agent read suggestions for
the `groupBy` field, at call 8 wrote to an unrelated path, and at call 9 was told
`no suggestion memorized for path "...", call getFieldSuggestions on this path first`.
Two problems, independent of each other:

- The message is untrue as read. The agent *had* asked, two calls earlier. It could not
  diagnose the real cause as staleness, so it abandoned `suggestionIndex` for the rest of
  the run and wrote literals instead — a behaviour change that costs more than the one
  errored call. The store knows whether a path was ever populated, so it can distinguish
  "never fetched" from "invalidated by a write since you fetched it".
- `index.js:294` clears the *whole* store on every write. Its own comment justifies this by
  "a getItems expression can depend on another field" — but flipping the `valueCalc` union
  cannot change `groupBy`'s column list, so the rule is broader than the hazard.

The bounded cost here hides an unbounded one: the agent recovered cheaply only because
`nom_com` is a short scalar the listing had printed. Had the invalidated path been
`/$allOf-0/datasets/0`, whose value is a 4213-character object shown **by title alone**
precisely because we chose not to inline it, there would have been no literal to copy and
the remote-backed search would have had to be repeated. The abbreviation work and the
store-clearing rule are in tension, and the eval has not hit the intersection yet by luck.

**Low, and now the most common pattern left:** every case still closes with a verification
`getData` the writes had already answered. On charts that is 4757 bytes, ~30% of the run.
Established across three runs and a 12-run experiment: prompt wording does not move this,
and abbreviating `getData`'s answer was tried and reverted because an agent may forward the
result to an API. The lever left is the tool, not the guide.

**Low, calendar:** the opening error line reads `- /$allOf-0/datasets: must have required
property datasets` — ajv's root-level message attached to a node already named `datasets`,
so it parses as "this node is missing a datasets property" rather than "this array needs
its first entry". The agent recovered from the tree line below it.

**Low, portal-page:** `children` is the left column and `children2` the right, and nothing
in the response says so — the titles are "Contenu"/"Deuxième contenu" and the only
left/right vocabulary is on a sibling `align` section. The agent bridged first→left by
ordering alone and was right, but it assumed rather than read.

**Low, calendar:** the "became available" line still names bare paths with no label or type.
