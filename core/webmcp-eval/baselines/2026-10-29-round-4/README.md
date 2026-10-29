# Baseline — 2026-10-29, rounds 4 and 5: fine-tuning after round 3

Two short rounds on the cases round 3 left costlier for the form tools
([round 3](../2026-10-29-round-3/README.md)). Model haiku, 3 runs per arm, one judge per
case × arm. Round 5's evidence is in [`../2026-10-29-round-5/`](../2026-10-29-round-5/).

## What changed

Round 4 (code at `9c96733`):

- Plain harness: the `readSchema` outline follows an `allOf` root and `definitions` (the charts
  schema answered an empty outline in round 3 and every plain run lost a call on a 404).
- A JSON-quoted text (`"\"above-footer\""`) written to a closed set of values is unquoted.
- A layout segment written without its `$` (`/comp-2/…`) resolves.
- `describeState` `query` also matches short current values and says when a match is hidden.
- `describeState` on a list item names its chosen option instead of the list's 40 options.
- One sentence in `editArray`'s description pointing to `setData` for several changes to one
  list. **Measured without effect** (no run used `setData`; all used three `editArray` calls)
  and reverted in `0c5852f`.

Round 5 (code at `53d5053`, form and session arms only; the plain arm was unchanged since
round 4, whose plain runs are the comparison):

- `editArray` answers end with the list as it now stands, one outline line per item.
- The outline budget is `min(16 000, max(6 000, 2 × the described data's JSON))`.

## Results

All 63 runs (45 in round 4, 18 in round 5) were judged satisfactory and passed every check.

| case | arm | round 3 | round 4 | round 5 |
|---|---|---|---|---|
| portal-page-reorder | form | 6–7 calls, 97–100k, $0.005–0.006 | 5–6, 78–104k, $0.006–0.007 | **4–5, 54–82k, $0.004–0.006** |
| | session | 5–6, 74–98k | 5–6, 61–95k | **4, 54k, $0.004** |
| | plain | 3, 29k, $0.005 | 3, 29k, $0.005 | (round 4) |
| portal-page-list-edit | form | 3–5, 60–84k, $0.004–0.005 | 3–6, 53–91k | **4–5, 55–58k, $0.003–0.004** |
| | session | 4–5, 67–83k | 3–6, 58–125k | 3–5, 57k, $0.003–0.004 |
| | plain | 3–4, 29–55k, $0.004–0.005 | 3–5, 29–53k, $0.004–0.005 | (round 4) |
| portal-config-multi | form | 14–18, 124–151k | 15, 123–128k | 13–15, 106–129k, $0.006–0.007 |
| | session | 13–19, 125–173k | 13–16, 104–179k | 13–18, 126–158k |
| | plain | 10–12, 85–129k | 11–12, 82–258k, $0.006–0.013 | (round 4) |
| charts-edit | form | 3, 29k | 3, 29k, $0.002–0.003, 0 friction | — |
| | plain | 7–9, 89–159k, $0.007 | **5–7, 35–97k, $0.003–0.005** | — |
| calendar | form | 9–12, 63–90k | 10–12, 72–91k | — |
| | plain | 6–7, 45–88k | 6–7, 61–62k | — |

Reading it:

- **Reorder** reached break-even in dollars. The three edits were always three small `editArray`
  calls; what cost was the re-reading. In round 4 every form run described the 16 KB list again
  (and two read it with `getData`) to check the result; with the list in the `editArray` answer,
  round 5 runs end after the last write (`describeState` + three `editArray`, r1 and r2). Input
  tokens stay about twice the plain arm's: the first outline (15.3 KB) is twice the 7.6 KB
  document the plain arm reads.
- **List edit**: the form is now cheaper in dollars than the plain arm, which re-emits the page.
- **Charts edit, plain**: fixing the harness outline removed the plain arm's 404s and halved its
  cost; the form is still about 2× cheaper.
- **Portal config multi**: unchanged; the form's extra calls are the menu item's option choice
  and a link's page pick.
- The proportional budget saves about 4% on the page fixtures; the `editArray` list is what
  removed the re-reads.

## Leads left

- `getFieldSuggestions` on a field of an option not chosen (`…/links/0/$oneOf/1/pageRef`)
  answers "node not found" listing only the active option (portal-config-multi session r2 #14,
  r3 #10; medium).
- `editArray add` of a union item without a value leaves an empty item whose "tag type must be
  string" error repeats on the next writes (round 4 form r1, r3; round 5 form r2).
- `describeState` on a nested list or a block repeats the 40-option catalogue already given in
  an earlier answer (reorder form r3 #2, list-edit form r3 #2), and a heading block's answer
  lists every title field (list-edit form/session r1 #2).
- From round 3, still open: "not in the form yet" for a field hidden by a condition
  (portal-config-edit form r3 #9); commune suggestions without their département (fixture
  content, the same for both arms); cumulative suggestion indexes surprise an agent after a
  narrower search (by design, `adeccf7`).
