# Baseline — 2026-10-29, round 2: nested documents, targeted lookups, single-level patch

Second comparison of the three tool surfaces (spec:
`docs/superpowers/specs/2026-10-28-webmcp-eval-plain-json-arm-design.md`, section "Round 2";
round 1 is [`2026-10-29-plain-json-arm`](../2026-10-29-plain-json-arm/README.md)). What changed
since round 1:

- **plain** loses `httpGet`. Each case declares the targeted lookup tools a real MCP server
  would offer (`list_account_datasets`, `describe_dataset`, `get_field_values`,
  `list_portal_pages`, modelled on data-fair/mcp); they build their URLs themselves.
- **plain**'s `patchDocument` is single-level, like data-fair's APIs: each top-level key named
  is replaced whole, objects and arrays included. Its description says so.
- Four nested-document cases on a portal page and a portal configuration:
  `portal-page-list-edit` (rename a card deep in a grid), `portal-page-reorder` (move a block
  to the top, insert a divider, remove a button), `portal-page-switch` (turn a text block into
  an info alert, same text), `portal-config-multi` (four scattered settings in one request).
  Checks pin the stated facts and that nothing else changed.
- The report breaks costs down per kind of call (state or document read, schema read, write,
  lookup, other) and flags responses over 100 KB.

## Setup and caveats

- Model `haiku` (served as `claude-haiku-5-5`), 3 runs per case per arm, code at `11a3c9e`.
  51 runs, 51 judged (one judge per case × arm, a verdict per run). 21 session runs are not
  runnable (below).
- **n=3, one model.** Only repeated, large differences are read as signal below.
- **Session arm only on `data-fair-line`.** The seven other cases are application or portal
  configurations, auto-saved in production; `FormSession` has no auto-save mode, and the arm
  says so instead of faking it.
- **A harness defect sank one plain run.** `get_field_values` answers `404 Not Found: dataset
  dataset:communes` when given the id as the schema writes it (`x-master.remoteService:
  "dataset:communes"`); it only accepts `communes`. Its description says "after `dataset:`",
  but all three plain runs passed the prefix first (#3), and the 404 does not list the ids it
  knows. r1 and r2 recovered by dropping it (r1 #5, r2 #4); r3 tried four variants (#3–#6),
  never the bare `communes`, and stopped without writing (0/6 checks, unsatisfactory). That
  run measures the lookup tool, not the plain approach.
- **Judges partly saw checks.** Transcripts were given without check results, but three
  judges grepped `cases/index.js` and printed check definitions. Verdicts are read beside
  the checks, never instead of them.
- **What the model read.** As in round 1, the largest responses did not reach the model
  whole: whole runs wrote 12–14k tokens to the cache on `portal-page-list-edit` (both arms),
  although one plain `readSchema` answered 145 KB and one form `describeState` 95 KB. The
  report's `oversized` flag (>100 KB) misses the 95 KB responses; they were cut too. The bytes
  columns are what the servers answered.
- Cost is priced with caching and parallel runs share a cache, so dollars are indicative;
  input tokens (input + cache read + cache write) are the steadier measure.

Files: `<case>[--arm].r<n>.verdict.json` and `report.txt` (the printed `webmcp-eval:report`,
with each run's calls, tokens and cost; its exit code 1 reflects the unsatisfactory runs and
failed checks). Transcripts and runner sidecars are not kept, as in earlier baselines: they weighed some 21 MB over rounds 2 to 6, and the verdicts quote the responses their findings rest on.

## Comparison

Ranges over 3 runs. Satisfied = judged satisfactory. Checks per run.

| case | arm | calls | input tokens | output tokens | cost | satisfied | checks |
|---|---|---|---|---|---|---|---|
| data-fair-line | form | 15–19 | 56–57k | 2.3–2.5k | $0.004 | 3/3 | 6/6 ×3 |
| | session | 8–17 | 60–79k | 1.6–2.5k | $0.003–0.004 | 3/3 | 6/6 ×3 |
| | plain | 5–6 | 40–49k | 1.5–2.6k | $0.002–0.003 | 2/3 | 6/6, 6/6, **0/6** |
| calendar | form | 9–11 | 61–88k | 1.2–1.8k | $0.003–0.004 | 3/3 | 3/3 ×3 |
| | plain | 6 | 57–62k | 1.9–2.8k | $0.004–0.005 | 3/3 | 3/3 ×3 |
| charts-edit | form | **3** | **28k** | 0.5k | $0.002–0.003 | 3/3 | 3/3 ×3 |
| | plain | 4–7 | 71–285k | 0.8–16.7k | $0.005–0.018 | 3/3 | 3/3 ×3 |
| portal-config-edit | form | 10–11 | **77–90k** | 1.4–1.5k | $0.004 | 3/3 | 2/2 ×3 |
| | plain | 9–22 | 164–826k | 17.6–63.0k | $0.016–0.054 | **2/3** | **1/2**, 2/2, 2/2 |
| portal-page-list-edit | form | 4–11 | 51–128k | 0.9–2.1k | $0.003–0.005 | 3/3 | 2/2 ×3 |
| | plain | 3–5 | **29–60k** | 3.8–4.3k | $0.005 | 3/3 | 2/2 ×3 |
| portal-page-reorder | form | 4–11 | 63–144k | 2.9–5.2k | $0.006–0.007 | 3/3 | 18/18 ×3 |
| | plain | **3** | **30k** | 4.2–4.4k | $0.005 | 3/3 | 18/18 ×3 |
| portal-page-switch | form | 13–14 | 192–241k | 3.9–4.0k | $0.007–0.009 | **1/3** | **4/5, 4/5**, 5/5 |
| | plain | 5–7 | **51–84k** | 4.5–5.0k | $0.005–0.006 | 3/3 | 5/5 ×3 |
| portal-config-multi | form | 12–21 | 135–343k | 2.1–3.9k | $0.006–0.012 | 3/3 | 10/10 ×3 |
| | plain | 9–15 | 77–149k | 2.2–4.1k | $0.006–0.009 | 3/3 | 10/10 ×3 |

Per kind of call, where it explains a gap (from `report.txt`):

| case | arm | state/document reads | schema reads | writes |
|---|---|---|---|---|
| portal-page-list-edit | form | 3–8 calls, 104–385 KB | — | 1–2 calls |
| | plain | 1–3 calls, 7.6–9.2 KB | 1 call, 145 KB | 1 call (8 KB sent) |
| portal-page-reorder | form | 3–7 calls, 111–306 KB | — | 1–4 calls |
| | plain | 1 call, 7.6 KB | 1 call, 145 KB | 1 call (7.7–8 KB sent) |
| portal-page-switch | form | 9–11 calls, 132–406 KB, 0–3 failed | — | 3–4 calls |
| | plain | 1–3 calls, 7.6–8 KB | 3 calls, 282 KB, 1 failed | 1 call |
| portal-config-multi | form | 6–15 calls, 115–141 KB | — | 5 calls |
| | plain | 2–5 calls, 11–21 KB | 5–8 calls, 138–164 KB, 0–3 failed | 1 call |
| portal-config-edit | form | 3–5 calls, 66 KB | — | 4–5 calls |
| | plain | 3–6 calls, 10–31 KB | 4–8 calls, 140–149 KB | 1–7 calls, 0–3 failed |

Repeated and large: the form is cheaper on `charts-edit` and `portal-config-edit`; the plain
arm is cheaper on the three portal-page cases and on `data-fair-line`; `portal-config-multi`
leans plain with overlapping ranges; `calendar` is a tie. Quality differs on two cases:
`portal-page-switch` (form 1/3) and `portal-config-edit` (plain 2/3, plus a failed check).

## What is costlier, and why

Cost follows turns more than bytes: each turn replays the conversation from cache, and the
responses that would have dominated (95 KB `describeState`, 145 KB `readSchema`) were cut
before the model read them. What makes a run expensive is a call sequence that keeps adding
turns, or output the model has to write.

**`charts-edit` — plain costlier: the single-level patch makes the agent rewrite `chart`.**
The form arm wrote the two fields at their full paths in two calls, identically in all three
runs (#2–#3), after one 8 KB `describeState`. The plain arm read the 29 KB schema each time
(#2) and had to resend the whole `chart` object to change one metric. r2 and r3 did that in
one patch. r1 resent the whole document (#3, 5 KB): it mangled `datasets[0].href` to
`…/datasets?`, which was accepted. It noticed on re-reading (#4), sent a malformed patch
(#5, 400), and repaired it (#6): 16.7k output tokens, 285k input.

**`portal-config-edit` — plain much costlier, and less reliable: the changed key sits in a
9 KB object.** The colour is `theme.assistedModeColors.primary`. Under a single-level patch the
agent must resend `theme` whole, about 9.3 KB including a 5 KB `@font-face` CSS string. r1 did
it in one 9.7 KB patch (#8) but nested 19 other top-level sections (`header`, `navBar`,
`footer`…) inside `theme`. The theme schema accepts extra keys, so it was stored and the "nothing
else changed" check failed (17.6k output tokens). r2 never managed to emit the theme: 29k
output tokens, no theme write, unsatisfactory ("every attempt … came out malformed or
truncated"). r3 took 22 calls and 63k output tokens. #8 was refused (400 on `hcDarkColors`).
#9 was accepted although it dropped `assistedModeColors` and `assistedMode`. #10 nested the
sections like r1. #15 tried nulling them at the root (400, required). Schema reads #16–#19 and
writes #20–#21 finally gave a clean theme. The menu half was easy in all three runs (one
216-byte patch, #7). The form arm needed 10–11 calls at 77–90k: one `setFieldValue` for the
colour (#4), then `editArray` add, a variant switch and a suggestion for the menu item
(#5–#9), each run losing one call on a `$oneOf` path without its variant index (#7).

**`portal-page-list-edit` — form costlier: the form's description of a page is far bigger than
the page.** The document is 7.5 KB, and the plain arm read it, wrote it back whole with one
title changed (r1, r2: 3 calls, 29k). Its 145 KB `readSchema` was unused (and cut). The form's
`describeState` without a path answers 95 KB (#1 every run), and `/$comp-2/elements` 91 KB:
every one of the 11 blocks lists every variant of its block type union. r1 jumped straight to
the data path (`/elements/6/children/2/title`, #3–#4, 4 calls, 51k). r2 and r3 navigated:
root (and `/` in r3), `/$comp-2`, `/$comp-2/elements` (r2 #1–#5, r3 #1–#6). Two refused guesses
(`/blocks`, `/thematiques`) and a refused hybrid path (r3 #8 `/$comp-2/elements/6/children/2/title`:
a layout prefix with data segments) took them to 9–11 calls and 113–128k. The plain
arm's price is output: 3.8–4.3k tokens to re-emit the page, against 0.9–2.1k. In dollars the
two arms are close ($0.005 against $0.003–0.005).

**`portal-page-reorder` — form costlier: no move in `editArray`, and the same large reads.**
Plain: 3 calls in every run, one whole-document write with the three edits, 30k. Form: r1 and
r2 described the 95 KB root, then the 91–93 KB `/elements`. Moving the alert meant re-adding
it with a value the agent copied itself and removing the original: r1 added first (#3) and
removed after (#6), the uuid briefly duplicated; r2 removed (#8) then re-added (#9). That made 10–11 calls and 114–144k. r3 fell back on
`setData` with the whole `elements` list (#3): 4 calls and 63k, the plain arm's method through
the form.

**`portal-page-switch` — form costlier and mostly wrong: a variant switch leaves the old
variant's keys.** Switching the block's `$oneOf` to the alert (r1 #5, r2 #10, r3 #10) kept the text
block's `centered: false`. The response even listed `…/$oneOf/1/centered` as "no longer
available", yet ended "no error here / form is invalid" with nothing locating the error. r1
and r2 spent the rest of the run looking for it and ended invalid, with `centered` still stored
(check "the paragraph's own setting is gone" failed). r3 found it by reading the data (#13)
and rewrote the whole item with `setFieldValue` at its section path (#14). The runs took
13–14 calls and 192–241k. The plain arm wrote the whole page once, alert built by hand, in all three runs
(51–84k). Each run lost a call on `/$defs/alert` (404) and read all of `$defs` (136 KB, cut).

**`portal-config-multi` — form somewhat costlier: no way to find a field but walking the
tabs.** Four settings on four tabs. r1 and r3 described the root (64 KB) and then tab after
tab (r1 #2–#11, r3 #2–#12) before writing; 20–21 calls, 247–343k. r2 guessed data paths
(`/breadcrumb`, `/footer/links`, `/datasets/card/showDepartment`) and was done in 12 calls,
135k. The setting the user calls "department" is labelled « Afficher le propriétaire », so a
label search alone would not have found it. The plain arm sent one 1.6 KB patch in every run
(the whole `footer` resent, nothing lost). Its extra calls were guessed schema paths answering
404 with no hint of what exists there (r1 #4–#6 under `/properties/theme/…`, r2 #4–#5).

**`data-fair-line` — form costlier: field-by-field writes and type round trips.** As in round
1. The SIRET went in as a JSON number in all three form runs (#8, "must be string"). The quoted
retry stored the quotes (r1 #11, r2 #10, r3 #11), and only `setData` fixed it (r1 #18, r2 #14, r3 #16).
r1 also sent the commune as a number (#10) and scalars to the two multi-valued selects (#12–#13,
"must be array"); r2 did the same (#12–#13). Session r1 and r2 used one `setData`, but it
dropped the memorised commune list (#3→#4), costing a re-search. Session r3 went field by field
with the same SIRET loop (#7, #10, #14), 17 calls. The plain arm is no longer at round 1's
4 calls: without `httpGet` the lookup's 404 on the prefixed id cost 1–2 calls in r1/r2 and
the whole of r3.

**`calendar` — tie.** Plain: 6 calls in every run (dataset search, `describe_dataset` 10 KB,
schema 6.7 KB, one write). Form: 9–11 calls of cheaper reads; extra `describeState`s and a
look at the optional contributions dataset (r2, r3 #10–#11) bought nothing.

## Quality failures per arm

**form / session**

- `portal-page-switch` r1, r2: unsatisfactory, document invalid, stale `centered` kept. The
  only form-side wrong end state in the round. Both answers told the user the form was
  invalid.
- Nothing else: every check passed in every other form and session run.

**plain**

- `data-fair-line--plain` r3: unsatisfactory, nothing written (harness 404, see caveats). It
  did not guess: it reported the code it would use as unverified.
- `portal-config-edit--plain` r2: unsatisfactory, colour never changed (theme not writable in
  practice).
- `portal-config-edit--plain` r1: judged satisfactory, but the check "nothing changed but the
  main colour and the menu" failed. 19 top-level sections were copied inside `theme` and
  stayed there.
- **Silent wrong writes accepted** (200 OK, nothing in the answer):
  `charts-edit--plain` r1 #3 (dataset `href` mangled; fixed at #6);
  `portal-config-edit--plain` r1 #8 and r3 #10 (sections nested in the open `theme` schema;
  r1 kept them); r3 #9 (`assistedModeColors` and `assistedMode` dropped; restored at #10).
  Each is a whole-object resend that a single-level patch forces and the schema does not catch.
- `calendar--plain`: three runs stored two `labelField` shapes (the whole column in r1/r3,
  `{key, label}` in r2), both accepted, and the check accepts both. Whether the application
  renders from `{key, label}` is not checked.

## Improvement leads

Only leads the transcripts above support.

**Form tools**

- **`describeState` without a path on a large form should be an outline.** It answered 95 KB
  for a 7.5 KB page and 62–64 KB for portal configurations. It was cut before the model read
  it, and was called up to four times in a run (list-edit r2, r3). Each array item repeats its
  union's full variant list (`/elements`, 91 KB for 11 blocks).
- **Accept, or explain, a path mixing layout and data segments.** `/$comp-2/elements/6/children/2/title`
  was refused (list-edit r3 #8, switch r3 #8), although the data path and the full form path
  both work. Its not-found error lists the root tabs, not the path to use.
- **A `$oneOf` path without its variant index should be answered with the index.** In
  `portal-config-edit`, `…/children/2/$oneOf/pageRef` (r1, r2 #7) and `…/children/2/pageRef`
  (r3 #7) got the top-level tab list. All three runs lost a call.
- **A variant switch must drop the previous variant's keys,** or at least name them as the
  error. `centered` survived the switch and the form said only "form is invalid"
  (portal-page-switch r1 #5, r2 #10, r3 #10). This is a library bug, and the round's only
  form-side quality failure.
- **A `move` action in `editArray`.** Moving a block cost copy, add, remove with a duplicated
  uuid in between in r1 (reorder r1 #3/#6, r2 #8/#9), or a whole-list `setData` (r3 #3).
- **Find fields by key or label.** Two `portal-config-multi` runs walked 9–11 tabs to locate
  four settings; the run that guessed data paths halved the cost.
- **`[object Object]` in suggestions** of object values (`portal-config-edit` #8 every run,
  `portal-config-multi` r1 #15, r2 #10, r3 #18). Still open since `2026-10-02-portal-config`.
- **Digits for a text field: coerce or say how.** A 14-digit number for a `pattern=^\d{14}$`
  string (`data-fair-line` all form runs, session r3), and a commune code as a number (r1 #10).
  The quoted retry stores the quotes.
- **Show a multi-valued select as an array** in `describeState` (`/activites (select,
  values=[…])` gives no hint; form r1 and r2 #12–#13 wrote scalars).
- **Keep memorised suggestions across writes that do not touch the field**
  (`data-fair-line--session` r1 and r2 #3→#4: `setData` without `/commune` dropped its list).

**Plain API and harness**

- **Fix the lookup id**: accept the `dataset:` prefix as the schema writes it, and list the
  known referential ids in the 404 (`data-fair-line--plain` r3; r1, r2 lost calls too).
  Harness defect, fix before the next round.
- **`readSchema` without a path should not answer 128–145 KB.** It was called first in every
  portal run, cut every time, and the agents then read by pointer. An outline (top-level
  properties with titles, `$defs` names) would serve the same purpose.
- **404s on schema and document paths should name the sibling keys** at the deepest existing
  level (`portal-config-multi--plain` r1 #4–#6, r2 #4–#5; `portal-page-switch--plain`
  `/$defs/alert` in every run, followed by a 136 KB read of `$defs`).
- **Open sub-schemas accept misplaced sections.** `theme` took 19 foreign top-level keys
  (`portal-config-edit--plain` r1 #8, r3 #10). This is a property of the vendored schema,
  not of the arm. A single-level patch makes it bite, because every edit inside `theme`
  re-emits all of it.
- **The single-level patch is the plain arm's main cost on application configurations.**
  It was 285k input tokens on `charts-edit` r1, 164–826k and one failure on `portal-config-edit`.
  This is the API data-fair has; a deeper patch would change the comparison. That is a product
  decision, not a lead for the eval.
