# Editor tools round 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix every round-2 lead in the form tools and sessions, fix the harness defects, and re-measure.

**Architecture:** Changes stay in the existing homes: path resolution in `core/src/webmcp/resolve.js`, projections in `project.js`, tools in `core/src/webmcp/tools/*`, orchestration and suggestions in `core/src/webmcp/index.js` / `suggestions-store.js`, variant activation in `core/src/state/index.js`, sessions in `agents/src/session.js`, eval in `core/webmcp-eval/**`.

**Tech Stack:** plain JS + JSDoc, node:test, `claude -p` runners, webmcp-eval-judge.

**Spec:** `docs/superpowers/specs/2026-10-29-editor-tools-round-3-design.md` (goal ids H*, F*, S*, M* below refer to it). Background: `core/webmcp-eval/baselines/2026-10-29-round-2/README.md` (the transcripts' evidence for each lead).

## Global Constraints

- Branch `feat-editor-round-3` in `/home/alban/github/json-layout_feat-editor-round-3`. Never rebase, force-push or `git stash`. No version bumps, publishes, PRs.
- Before changing a tool's behaviour, read the git history of the file (`git log -p --follow`) and do not revert a choice listed in the spec's Anti-goals.
- Tests: `npm test -w core` (662 green at start), `npm test -w agents` (43 green). Run the touched spec files while iterating, the full suites before committing. Lint: `npm run lint`.
- Error and result wording: one plain sentence per fact, saying what to do next; match the existing messages' tone in the file.
- Nothing any eval runner sees names the eval, the case or the arm.
- One commit per task (fix-ups allowed), conventional message, ending with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

## Review Focus

- A variant switch on a list item in "menu"/"dialog" edit mode (duplicated activated item) must drop the old keys on the stored item, not only on the editable copy.
- `move` with `from === to`, out-of-range indexes, and a move inside a list whose items hold memorized suggestions or picks: paths must follow the item.
- Coercion must not apply inside a `oneOf`/`anyOf` whose branches accept the original type, nor turn `""` into a number, nor coerce an object.
- A pick recorded on `/rows/2/commune` must follow its item on `editArray` remove/move of an earlier item, or be dropped — never silently attached to another item.
- In auto save mode, a write that leaves the form invalid must not persist and must say it was not saved.

---

### Task 1: Harness fixes (H1–H5)

**Files:** `core/webmcp-eval/lookups.js`, `core/webmcp-eval/plain-api.js`, `core/webmcp-eval/report.js`, `.claude/agents/webmcp-eval-judge.md`, `.claude/skills/webmcp-eval/SKILL.md`; tests `core/test/webmcp-eval-lookups.spec.js`, `core/test/webmcp-eval-plain-api.spec.js`, `core/test/webmcp-eval-report.spec.js`.

**Interfaces:**
- Lookups: a `datasetId` of `dataset:<id>` is read as `<id>`; an unknown id answers `404 Not Found: no dataset "<id>"; known ids: <comma list>` (list from the case's remote data).
- Plain reads: a pointer that does not resolve answers `404 Not Found: <pointer>; the deepest existing level is <pointer> with keys: <keys>` (first 40 keys, then `…`).
- `export const OUTLINE_BUDGET_BYTES = 16_000` in `plain-api.js`. `readSchema` without a path, when the schema's JSON exceeds the budget: an outline text with each top-level property (key, type, title), `required`, and the `$defs` names, ending with a line saying to read a part with a pointer (`/properties/<key>`, `/$defs/<name>`). Under the budget: unchanged.
- `TRUNCATION_BYTES` becomes `60_000` (comment: Claude Code caps MCP output at 25,000 tokens; round 2 saw 95 KB responses cut, so a conservative 2.4 bytes/token).
- Judge: the agent definition's `tools` is `Read` only; its instructions say to read only the transcript path it is given. The skill says to pass the `.judge.json` copy's path and nothing else.

- [ ] Step 1: failing tests: `get_field_values({datasetId: 'dataset:communes', fieldKey: …, q: 'Sébastien'})` finds 44190; `describe_dataset({datasetId: 'nope'})` text contains `known ids:` and `communes`; plain `readSchema({path: '/$defs/alert'})` on the portal-page schema answers 404 text listing existing `$defs` keys; `readSchema()` on portal-page is ≤ 16 KB and names `elements`; on contact (small) is the whole schema; oversized counts a 70 KB call.
- [ ] Step 2: run → FAIL; Step 3: implement; Step 4: `cd core && node --test test/webmcp-eval*.spec.js` → PASS.
- [ ] Step 5: commit `fix(webmcp-eval): lookup ids as schemas write them, plain 404s and outline, blind judges`.

### Task 2: Variant switch drops the old variant's keys; invalid always located (F4)

**Files:** `core/src/state/index.js` (`activateItem`), `core/src/webmcp/index.js` / `project.js` (error projection of setFieldValue/setData results); tests `core/test/` (a state spec near existing oneOf tests, and a webmcp spec).

**Interfaces:** after `activateItem(oneOfNode, k)`, the parent data holds no key that belongs only to the previously active branch, including keys declared by that branch through composition (`allOf`, `$comp-*` sections) and in lists edited in menu/dialog mode. A write result reporting the form invalid always includes at least one error with its path; when the scoped errors are empty but the form is invalid, it lists up to 3 errors from elsewhere with their paths.

- [ ] Step 1: reproduce with the portal-page fixture (`core/webmcp-eval/cases/data/portal-page-rich.json`, schema of case `portal-page-switch`): switch the text block named in that case's goal to the alert variant through `setFieldValue(<item path>/$oneOf, <alert index>)`; assert `centered` is gone from `getData` and the form is valid after setting the alert's required fields. Also a minimal compiled schema test in the state layer (oneOf of two object branches, the first with an extra key declared via allOf).
- [ ] Step 2: run → FAIL; Step 3: find why `skeleton.propertyKeys` of the previous branch misses the key (use superpowers:systematic-debugging), fix at the cause; Step 4: core suite green.
- [ ] Step 5: commit `fix(core): a variant switch drops every key of the previous variant`.

### Task 3: Path resolution (F2, F3)

**Files:** `core/src/webmcp/resolve.js`; tests `core/test/webmcp*.spec.js` (where resolve is tested).

**Interfaces:**
- `resolveNode(root, path)` also accepts a layout prefix followed by data segments (`/$comp-2/elements/6/children/2/title`): once a layout segment reaches a node, remaining segments are followed as data keys / indexes from there (as `43cde7b` does the other way round).
- A key directly under a `$oneOf` (`…/children/2/$oneOf/pageRef` or `…/children/2/pageRef` where the item is a union) resolves to the active branch's child of that key.
- Not found: the error names the deepest node reached and lists up to 20 of its children's paths; if the key exists in a non-active variant, it names the path with that variant's index (`…/$oneOf/3/pageRef`) and says to switch first.

- [ ] Steps: failing tests on the portal-page fixture (the three round-2 paths: `/$comp-2/elements/6/children/2/title`, `/menu/children/2/$oneOf/pageRef`-like from the portal-config fixture, and a typo path) → implement → green → commit `fix(core): resolve mixed layout and data paths, and say where a missing path leads`.

### Task 4: describeState outline, multi-valued fields, object suggestions (F1, F9, F7)

**Files:** `core/src/webmcp/project.js`, `core/src/webmcp/tools/describe-state.js`, `core/src/webmcp/tools/get-field-suggestions.js`; tests.

**Interfaces:**
- `export const OUTLINE_BUDGET_BYTES = 16_000` (same value as the plain arm's). `describeState` without a path: when the full projection exceeds it, answer the outline: sections and direct fields with paths and values abbreviated; each list as `path (list, N items)` plus one line per item with its index, chosen variant title and a short label (title/first text field); the list's variant options once, under the list. Ends with one line: describe a path for details. With a path: unchanged, except that inside a list the union options are listed once under the list instead of per item.
- Multi-valued field (array of scalars, select with multiple, or a `separator`): projected as `path (list of <type>[, values=…]) = [..]`.
- A suggestion whose value is an object shows its title if any, else a compact JSON abbreviation; never `[object Object]`.

- [ ] Step 1: failing tests: portal-page fixture root `describeState` ≤ 16 KB and contains `/elements` with its item count; `/elements` description smaller than round 2's 91 KB by at least 5× and still names each item's chosen variant; data-fair-line schema `activites` shows `list of`; object-valued suggestion text has no `[object Object]`.
- [ ] Steps 2–4: FAIL → implement → green (fix existing expectations only where the change is the intended one). Step 5: commit `feat(core): an outline of a large form, lists shown as lists, readable object suggestions`.

### Task 5: Find fields by words (F6)

**Files:** `core/src/webmcp/tools/describe-state.js`, `project.js`; tests.

**Interfaces:** `describeState { path?, query? }`. With `query`: walk the whole state tree (or under `path`), keep visible field nodes whose key, title, label or description contains every word of the query (NFD-normalized, accents stripped, lowercase); answer one line per match `path (type) = value — title`, at most 30, plus a count when more. No match: say so and suggest describing the root. The tool description gains one sentence.

- [ ] Steps: failing tests on the portal-config fixture (`query: 'breadcrumb'` finds the breadcrumb field; `query: 'fil d'Ariane'`-like title words if present; no match message) → implement → green → commit `feat(core): find a form's fields by words`.

### Task 6: editArray move (F5)

**Files:** `core/src/webmcp/tools/edit-array.js`, `core/src/webmcp/index.js`; tests.

**Interfaces:** `action: 'add'|'remove'|'move'`, `from`, `to` (integers, required for move). Result `moved item from F to T, N total`. Errors: missing/out-of-range indexes name the valid range. Suggestions/picks memorized under the list follow the moved items (or are invalidated per Task 8's rule; until Task 8 the existing clear applies).

- [ ] Steps: failing tests (move 0→2 on a 3-item list keeps all items and their data; from===to is a no-op answer; out of range refused) → implement → green → commit `feat(core): move a list item with editArray`.

### Task 7: Tolerant input (F8)

**Files:** a pure helper `core/src/webmcp/coerce.js` (`coerceForNode(node, value) => { value, coerced?: string }`), used by setFieldValue and setData (per leaf, walking the data against the state tree); tests `core/test/webmcp-coerce.spec.js`.

**Interfaces:** rules only when the node's schema type is a single type: number/integer value → string for `type: 'string'`; scalar → `[scalar]` for `type: 'array'` of scalars; string containing the node's `separator` → split and trimmed for an array with a `separator`. Never inside a `oneOf`/`anyOf` selector, never `""`→number, never for objects. The write result adds `coerced: /siret number → string` style notes.

- [ ] Steps: failing unit tests for each rule and each exclusion; integration: data-fair-line schema, `setFieldValue('/siret', 12345678901234)` stores `"12345678901234"` and the form is valid → implement → green → commit `feat(core): accept a number for a text field and a single value for a list`.

### Task 8: Suggestions that survive, and "no close match" (F10, F11)

**Files:** `core/src/webmcp/suggestions-store.js`, `core/src/webmcp/index.js`, `core/src/webmcp/tools/get-field-suggestions.js`; tests.

**Interfaces:**
- `SuggestionsStore.dropUnder(prefix, fromIndex?)`, `SuggestionsStore.move(listPath, from, to)` (re-keys memorized paths of moved items). setData: `retainFresh` plus drop paths whose data value changed in this write. editArray add/remove: drop paths under the list from the first shifted index; move: re-key.
- A suggestions answer to a `query` where no item's title or value contains any query word (normalized as in Task 5) starts with `No suggestion matches "<query>" closely;` then lists the items as "other options".

- [ ] Steps: failing tests (session-r1 scenario: suggestions on `/commune`, setData of other fields, then suggestionIndex on `/commune` still works; editArray remove of item 1 keeps item 0's suggestions and drops item 2's; move re-keys item 0's suggestions to its new index; no-close-match text) → implement → green → commit `fix(core): keep suggestions a write does not touch, and say when none matches`.

### Task 9: Picked, not invented (F12, F13)

**Files:** `core/src/webmcp/suggestions-store.js` (or a sibling `picks.js`), `core/src/webmcp/index.js`, tools' write paths, the guide text (`core/src/webmcp/tools/fill-form-skill.js` or wherever the shared guide is generated); tests.

**Interfaces:**
- A node is *referential* when its layout has `getItems` with a `url`. Its value is *picked* when it equals (deep) the value of an item memorized for that path (Task 8 store, including invalidated-then-refetched), was written through `suggestionIndex`, or equals the value at load (baseline data when the instance started or last reset).
- Write results add a warning per unpicked referential value written: `<path>: <abbreviated value> was not among the suggestions listed for this field; pick one with getFieldSuggestions`.
- `WebMCP#unpickedValues() => Array<{path: string, value: unknown}>` (public, for the session).
- Guide: one line, "Values of fields whose options come from a list are picked from getFieldSuggestions, never typed from memory."

- [ ] Steps: failing tests on data-fair-line (write `/commune: '44173'` without suggestions → warning; after getFieldSuggestions q='Sébastien' and setFieldValue suggestionIndex → no warning; same value written directly after it was listed → no warning; loaded value unchanged → no warning) → implement → green → commit `feat(core): warn when a list field gets a value it was not offered`.

### Task 10: Sessions: save option, save modes, create reset (S1–S3)

**Files:** `agents/src/session.js`, `agents/src/index.js`, `agents/src/types.ts`; tests `agents/test/*`.

**Interfaces:**
- `export const SAVE_MODES = /** @type {const} */(['explicit', 'auto'])`; spec `saveMode?: 'explicit'|'auto'` (default explicit; unknown value throws).
- Explicit: `setData`, `setFieldValue`, `editArray` accept `save?: boolean`. After the write: invalid → `not saved: the form is invalid` + errors; unpicked values (Task 9) → `not saved: <path> value was not picked …; saveForm saves anyway`; else save and append the save result line (`saved, version …`). `saveForm` with unpicked values saves and appends the warning.
- Auto: no `saveForm` tool, no `save` property in schemas; after each write, valid → save (`saved`), invalid → `not saved yet: the form is invalid` ; guide text says edits are saved as they go while the form is valid. Unpicked values in auto: warning only.
- Create reset: a session whose spec has no `load` (or whose load returned no document) resets its layout to empty data and clears suggestions/picks after a successful save; the save result says `the form is empty again for a new record`.

- [ ] Steps: failing tests per mode (explicit save:true valid/invalid/unpicked; saveForm with unpicked; auto saves on valid write, not on invalid, has no saveForm; create reset) → implement → green → `npm test -w agents` and the eval specs (`core/test/webmcp-eval-session*.spec.js`, which feature-detect `SAVE_MODES`) green → commit `feat(agents): save with a write, auto-save sessions, a fresh form after creating`.

### Task 11: Docs

**Files:** `core/src/webmcp/README.md` (tool reference sections touched by Tasks 2–9: describeState outline/query, editArray move, coercion, picks), `agents/README.md` (save option, modes, create reset), `core/webmcp-eval/README.md` (H1–H5).

- [ ] Commit `docs: round 3 tool changes`.

### Task 12: Round 3 comparison (M1, M2) — spends quota (haiku)

- [ ] Final whole-branch review before running (most capable model), fix round if needed.
- [ ] `rm -f core/tmp/webmcp-eval-*`; build core and agents; run `npm run webmcp-eval:run -w core -- data-fair-line calendar charts-edit portal-config-edit portal-page-list-edit portal-page-reorder portal-page-switch portal-config-multi --arm all --runs 3`, then the other cases form-only `--runs 1` for regression.
- [ ] One judge per case × arm on `.judge.json` copies; report; baseline `core/webmcp-eval/baselines/2026-10-29-round-3/README.md` comparing with round 2 per case (what changed, what is still costlier and why, leads left); update the measured notes of `core/src/webmcp/README.md`. Commit `docs(webmcp-eval): round 3 comparison`.
