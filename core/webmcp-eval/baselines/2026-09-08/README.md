# Baseline — 2026-09-08

Recorded from `json-layout` at `5fccac6`, against `data-fair/portals` at `19f3a68c`.
Supersedes `../2026-09-07/`, which predates six fixes the eval itself surfaced.

| case | calls | bytes | cost | verdict |
|---|---|---|---|---|
| contact | 4 | 524 | $0.082 | satisfactory |
| contact (no-schema) | 5 | 857 | $0.088 | satisfactory |
| calendar | 12 | 34213 | $0.354 | satisfactory |
| charts | 17 | 20635 | $0.283 | satisfactory |
| portal-page | 10 | 10770 | $0.243 | satisfactory |

All on `claude-opus-5`, guide injected into the runner's prompt, $1.05 total, zero errored
calls, and — for the first time — **no finding above medium severity**.

## Against 2026-09-07

| case | calls | bytes | cost |
|---|---|---|---|
| contact | 4 → 4 | 524 → 524 | — |
| contact (no-schema) | 5 → 5 | 857 → 857 | — |
| calendar | 11 → 12 | 59341 → **34213** | $0.573 → $0.354 |
| charts | 21 → **17** | 47350 → **20635** | $0.574 → $0.283 |
| portal-page | 10 → 10 | 10780 → 10770 | — |

Suite totals: 118852 → 66999 bytes (−44%), $1.54 → $1.05 (−32%).

The charts improvement splits cleanly. Dropping `sort=createdAt:-1` from the picker URL
took its dataset search from five queries to one — the target now comes back at index 0
for the first query, where previously even the dataset's verbatim title failed to return
it. Listing suggestions by title rather than value did the rest.

Calendar gained a call while losing 42% of its bytes; the judge attributes the extra call
to verification re-reads rather than to the leaner listing, and notes that both
object-valued fields were still applied in one call each with no round-trip spent
recovering an omitted value.

## What the judges still flag, all medium

- **The write echo undoes the listing saving.** `getFieldSuggestions` now omits an object
  value, and then `setFieldValue` prints the whole thing back — 12.6 KB on calendar,
  4.3 KB on charts — and the closing `getData` prints it a third time. `projectFieldResult`
  and `describeState`'s leaf rendering stringify `node.data` with no cap, unlike
  `formatSuggestions`. Applying the same rule there is the obvious next step.
- **`editArray` re-emits the whole 39-branch union on every add** — three times in a
  ten-call run, ~3.7 KB of 10.8 KB, for a closed list the agent had already read.
- **An `x-if` reveals nothing.** `setFieldValue` now announces the fields of a variant it
  activated, but a boolean that unhides a section still reports only itself; calendar's
  agent ended believing crowd sourcing was fully configured while `contribsDataset` sat
  unreachable behind it.
