# Baseline — 2026-10-29, round 6: last fine-tuning batch, and a regression pass

Follows [rounds 4 and 5](../2026-10-29-round-4/README.md). Model haiku. Code at `144d2a0`.
37 runs: four cases with the form and session arms, 3 runs each, and the thirteen other cases
once with the form arm for regression. All 37 judged satisfactory, every check passed. The
plain arm did not change since round 4; its round 4 runs are the comparison.

## What changed since round 5

- A path under an option not chosen (`…/links/0/$oneOf/1/pageRef`) names that option and says to
  switch first, instead of "node not found" (`65dc2ac`).
- An item added without a value says it still needs its option chosen, once, instead of a
  "tag type must be string" error repeated by every later write (`b27b0cd`).
- A union's options are listed in full once per WebMCP instance; later answers refer to the
  earlier listing and give the selector to list them again (`bc77320`).
- `describeState` on a field hidden by a condition names the condition, the field it reads and the
  current value, instead of "not in the form yet" (`144d2a0`).

## Results

| case | arm | round 3 | round 6 | plain (round 4) |
|---|---|---|---|---|
| portal-page-reorder | form | 6–7 calls, 97–100k, $0.005–0.006 | **4–5, 54–61k, $0.004–0.005** | 3, 29k, $0.005 |
| | session | 5–6, 74–98k | **4–5, 54–55k, $0.004** | |
| portal-page-list-edit | form | 3–5, 60–84k, $0.004–0.005 | **4–5, 43–58k, $0.002–0.003** | 3–5, 29–53k, $0.004–0.005 |
| | session | 4–5, 67–83k | 3–7, 56–96k, $0.004 | |
| portal-config-multi | form | 14–18, 124–151k, $0.006–0.007 | 13–14, 105–128k, $0.006 | 11–12, 82–258k, $0.006–0.013 |
| | session | 13–19, 125–173k | 14–15, 104–148k, $0.006 | |
| portal-config-edit | form | 9, 90k, $0.004–0.005 | 7–11, 79–110k, $0.004–0.005 | (round 3) 8–10, 113–178k, $0.010–0.016, 1/3 satisfied |
| | session | 10–13, 100–150k | 9–14, 102–154k, $0.005–0.006 | |

Regression pass (form, one run each): contact, charts, portal-page, charts-edit, portal-page-edit,
choropleth, portal-menu-catalog, portal-menu-explain, portal-page-catalog, charts-pie,
data-fair-line, portal-page-switch, calendar — all satisfactory, all checks passed. Costs in the
same ranges as round 3 (data-fair-line 12 calls, 36k; portal-page-switch 4 calls, 53k; charts-edit
3 calls, 29k).

Reading it:

- **Every case is now at or below the plain arm in dollars**, the page cases included, except
  data-fair-line and calendar, which are within a tenth of a cent (form $0.003 and $0.005 against
  plain $0.002–0.003 and $0.004–0.005). Input
  tokens on the two page cases stay above the plain arm's (the first outline, 15 KB, against a
  7.6 KB document); the plain arm pays it back in output tokens, re-emitting the page.
- The changes of this round removed the failed calls and repeated errors the judges flagged in
  rounds 4–5 (a switch path refused, a pending item's error repeated); the menu-item flow of the
  portal configuration cases is where they showed.

## Judges' remaining remarks (low severity)

- Redundant re-reads after a write already confirmed the result (several cases, one call each).
- Commune suggestions show a name and a code without the département (fixture content, the same
  for both arms).
- A field the goal calls "department" is labelled « Afficher le propriétaire » (schema wording).
- A describeState `query` on the portal configuration listed hidden admin-mode duplicates among
  its matches; fixed after this run (`4c62a75`: visible matches first, hidden ones counted per
  section).
- `editArray remove` listed what remained, not what was removed; fixed after this run
  (`4c62a75`).

Fixes after this run (`798c250`, `4c62a75`) came from the final review of rounds 4–6 and these
remarks; they were checked by unit tests and a review, not re-measured here.
