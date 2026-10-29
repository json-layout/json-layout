# WebMCP eval round 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the plain arm realistic (targeted lookup tools, single-level patch), add nested-document cases, break costs down per kind of call, and re-run the comparison.

**Architecture:** The plain arm's tools change in place; lookup tools are declared per case and implemented in a small module over the case's remote (fixture or live). New cases reuse the portal schemas with richer starting documents built through the form. The report gains a per-kind cost block computed from evidence calls.

**Tech Stack:** as round 1 (Node ESM, JSDoc, node:test, `claude -p` runners, webmcp-eval-judge).

**Spec:** `docs/superpowers/specs/2026-10-28-webmcp-eval-plain-json-arm-design.md` (section "Round 2").

## Global Constraints

- Branch `feat-plain-json-arm` in `/home/alban/github/json-layout_feat-plain-json-arm`. Never rebase, force-push or stash. No version bumps, publishes or PRs.
- Touch only `core/webmcp-eval/**`, `core/test/webmcp-eval*.spec.js`, `.claude/skills/webmcp-eval/SKILL.md`, `.claude/agents/webmcp-eval-judge.md`, and the README rationale sections. No change to `core/src/**` or `agents/src/**`.
- Nothing any arm's runner sees names the eval, the case or the arm. Deterministic tests offline. Default model haiku.
- Round 1's baseline folder stays untouched.

## Review Focus

- A plain-arm patch naming a nested key path (`{"a.b": 1}` or a nested object) must replace the top-level key `a` wholly — never deep-merge.
- A case without lookups must expose no lookup tool and nothing that fetches; the plain arm then has to work without remote lists.
- Lookup tools must answer from the same data the form arm's pickers see (fixture or live), so neither arm gets different facts.
- A starting document for a new case must be one the form accepts as valid (built through the form, not hand-written).
- The truncation flag must be computed from what the runner received, not guessed from schema size.

---

### Task 1: Realistic plain arm

**Files:** Modify `core/webmcp-eval/plain-api.js`, `core/webmcp-eval/cases/types.ts`; Create `core/webmcp-eval/lookups.js`; Test `core/test/webmcp-eval-plain-api.spec.js`, `core/test/webmcp-eval-lookups.spec.js`.

**Interfaces:**
- `patchDocument { patch: object }` becomes single-level: each top-level key of `patch` replaces the document's key entirely (`null` deletes it); nested objects in the patch are values, not merges. Description states it as data-fair's `patch_dataset` does ("Array and object fields replace the current value entirely: read it first and send the complete new value").
- `httpGet` and the `context` pseudo-URL are removed.
- Case field `lookups?: string[]` naming tools from a fixed catalogue in `lookups.js`:
  - `list_account_datasets { q?: string, size?: number }` → `{ count, results: [{ id, title, href, … }] }` over the case's dataset listing (fixture via `caseFetch`, else live `api/v1/datasets` with the case `context.datasetFilter`).
  - `describe_dataset { datasetId: string }` → the dataset's columns (key, type, title, x-refersTo) from its schema.
  - `get_field_values { datasetId: string, fieldKey: string, q?: string, size?: number }` → matching values (for the line case: communes as `{ code, nom }` via the case remote).
  - `list_portal_pages { type?: string }` → the case `context.pages` entries (portal cases).
  Each returns JSON text; errors as error text. `createLookupTools(evalCase, { fetch, baseURL }) => ToolDescriptor[]`, recorded like other calls.
- PlainApiSession tools = readDocument, readSchema, writeDocument, patchDocument + the case's lookups.

- [ ] Step 1: failing tests: shallow patch replaces a nested object wholly; patch with `null` deletes; no `httpGet` tool; a case with `lookups: ['get_field_values']` exposes exactly that lookup and it finds 44190 for `q: 'Sébastien'` on data-fair-line; a case without lookups exposes none; prompt names no removed tool.
- [ ] Step 2: run → FAIL. Step 3: implement. Step 4: `cd core && node --test test/webmcp-eval*.spec.js` → PASS.
- [ ] Step 5: declare lookups on existing cases: data-fair-line `['get_field_values']`; calendar, charts, charts-edit, charts-pie, choropleth `['list_account_datasets', 'describe_dataset']`; portal cases that read `context.pages` `['list_portal_pages']`; contact none. Full core suite once. Commit `feat(webmcp-eval): a plain arm with targeted lookups and single-level patch`.

### Task 2: Check kinds for removals and lengths

**Files:** Modify `core/webmcp-eval/checks.js`, `cases/types.ts`; Test `core/test/webmcp-eval-checks.spec.js`.

**Interfaces:** add `{ path, absent: true, label? }` (passes when the pointer resolves to nothing) and `{ path, length: number, label? }` (array length).

- [ ] Steps: failing tests (absent passes on a missing key and a removed array tail, fails when present; length passes/fails) → implement → pass → commit `feat(webmcp-eval): absence and length checks`.

### Task 3: Nested-document cases

**Files:** Modify `core/webmcp-eval/cases/index.js`; Create `core/webmcp-eval/cases/data/portal-page-rich.json` (and others as needed), a builder script `core/webmcp-eval/build-start.js` (documented one-off); Test `core/test/webmcp-eval.spec.js`.

**Interfaces:** four cases on the portals schemas, each with a goal phrased as a user would, `lookups` as relevant, `saveMode: 'auto'`, and checks (stated facts + `unchangedExcept` on the touched pointers):
- `portal-page-list-edit`: a page with at least 8 blocks, some nested (two-columns with children); edit one property of a block in the middle of a nested list.
- `portal-page-reorder`: insert a new block at a stated position, move another, remove a third.
- `portal-page-switch`: change a block's type (e.g. a text block becomes a card or image) keeping its stated content; the old variant's fields must be gone (`absent`).
- `portal-config-multi`: three or four scattered edits across distant sections of the portal configuration in one request.
Starting documents are produced through the form (EvalSession `setData` + `editArray` from a script, kept only if the form reports valid) and stored under `cases/data/`.

- [ ] Steps: failing spec (each case compiles; each start document validates in the form; each check set fails on the start and passes on start + intended edit, built through the form) → build starts → add cases → pass → commit `feat(webmcp-eval): nested-document edit cases`.

### Task 4: Cost breakdown and truncation flag

**Files:** Modify `core/webmcp-eval/report.js`, `core/webmcp-eval/arms.js` (call-kind map); Test `core/test/webmcp-eval-report.spec.js`.

**Interfaces:** `callKind(arm, toolName) => 'read-state' | 'read-schema' | 'write' | 'lookup' | 'other'` (form/session: describeState/getData → read-state, setData/setFieldValue/editArray/saveForm → write, getFieldSuggestions → lookup, openSection/reloadForm → other; plain: readDocument → read-state, readSchema → read-schema, write/patch → write, lookups → lookup). Per case × arm the report prints, per kind: calls, output bytes, failed calls (min–max over runs). A call whose `outputBytes` exceeds `TRUNCATION_BYTES = 100_000` (Claude Code's MCP output cap is about 25k tokens) is counted and printed as `oversized: N` per run, with a legend line.

- [ ] Steps: failing tests (kinds per arm; breakdown rows; oversized count) → implement → pass → commit `feat(webmcp-eval): cost breakdown per kind of call`.

### Task 5: Docs

**Files:** `.claude/agents/webmcp-eval-judge.md`, `.claude/skills/webmcp-eval/SKILL.md`, `core/webmcp-eval/README.md`.

- [ ] Plain arm tools (lookups per case, single-level patch), the new check kinds and cases, the breakdown block; the skill's tool-list one-liner still works; also move check results out of the judge's sight: the skill tells the orchestrator to give the judge a copy of the transcript without the `checks` field (one-liner writing `core/tmp/webmcp-eval-<label>.judge.json`), and the report ignores those files. Commit `docs(webmcp-eval): round 2`.

### Task 6: Round 2 comparison

Spends quota (haiku).

- [ ] `rm -f core/tmp/webmcp-eval-*`; run `npm run webmcp-eval:run -w core -- data-fair-line calendar charts-edit portal-config-edit portal-page-list-edit portal-page-reorder portal-page-switch portal-config-multi --arm all --runs 3`.
- [ ] One judge per case × arm, verdicts per run, transcripts without checks.
- [ ] Report; copy to `core/webmcp-eval/baselines/2026-10-29-round-2/` with a README: per case × arm costs and breakdown, what is costlier and why, failures and friction anchored to calls, and the improvement leads they point to (form tools and plain API alike).
- [ ] Update `core/src/webmcp/README.md`'s measured notes where round 2 changes them. Commit `docs(webmcp-eval): round 2 comparison`.
