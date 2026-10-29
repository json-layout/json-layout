# Baseline — 2026-10-29, round 3: round 2's leads fixed, auto-save sessions

Third comparison of the three tool surfaces (spec:
`docs/superpowers/specs/2026-10-29-editor-tools-round-3-design.md`; round 2 is
[`2026-10-29-round-2`](../2026-10-29-round-2/README.md)). What changed since round 2
(`git log 31beb2d..09af8de`):

- **Form tools.** `describeState` without a path on a large form answers an outline (16 KB
  budget, union options listed once per list). It takes a `query` that finds fields by key,
  title or description. Mixed layout/data paths resolve, and a path that does not resolve
  names the deepest node reached. A variant switch drops the previous variant's keys (see
  finding a), and "form is invalid" always comes with a located error. `editArray` has `move`.
  Writes are tolerant of JSON spelling (a number for a text field, a scalar for a list). Lists
  are shown as lists. Suggestions survive writes that do not touch them. A query with no close
  match says so. A referential value that was not picked from the field's suggestions is
  accepted with a warning.
- **Sessions.** `save` option on writes; an `auto` save mode (saved after every valid write);
  a create session empties after saving. The session arm now runs the seven auto-save cases
  as well as `data-fair-line` (explicit save).
- **Harness.** Lookups accept `dataset:communes` as the schema writes it, and an unknown id
  lists the known ones. Plain 404s name the deepest existing level and its keys. Plain
  `readSchema` without a path answers an outline over the same budget as the form's. Judges
  only get their transcript copy. The oversized flag is set at 60 KB.

## Setup and caveats

- Model `haiku` (served as `claude-haiku-5-5`), 3 runs per arm on the 8 comparison cases
  (form, session, plain), plus the 9 other cases once with the form arm for regression. Code
  at `09af8de`. 81 runs, all judged (one judge per case × arm, a verdict per run).
- **n=3, one model.** Only repeated, large differences are read as signal below.
- **Judges.** They were told to read only their transcript copy, the schema and the case goal.
  One judge (`portal-config-edit--plain`) also compared with the starting document. Its finding
  (a font file name altered) is confirmed independently by the check. One verdict had a
  friction `call` written as the string "9" (`portal-config-multi--plain` r1). The controller
  changed it to the number 9 and nothing else.
- **What the model read.** No form or session response exceeded 16 KB. The plain arm's
  `portal-page-switch` read `/$defs/element` (135 KB) in every run and `/$defs/element/oneOf`
  (128 KB) in r1; both were over the cap and cut.
- Cost is priced with caching and parallel runs share a cache, so dollars are indicative;
  input tokens (input + cache read + cache write) are the steadier measure. Output tokens
  matter more than in round 2: the plain arm's whole-document writes cost 4–13k output
  tokens, which are priced far above the cache reads that make up most input tokens.

Files: `<case>[--arm][.r<n>].json` (evidence), `.run.json` (runner sidecar), `.verdict.json`,
`report.txt` (the printed `webmcp-eval:report`; its exit code 1 reflects the two
unsatisfactory runs and failed checks).

## Comparison

Ranges over 3 runs. Satisfied = judged satisfactory. Checks per run.

| case | arm | calls | input tokens | output tokens | cost | satisfied | checks |
|---|---|---|---|---|---|---|---|
| data-fair-line | form | 4–13 | 33–37k | 1.2–1.9k | $0.003 | 3/3 | 6/6 ×3 |
| | session | 5–13 | 36–47k | 1.3–2.1k | $0.003–0.004 | 3/3 | 6/6 ×3 |
| | plain | 4–5 | 31–40k | 1.4–1.6k | $0.002–0.003 | 3/3 | 6/6 ×3 |
| calendar | form | 9–12 | 63–90k | 1.2–1.5k | $0.003–0.004 | 3/3 | 3/3 ×3 |
| | session | 9–12 | 64–90k | 1.1–1.6k | $0.003–0.004 | 3/3 | 3/3 ×3 |
| | plain | 6–7 | 45–88k | 2.2–8.0k | $0.004–0.009 | 3/3 | 3/3 ×3 |
| charts-edit | form | **3** | **29k** | 0.5k | $0.002–0.003 | 3/3 | 3/3 ×3 |
| | session | 3 | 29k | 0.4–0.5k | $0.002–0.003 | 3/3 | 3/3 ×3 |
| | plain | 7–9 | 89–159k | 1.8–3.3k | $0.007 | 3/3 | 3/3 ×3 |
| portal-config-edit | form | 9 | **90–91k** | 1.2–1.3k | $0.004–0.005 | 3/3 | 2/2 ×3 |
| | session | 10–13 | 100–150k | 1.5–1.9k | $0.005–0.006 | 3/3 | 2/2 ×3 |
| | plain | 8–10 | 113–178k | 7.2–13.0k | $0.010–0.016 | **1/3** | **1/2**, 2/2, **1/2** |
| portal-page-list-edit | form | 3–5 | 60–84k | 0.5–0.9k | $0.004–0.005 | 3/3 | 2/2 ×3 |
| | session | 4–5 | 67–83k | 0.6–0.7k | $0.004–0.005 | 3/3 | 2/2 ×3 |
| | plain | 3–4 | **29–55k** | 3.9–4.0k | $0.004–0.005 | 3/3 | 2/2 ×3 |
| portal-page-reorder | form | 6–7 | 97–100k | 1.4–1.6k | $0.005–0.006 | 3/3 | 18/18 ×3 |
| | session | 5–6 | 74–98k | 1.7–1.8k | $0.005–0.006 | 3/3 | 18/18 ×3 |
| | plain | **3** | **29k** | 4.0–4.1k | $0.005 | 3/3 | 18/18 ×3 |
| portal-page-switch | form | 4–5 | **56–73k** | 0.8–0.9k | $0.004 | 3/3 | 5/5 ×3 |
| | session | 3–5 | 54–56k | 0.7–0.9k | $0.004 | 3/3 | 5/5 ×3 |
| | plain | 6–11 | 68–140k | 4.6–4.9k | $0.006–0.007 | 3/3 | 5/5 ×3 |
| portal-config-multi | form | 14–18 | 124–151k | 2.0–2.5k | $0.006–0.007 | 3/3 | 10/10 ×3 |
| | session | 13–19 | 125–173k | 2.2–2.5k | $0.006–0.007 | 3/3 | 10/10 ×3 |
| | plain | 10–12 | 85–129k | 2.3–3.5k | $0.007–0.009 | 3/3 | 10/10 ×3 |

Form arm, round 2 → round 3 (round 2 figures from its README):

| case | calls | input tokens | cost | satisfied |
|---|---|---|---|---|
| data-fair-line | 15–19 → 4–13 | 56–57k → 33–37k | $0.004 → $0.003 | 3/3 → 3/3 |
| calendar | 9–11 → 9–12 | 61–88k → 63–90k | $0.003–0.004 → same | 3/3 → 3/3 |
| charts-edit | 3 → 3 | 28k → 29k | $0.002–0.003 → same | 3/3 → 3/3 |
| portal-config-edit | 10–11 → 9 | 77–90k → 90–91k | $0.004 → $0.004–0.005 | 3/3 → 3/3 |
| portal-page-list-edit | 4–11 → 3–5 | 51–128k → 60–84k | $0.003–0.005 → $0.004–0.005 | 3/3 → 3/3 |
| portal-page-reorder | 4–11 → 6–7 | 63–144k → 97–100k | $0.006–0.007 → $0.005–0.006 | 3/3 → 3/3 |
| portal-page-switch | 13–14 → 4–5 | 192–241k → 56–73k | $0.007–0.009 → $0.004 | **1/3** → 3/3 |
| portal-config-multi | 12–21 → 14–18 | 135–343k → 124–151k | $0.006–0.012 → $0.006–0.007 | 3/3 → 3/3 |

The ranges narrowed on the portal cases. The worst form run fell from 128k to 84k on
list-edit, 144k to 100k on reorder, 241k to 73k on switch and 343k to 151k on multi;
`portal-config-edit` stayed at about 90k. The plain arm moved too. `data-fair-line` lost its harness failure (2/3 → 3/3,
40–49k → 31–40k). `portal-config-edit` costs less (164–826k → 113–178k) but fails more often
(2/3 → 1/3 satisfied). `portal-page-switch` costs more (51–84k → 68–140k), mostly
r3's 11 calls of probing (below).

Per case, form against plain:

- **charts-edit**: form about 3× cheaper ($0.002–0.003 against $0.007; 29k against
  89–159k). Quality equal.
- **portal-config-edit**: form 2–3× cheaper ($0.004–0.005 against $0.010–0.016). Plain is
  1/3 satisfied, with two failed checks.
- **portal-page-switch**: form cheaper, by about 35% in dollars and 20–50% in input tokens.
  Quality equal (form was 1/3 in round 2).
- **calendar**: form cheaper in dollars ($0.003–0.004 against $0.004–0.009, plain output
  2–8k). Input tokens tie. Quality equal.
- **portal-config-multi**: tie. Form uses more input tokens (124–151k against 85–129k) but
  costs slightly less in dollars ($0.006–0.007 against $0.007–0.009). Quality equal.
- **data-fair-line**: tie, plain marginally cheaper ($0.002–0.003 against $0.003). Quality
  equal.
- **portal-page-list-edit**: tie in dollars ($0.004–0.005 both). Plain reads half the input
  tokens and writes 4k output tokens. Quality equal.
- **portal-page-reorder**: plain cheaper, by 3.4× in input tokens (29k against 97–100k) but
  only 10–20% in dollars. Quality equal.

The session arm costs the same as the form arm wherever ranges can be compared. Auto-save
added no calls. Its extra calls on `portal-config-edit` (10–13) are path slips (below) and
read-backs.

Regression cases, form arm, one run each, all satisfactory: `contact` (2 calls, $0.002),
`charts` (20 calls, $0.007), `portal-page` (10, $0.003), `portal-page-edit` (4, $0.003, 2/2
checks), `choropleth` (12, $0.007), `portal-menu-catalog` (8, $0.003), `portal-menu-explain`
(3, $0.002), `portal-page-catalog` (3, $0.003), `charts-pie` (3, $0.003).

## What is costlier now, and why

**`charts-edit` — plain costlier: the schema outline is empty, then a 25 KB read and a whole
`chart` resent.** The form arm is unchanged: one 8 KB `describeState`, two `setFieldValue`
(#1–#3, identical in all six form and session runs). The plain arm's `readSchema` outline
(#2, 189 bytes) lists no properties, because the schema's root is an `allOf`. It still says to
read `/properties/<key>`, which answered 404 in every run (#3, and #4 in r1). The 404 named
the root's keys, so the agents read `/definitions` (25 KB) and `/allOf` (4 KB) next. Then the
single-level patch made them resend the whole `chart` object: 5.1 KB in r1 and r3, and in r2 a
trimmed 0.5 KB version refused with a list of `oneOf` errors (#6) before a valid one (#7).

**`portal-config-edit` — plain costlier, and the theme is still where it goes wrong.** The
form did the same nine calls in every run: outline (15.5 KB), `query: "principale"` (r1, r2)
or the data path `/theme/assistedModeColors` (r3), which found the colour in one call, then
one `setFieldValue`, then `editArray` add, the variant switch and the page suggestion (#4–#8).
Round 2's lost call on a `$oneOf` path without its index is gone (`…/children/2/pageRef`
resolves, #7). The plain arm still resends `theme` whole. r1 retyped it (#6, 6.4 KB). r3 sent
21 top-level keys in one 9.9 KB patch (#5): it dropped `news.card.thumbnail.useDescription`,
noticed it, and repaired it (#7). In both runs, one character of a font file name inside
`bodyFontFamilyCss` changed (`XRXX3I6Li…` → `XRXV3I6Li…`, same position). The write answered
`200 OK, stored 23 top-level key(s)`, nobody noticed, and the check failed. r2 nested the
sections in `theme` again (#7), saw it on re-reading (#8), and rewrote the whole document
cleanly (#9). The cost is 7–13k output tokens, against 1.2–1.3k for the form.

**`portal-page-reorder` — form still costlier: three edits are three calls, and the outline
is replayed each turn.** The form now does it in the minimum sequence: outline (15.8 KB),
`editArray move` (#2), `remove` (#3), a 6.2 KB `describeState` of an item to see the divider's
shape (#4, r1–r2), `add` with `{type: "divider"}` (#5), then a 7.2 KB `getData` to verify
(#6). r3 replaced the verification with two item descriptions (#6–#7). Round 2's
copy/add/remove with a duplicated uuid is gone, and the worst run went from 144k to 100k. The
plain arm still reads the 7.5 KB page and writes it back once (3 calls, 29k, all runs). The
form pays its 16 KB outline at every one of its 6–7 turns. The plain arm pays 4k output tokens
once, so in dollars the gap is only 10–20%.

**`portal-page-list-edit` — tie in dollars, plain half the input.** The form found the card
in 3–5 calls: outline, `describeState` of `/elements/6/$oneOf/14/children/2` (9 KB, opening
with its union's variant list), one `setFieldValue`. Two form runs and all three session runs
first asked `describeState` for "Thématiques à la une", the section's title as a *value*; the
query searches keys, titles and descriptions only, and answered "no field matches" (#1). The
plain arm wrote the whole `elements` list back (7.8–8 KB, 4k output tokens) after one read.

**`portal-page-switch` — now cheaper through the form.** The switch is one `setFieldValue` on
the block's `$oneOf` (#3 or #4) and the stored block is clean in all six form and session runs.
The remaining calls are the outline, a 3 KB item description and `getData` read-backs
(r1 #3 and #5, r2 #4, r3 #3 and #5). The plain arm read `/$defs/element` (135 KB, cut) in
every run. r1 also read `/$defs/element/oneOf` (128 KB, #4). r3 probed `/$defs/alert`,
`/$defs/element/properties/type` (two 404s) and then the variants one by one (#4–#8), 11
calls and 140k.

**`portal-config-multi` — tie; the form spends a call per setting and some on a quoted
value.** The outline plus targeted `describeState`s (#2–#5) replaced round 2's tab walking, and
the worst run went from 343k to 151k. Four of the six form and session runs wrote
`"\"above-footer\""` (a JSON-quoted string) to the breadcrumb select (form r1 #8, r3 #11;
session r1 #8, r2 #9). The write answer flagged it at once ("choisissez une valeur") and it cost one retry each
(form r3 retried with `setData`, #12). Form r1 and r3 ended with 3–4 `getData` read-backs. The
plain arm sent the four settings in one patch of 1.6–3.1 KB, each changed top-level object
whole (r3 a second patch for `breadcrumb` and `footer`, #9). Besides the outline, it read four
schema pointers (#4–#7).

**`data-fair-line` — tie.** The SIRET went in as a JSON number in every form and session run
that wrote field by field, and was stored as the string (form r1 #8, r2 #7; session r2 #8, r3
#8). The quote-and-`setData` loop of rounds 1 and 2 is gone. Form r3 and session r1 used one
`setData` (4–5 calls). The others wrote ten fields one by one (12–13 calls), still under round
2's form runs in input tokens (33–47k against 56–57k), because each call is small. The
plain arm: schema, one lookup, one write. The fixed lookup took the prefixed id (r1, r2). r3
passed the id with a suffix of its own appended, got "known ids: communes" (#3), and
recovered in one call.

**`calendar` — tie in tokens, form cheaper in dollars.** Plain is 6–7 calls in every run
(dataset search, 10 KB `describe_dataset`, 6.7 KB schema, one write). r2 also searched for a
contributions dataset (#5–#6) and wrote 11 KB, 8k output tokens. Form and session: 9–12 calls.
Their wasted calls are `describeState` queries for "crowd sourcing" before a dataset is chosen
(form r1, r3, session r1–r3 #3). That section is hidden until then, and the answer said only
"no field matches". An English query "event name" on French column titles got "No option
matched" (form r1 #6, r2 #5).

## Quality failures per arm

**form / session**

- None. Every run of every case was judged satisfactory and passed every check, including the
  9 regression cases.
- **Finding a, `choropleth`: stale data after a variant switch (not checked, judged low).** The
  agent added an indicator (`editArray add`, #4), which defaults to the `enum` variant. It set
  its dataset (#6), then switched to `range` with `setFieldValue` on
  `/$allOf-2/indicators/0/$oneOf`, value `0` (#7), the regular selector switch. The final data
  still holds `enumOptions: {scheme: {type: "qualitative", name: "Paired", offset: 0, computed:
  true}}`, the enum variant's default palette, beside the range options. The form stayed valid.
  The agent noticed it on its final `getData` (#12) and told the user. This is a gap in the
  round 3 fix (`ffadfbb`), which acts through validation. `activateItem` drops the previous
  variant's keys itself only when the layout sets `oneOfLayout.emptyData`. Otherwise they go
  through `removeAdditional: 'error'`, which removes a key only when the new variant refuses it
  (`additionalProperties: false`). The choropleth indicator's variants are open, so
  `enumOptions` stays. A probe on the current code confirms it: the same switch keeps the
  previous variant's key when the variants are open and drops it when they are closed. The
  portal page's blocks are closed, which is why `portal-page-switch` is clean.
- **Finding b, `charts` #14: the picks warning was correct.** At #14 the agent wrote `"valeur"`
  to the metric's column (`…/valueCalc/$oneOf/1/field`) by `value`, without having listed that
  field's suggestions. Its only attempt (#11) failed because the variant was not active yet.
  `valeur` came from the group-by field's list (#10, 21 columns, all types). The warning
  ("was not among the suggestions listed for this field") was therefore right. The field's own
  list, read at #18, has 6 numeric columns, `valeur` among them. The agent re-applied it by
  index (#19), two calls for a value that was in fact allowed.

**plain**

- `portal-config-edit--plain` r1, r3: unsatisfactory; check "nothing changed but the main
  colour and the menu" failed. One character of a font file name in `theme.bodyFontFamilyCss`
  was altered by the retyped `theme` (r1 #6, r3 #5) and stored with `200 OK`. r3 also dropped
  `news.card.thumbnail.useDescription` and restored it (#7).
- **Silent wrong writes accepted** (200 OK, no diff in the answer): the two above, and r2 #7
  (sections nested inside the open `theme` schema; repaired at #9).
- `calendar--plain`: as in round 2, `labelField` was stored as `{key, label}` (r1) or `{key,
  title}` (r3), both accepted; whether the application renders from them is not checked.

## Improvement leads

Only leads the transcripts above support, in priority order.

**Form tools**

- **A variant switch should drop the previous variant's keys on open schemas too** (finding a,
  `choropleth` #7). On an explicit switch, `activateItem` could remove the previous variant's
  `propertyKeys` that the new one does not declare, as `emptyData` already does for every key.
  This is the only form-side wrong end state of the round. It reaches the stored configuration.
- **Unquote a JSON-quoted string whose unquoted form is an allowed value**:
  `"\"above-footer\""` in 4 of 6 `portal-config-multi` form and session runs, one or two calls
  each. This extends the round's tolerant input (number → text, scalar → list).
- **Read `/comp-2/…` as `/$comp-2/…`,** or answer with the corrected path. The `$` was dropped
  six times (list-edit form r2 #3, session r1 #3; switch session r3 #2; config-edit session r2
  #4, r3 #3–#4). Each time, the not-found answer listed the root tabs and cost a call.
- **`describeState` query: match values, and say when a match is hidden.** "Thématiques à la
  une" (a card title) missed in 5 of 6 list-edit form and session runs. "crowd sourcing" missed
  in 5 of 6 calendar runs because its section is hidden until a dataset is chosen. Both
  answered "no field matches", with no reason.
- **Several array edits in one call.** `portal-page-reorder` is the last case where the plain
  arm is clearly cheaper in input tokens. The form needs a call per edit, and each turn
  replays the 16 KB outline. Batches were a non-goal of this round; the evidence for them is
  this case.
- **Smaller item descriptions on recursive unions.** A path description of one page block
  lists all of its union's variants (46 lines) before its fields: 6.2 KB for a divider's
  neighbour (reorder #4) and 9 KB for a card (list-edit). `portal-page-edit`'s judge flagged
  the same thing on its 8.4 KB read.
- Lower: the picks warning could say "no suggestions were listed for this field yet" when none
  were (`charts` #14). `describeState` on a field hidden by a condition says "not in the form
  yet … writable once chosen" while the data holds it (`portal-config-edit` r3 #9; `getData`
  gives the right message, session r1 #12).

**Plain API and harness**

- **The schema outline must follow `allOf` roots and `definitions`** (harness defect). On
  `charts-edit` it listed no properties, pointed to `/properties/<key>` and `/$defs/<name>`, and
  every run lost one or two calls to a 404, then read 25 KB of `definitions`. Fix before the
  next round.
- **An outline for any over-budget pointer, not only the root.** `/$defs/element` answered
  135 KB in every `portal-page-switch` plain run and was cut. A list of the union's variants
  with their discriminator values would have given the alert's shape directly (r3 probed for
  it in 5 calls).
- **A write answer naming what changed.** `stored 23 top-level key(s)` hid a one-character
  corruption and a dropped key (`portal-config-edit--plain` r1 #6, r3 #5). The form's scoped
  write results do not have this problem. This is the plain arm's main quality failure, and it
  comes from the single-level patch. data-fair's APIs are single-level by product decision, so
  this is a lead for the API's answer, not for a deeper patch.
