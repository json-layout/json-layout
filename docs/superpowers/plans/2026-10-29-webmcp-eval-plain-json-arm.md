# WebMCP eval: plain-JSON arm Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run every eval case under three arms (page form tools, server form session, plain JSON API), with targeted checks on the final data, and report the arms side by side.

**Architecture:** An arm is a session object with one interface (`tools`, `toolNames`, `prompt`, `call`, `evidence`), built by a factory from the case and the arm name. The stdio server and the launcher select it with `JL_WEBMCP_EVAL_ARM`. Remote lists can be served offline from case fixtures. Checks are pure functions over the final data, and the report groups runs per case and arm.

**Tech Stack:** Node ESM + JSDoc types, `node --test`, json-layout core (`compile`, `StatefulLayout`, `WebMCP`), `@json-layout/agents` `FormSession` (imported by relative path, dev-only), `claude -p` subprocess runners, the `webmcp-eval-judge` subagent.

**Spec:** `docs/superpowers/specs/2026-10-28-webmcp-eval-plain-json-arm-design.md`

## Global Constraints

- Work on branch `feat-plain-json-arm` in `/home/alban/github/json-layout_feat-plain-json-arm`. Never rebase or force-push. No version bumps, publishes or PRs.
- Touch only `core/webmcp-eval/**`, `core/test/webmcp-eval*.spec.js`, `.claude/skills/webmcp-eval/SKILL.md`, `.claude/agents/webmcp-eval-judge.md`, `core/webmcp-eval/README.md`, and the "Why not just hand the model the schema" section of `core/src/webmcp/README.md`. **No change to `core/src/**` or `agents/src/**` code.**
- Isolation stays as today: neutral cwd, `--setting-sources=`, `--strict-mcp-config`, `--tools ""`, `--allowedTools` naming exactly the arm's tools, MCP server name `page-form`. Nothing the runner sees names the eval, the case or the arm.
- Default model stays `haiku`.
- The default arm is `form` (today's page tools) and its evidence names stay as they are today, so existing baselines and the existing `--variant` keep working.
- Deterministic tests stay offline (`npm test -w core`).
- Code style: match the harness (JSDoc typedefs, long explanatory comments only where a choice needs defending, `node:test` with `describe`/`it`).

## Review Focus

- A plain-arm `httpGet` with a URL the fixtures do not know must answer a 404-like error text, never fall through to the network during an offline case.
- `patchDocument` with `null` values must delete keys (RFC 7396), and a patch on a non-object root must be refused, not crash.
- Two arms of the same case and two repeats of the same arm must never write the same evidence or sidecar file.
- A run whose arm is not runnable (auto-save session before `FormSession` has the mode) must report `not runnable`, not `not run` or a pass.
- The `unchangedExcept` check must treat array index paths and object keys the same way (`/menu/children/2` excluded means that item only).

---

### Task 1: Checks on final data

**Files:**
- Create: `core/webmcp-eval/checks.js`
- Modify: `core/webmcp-eval/cases/types.ts` (add `EvalCheck`, `checks?: EvalCheck[]` on `EvalCase`; delete the stale `expectedComplexity`/`expectedSchemaFits`/`withSchema` fields if no case or spec reads them — grep first)
- Test: `core/test/webmcp-eval-checks.spec.js`

**Interfaces:**
- Produces:
  ```ts
  type EvalCheck =
    | { path: string, equals: unknown, label?: string }                 // deep equality, after normalize
    | { path: string, values: string[], separator?: string, label?: string } // multi-valued: same set
    | { unchangedExcept: string[], label?: string }                      // vs the arm's start
  type CheckResult = { label: string, ok: boolean, detail: string }
  runChecks(checks: EvalCheck[], data: unknown, start: unknown): CheckResult[]
  ```
  `path` is a JSON pointer. `equals` is deep equality, except that an expected string matches an actual number when `String(actual) === expected` (so `'44190'` matches `44190`, while `'0612345678'` never matches a number, whose leading zero is lost). `values` accepts an array or a string split on `separator` (default `,`), trims, ignores order and duplicates. `unchangedExcept` deep-compares `data` with `start` after deleting each excluded pointer from both. `label` defaults to a readable rendering of the check.

- [ ] **Step 1: Write the failing tests** — one `describe('runChecks')` with:
  - `equals` passes on `{a:{b:'x'}}` / `/a/b` / `'x'`, fails with a detail quoting the actual value on `'y'`, fails with "missing" when the path does not exist.
  - `equals` `'0612345678'` passes on the string, fails on the number `612345678`; `'44190'` passes on the number `44190`.
  - `values ['a','b']` passes on `['b','a','a']` and on `'a, b'`, and on `'a;b'` with `separator: ';'`; fails on `['a']`.
  - `unchangedExcept ['/x']` passes when only `/x` changed, fails naming the first differing pointer when `/y` changed; with `['/list/1']` a change in `list[1]` passes and a change in `list[0]` fails.
- [ ] **Step 2:** `cd core && node --test test/webmcp-eval-checks.spec.js` → FAIL (module not found).
- [ ] **Step 3:** Implement `runChecks` in `checks.js` (pure, no imports from `src/`).
- [ ] **Step 4:** Same command → PASS.
- [ ] **Step 5:** Commit `feat(webmcp-eval): targeted checks on a run's final data`.

### Task 2: Offline remote fixtures

**Files:**
- Modify: `core/webmcp-eval/cases/types.ts` (add `remote?: (url: URL) => unknown`)
- Create: `core/webmcp-eval/remote.js`
- Modify: `core/webmcp-eval/session.js` (`EvalSession` uses it)
- Test: `core/test/webmcp-eval-remote.spec.js`

**Interfaces:**
- Produces: `caseFetch(evalCase: EvalCase, options?: { fetch?: Function }): ((url: string, init?: RequestInit) => Promise<any>) | undefined` — when the case has `remote`, returns a fetch resolving URLs against `DEFAULT_DATA_FAIR_URL`-style base `http://eval.local/` and answering `remote(url)`'s value; a value of `undefined` throws `Error('404 Not Found: <url>')`. When the case has no `remote`, returns `options.fetch` (possibly undefined: the network as today). The fixture base URL constant: `FIXTURE_BASE_URL = 'http://eval.local/'`, used as `fetchBaseURL` for fixture cases.
- `EvalSession` passes `caseFetch(...)` as `layoutOptions.fetch` and `FIXTURE_BASE_URL` as `fetchBaseURL` when the case has `remote`.

- [ ] **Step 1: Failing tests:** a case with `remote: (url) => url.pathname === '/items' ? ['a'] : undefined` resolves `items` to `['a']` and rejects `other` with `404`; an `EvalSession` over a small schema whose field has `layout.getItems.url: 'items'` returns `a` from `getFieldSuggestions` with no network (pass no `fetch`, assert by the fixture being hit).
- [ ] **Step 2:** run → FAIL. **Step 3:** implement. **Step 4:** run → PASS, plus `node --test test/webmcp-eval.spec.js` still PASS.
- [ ] **Step 5:** Commit `feat(webmcp-eval): serve a case's remote lists from fixtures`.

### Task 3: The plain-JSON arm

**Files:**
- Create: `core/webmcp-eval/plain-api.js`
- Modify: `core/webmcp-eval/cases/types.ts` (add `apiAccepts?: (doc: unknown) => unknown`: the API's input tolerance, applied before validation)
- Test: `core/test/webmcp-eval-plain-api.spec.js`

**Interfaces:**
- Consumes: `caseFetch` (Task 2), `compile` from `../src/compile/index.js`.
- Produces: `class PlainApiSession` with the same public surface as `EvalSession`: `tools`, `toolNames`, `prompt` (string), `call(name, args)`, `data`, `valid`, `start` (the starting document as this arm sees it: `structuredClone(evalCase.data)`), `evidence()` (same shape as `EvalEvidence` plus `arm: 'plain'`), `report()`.
  Tools (names exact):
  - `readDocument { path?: string }` — JSON of the document or the value at a JSON pointer; unknown path → error text.
  - `readSchema { path?: string }` — JSON of the raw case schema (as the case holds it, compat already applied) or at a pointer.
  - `writeDocument { document: object }` — replaces the document.
  - `patchDocument { patch: object }` — RFC 7396 merge patch on the document.
  - `httpGet { url: string }` — GET resolved against the case's base (`FIXTURE_BASE_URL` for fixture cases, the data-fair base otherwise); the special relative URL `context` answers the case's `context` (spec ruling). Returns the JSON body text.
  Writes: `apiAccepts` (if any) then validation with the case schema compiled through core's `compile` with the case's `compileOptions` (so both arms validate with the same ajv setup); invalid → `isError: true`, text `400 Bad Request` + one line per ajv error (`<instancePath> <message>`), document unchanged. Valid → `200 OK` and the stored keys count. `parseIfJsonString` tolerance as in core: a `document`/`patch` given as a JSON string is parsed.
  `prompt`: a neutral API description naming the five tools and the `context` URL, then the schema's `x-agent-guide` text verbatim when present (spec ruling). No form-tool guide.
- [ ] **Step 1: Failing tests:** reading the whole document and `/a`; `readSchema` at `/properties`; `writeDocument` with an invalid document → `isError`, `400`, data unchanged; `patchDocument {a: null}` deletes `a`; `patchDocument` on `[]` refused; `httpGet('context')` returns the context; `httpGet('unknown')` on a fixture case → error text containing `404`; `apiAccepts` turning `'a, b'` into `['a','b']` makes an otherwise invalid write valid; `prompt` contains the schema's `x-agent-guide` and none of `describeState`, `setFieldValue`.
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(webmcp-eval): a plain JSON API arm over the same case`.

### Task 4: The session arm (server form session)

**Files:**
- Create: `core/webmcp-eval/session-arm.js`
- Modify: `core/webmcp-eval/cases/types.ts` (add `saveMode?: 'explicit' | 'auto'`, default `'explicit'`)
- Test: `core/test/webmcp-eval-session-arm.spec.js`

**Interfaces:**
- Consumes: `createFormSession` from `../../agents/src/index.js` (relative import; dev-only, the eval is not published), `caseFetch`.
- Produces: `class FormSessionArm` with the `EvalSession` surface plus `runnable: boolean` and `notRunnableReason?: string`. Spec: `load` returns `structuredClone(evalCase.data)`; `save` stores a clone in `this.saved` and counts saves; `schema` returns the case schema; `compileOptions`, `options: { fetch, fetchBaseURL, context }` as `EvalSession`. `tools` = `session.getTools()` (await `open()` first: the class has an async `static async create(evalCase)`). `prompt` = `RUNNER_PROMPT`-equivalent for a server session + `session.getSkill()`.
  `data` = **the last saved document** (`this.saved`, or the start when nothing was saved): what persisted is what the checks score. `start` = the session's state after open, before any edit (`layout.data` cloned at open), per the spec ruling on normalized starts.
  `runnable`: `saveMode === 'auto'` is runnable only when `FormSession` supports an auto mode (feature-detect a documented spec field; until the follow-up adds it, `false` with reason `FormSession has no auto-save mode yet`).
- [ ] **Step 1: Failing tests:** over `contact`, `setData` then `saveForm` → `data` equals the saved document and `saves === 1`; a `setData` without save leaves `data` at the start; `toolNames` include `saveForm`; a case with `saveMode: 'auto'` → `runnable === false` and the reason.
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(webmcp-eval): run a case through a server form session`.

### Task 5: Arm and repeat plumbing, checks in evidence

**Files:**
- Create: `core/webmcp-eval/arms.js`
- Modify: `core/webmcp-eval/session.js` (`EvalSession` gains `start`, `prompt` getter returning `RUNNER_PROMPT + skill`, and `arm: 'form'` in evidence), `server.js`, `run-case.js`
- Test: `core/test/webmcp-eval-runner.spec.js` (extend), `core/test/webmcp-eval.spec.js` (extend)

**Interfaces:**
- Produces:
  - `ARMS = ['form', 'session', 'plain']`; `createArm(evalCase, arm): Promise<ArmSession>`; unknown arm throws listing `ARMS`.
  - `evidenceName(name, variant?, arm?, run?)`: `name`, then `--<variant>` unless default, then `--<arm>` unless `form`, then `.r<run>` when `run` is given. Today's names are unchanged for the default form arm without `--runs`.
  - Every arm's `evidence()` carries `arm`, `start`, and `checks: runChecks(case.checks ?? [], data, start)`.
  - `buildLaunchArgs` takes the arm's `prompt` (replacing the `skill` option's concatenation) and `toolNames`; the system prompt for `form` stays byte-identical to today.
  - CLI: `--arm <form|session|plain|all>` (default `form`) and `--runs <n>` (default 1; with `n > 1` every run gets `.r1..rn`). Env passed to the server: `JL_WEBMCP_EVAL_ARM`, `JL_WEBMCP_EVAL_RUN`.
  - A non-runnable arm: `runCase` writes the sidecar with `ok: false, notRunnable: true, error: <reason>` and spawns nothing.
- [ ] **Step 1: Failing tests:** `evidenceName('c')` === `'c'`; `evidenceName('c', undefined, 'plain', 2)` === `'c--plain.r2'`; `buildLaunchArgs` for a plain arm allows exactly the five `mcp__page-form__<tool>` names and its system prompt contains no form-tool name; for the form arm the args equal today's (snapshot the existing expectation); a non-runnable arm writes `notRunnable` and the stub spawn is never called; every evidence includes `checks`.
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** `npm test -w core` → PASS.
- [ ] **Step 5:** Commit `feat(webmcp-eval): select an arm and repeat runs`.

### Task 6: Comparison report

**Files:**
- Modify: `core/webmcp-eval/report.js`
- Test: `core/test/webmcp-eval-report.spec.js` (extend)

**Interfaces:**
- Consumes: evidence `arm`, `checks`; sidecars `notRunnable`.
- Produces: `summarise(runs)` keeps today's per-run lines and adds, per case, a comparison block: one row per arm with runs count, calls min–max, output bytes min–max, input tokens min–max, cost min–max, checks passed (`k/n` per run), verdicts (`s/u` counts). Exit fails on any unsatisfactory, invalid, unjudged, missing run, **or any failed check**; a run judged satisfactory with a failed check prints `satisfactory, CHECK FAILED: <label> — <detail>`. A `notRunnable` sidecar prints `<label>: not runnable — <reason>` and does not fail the report. The CLI discovers `.rN` and `--<arm>` evidence files for the requested cases.
- [ ] **Step 1: Failing tests** for: the comparison rows with two arms × two runs; a failed check failing the report while the verdict is satisfactory; `not runnable` not failing; ranges printed as `a–b` (single value when equal).
- [ ] **Step 2:** FAIL. **Step 3:** implement. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(webmcp-eval): compare arms side by side`.

### Task 7: The line-form case

**Files:**
- Create: `core/webmcp-eval/cases/schemas/data-fair-line.json`, `core/webmcp-eval/cases/data/communes.json`
- Modify: `core/webmcp-eval/cases/index.js`, `core/test/webmcp-eval.spec.js`

**Interfaces:**
- Schema: a data-fair REST line form as data-fair/mcp's `prepareEditorSchema` (`~/data-fair/mcp/src/editor-schema.ts`) produces it from the experiment's register (`/home/alban/data-fair/data-fair_feat-autonomous-agents/simulations/runner/line-edition-fixtures.ts`: 15 columns, `x-required`, enum `type_lieu`, patterns on `telephone` and `siret`, `date_ouverture`/`date_fermeture`, multi-valued `activites` and `publics` with separator `, `, `commune` with `x-fromUrl`). Capture it from the running dev stack if available (`GET /data-fair/api/v1/datasets/<id>/schema?mimeType=application/schema+json&extension=true&arrays=true`, then `prepareEditorSchema`), otherwise hand-write it following `editor-schema.ts`. The `commune` list URL becomes `communes?q={q}`. Record the source in `README.md`'s vendored-schemas table.
- Fixture `communes.json`: about 60 communes of Loire-Atlantique and elsewhere with `{ code, nom }`, including Saint-Sébastien-sur-Loire `44190`, Saint-Herblain `44162`, at least 15 other `Saint-…` communes with lower codes, Rezé `44143` and the homonym Rézentières `15161`.
- `remote(url)`: for `/communes`, the whitespace-separated words of `q`, accent- and case-insensitive, must **all** appear in `nom`; results sorted by `code`, at most 10, `{ results: [...] }` or the shape the schema's `itemsProp` says. So `St-Sébastien` finds nothing and `Sébastien` finds the right one.
- `apiAccepts`: mirrors data-fair's line API: a string for `activites`/`publics` is split on `,` and trimmed; a number for a string column becomes its string.
- Goal (loose text, as a forwarded email): a new venue at "St-Sébastien", phone and SIRET written as bare digits, activities "judo, ju-jitsu et self-défense", audiences listed in prose, an opening date written "le 3 mars 2025". `data: {}`. `saveMode: 'explicit'`.
- Checks: `/commune` equals `'44190'`; `/telephone` equals the digit string; `/siret` equals the digit string; `/activites` values; `/publics` values; `/date_ouverture` equals `'2025-03-03'`.
- [ ] **Step 1:** Extend `webmcp-eval.spec.js`: the case compiles; `getFieldSuggestions` on `/commune` with `St-Sébastien` returns none and with `Sébastien` returns 44190, offline; a document satisfying every check passes `runChecks` and validates in the plain arm after `apiAccepts`.
- [ ] **Step 2:** FAIL. **Step 3:** add schema, fixture and case. **Step 4:** `npm test -w core` → PASS.
- [ ] **Step 5:** Commit `feat(webmcp-eval): a data-fair line form case with a referential trap`.

### Task 8: Coherence and large-document checks

**Files:**
- Create: `core/webmcp-eval/cases/data/calendar-remote/*.json`, `core/webmcp-eval/capture-remote.js` (one-off capture script, documented)
- Modify: `core/webmcp-eval/cases/index.js`, `core/test/webmcp-eval.spec.js`

**Interfaces:**
- `calendar` becomes the coherence case on fixtures: run `capture-remote.js calendar` once against koumoul.com to record every URL the calendar pickers request for its goal (dataset list with the owner filter, the chosen dataset's schema), store them under `calendar-remote/`, and set `remote` to serve them. Checks: the chosen dataset is "Agenda-manifestations" (pointer and expected id/href read from the capture), the label column key equals the event-name column's key, the crowd-sourcing flag under the `x-if`-opened section equals `true`.
- `portal-config-edit`: `saveMode: 'auto'` (a portal configuration is draft-bound) and checks: main colour pointer is set (value not pinned: the goal says "a dark green"; use `unchangedExcept` on the colour and menu pointers), the menu contains the `jeunesse` page (pointer from the case data structure).
- `charts-edit`, `portal-page-edit`: one `unchangedExcept` check each, excluding exactly the part their goal asks to change (read the goals to pick the pointers).
- [ ] **Step 1:** Spec assertions: calendar resolves its pickers offline from the capture; each new check passes on a document built from the case start plus the goal's change, and fails when an unrelated pointer changes.
- [ ] **Step 2:** FAIL. **Step 3:** capture and wire. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat(webmcp-eval): checks for coherence and small edits of large documents`.

### Task 9: Judge, skill and README

**Files:**
- Modify: `.claude/agents/webmcp-eval-judge.md`, `.claude/skills/webmcp-eval/SKILL.md`, `core/webmcp-eval/README.md`

- [ ] **Step 1:** Judge: receives the arm and its tool list; judges "did this agent get through these tools" for any arm; may read `core/webmcp-eval/plain-api.js` for the plain arm and `core/src/webmcp/` / `agents/src/` for the others; never told check results.
- [ ] **Step 2:** Skill: `--arm` / `--runs` usage, evidence names, deleting `core/tmp/webmcp-eval-*` before a comparison, one judge per run file, `not runnable` is not dispatched.
- [ ] **Step 3:** README: arms, checks, fixtures, the comparison report, and that verdicts stay blind to checks.
- [ ] **Step 4:** `npm test -w core` → PASS (the runner spec asserts the skill's command lines still parse if it already does; otherwise nothing to run).
- [ ] **Step 5:** Commit `docs(webmcp-eval): arms, checks and the comparison`.

### Task 10: First comparison run and the rationale update

Spends Claude quota (haiku, about $0.05–0.15 per run).

- [ ] **Step 1:** `rm -f core/tmp/webmcp-eval-*` then `npm run webmcp-eval:run -w core -- line-form calendar portal-config-edit charts-edit contact --arm all --runs 3` (≈ 45 runs; `session` on portal-config-edit reports not runnable).
- [ ] **Step 2:** One `webmcp-eval-judge` per run file, verdict written beside it (as the skill says). Plain Agent dispatches, not a workflow.
- [ ] **Step 3:** `npm run webmcp-eval:report -w core -- line-form calendar portal-config-edit charts-edit contact` and copy evidence, sidecars, verdicts and the printed report to `core/webmcp-eval/baselines/2026-10-29-plain-json-arm/` with a README of findings per claim.
- [ ] **Step 4:** Update `core/src/webmcp/README.md` "Why not just hand the model the schema": under each of the five reasons, one or two sentences of what the comparison measured (wins, ties, losses), linking the baseline. No claim the runs do not support.
- [ ] **Step 5:** Commit `docs(webmcp-eval): first plain-JSON comparison`.
