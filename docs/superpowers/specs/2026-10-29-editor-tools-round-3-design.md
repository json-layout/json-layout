# Editor tools, round 3: fix what round 2 measured, then measure again

Date: 2026-10-29. Status: design. Branch `feat-editor-round-3` (from `feat-plain-json-arm`).

## Intent

Round 2 (`core/webmcp-eval/baselines/2026-10-29-round-2/README.md`) compared the form tools with
a realistic plain JSON API (targeted lookups, single-level patch) on nested documents. The form
tools win clearly where a small change sits in a large object (application configurations), and
lose on portal pages. Every portal-page loss traces to a defect of the form tools, not of the
approach. The user's decision after reading it: "lets do every improvements including
fine-tuning we can", asking first only for very large changes or deep logic changes.

This round fixes every lead of round 2's "Improvement leads", folds in the approved tool-changes
design written for single-line edition
(`data-fair: docs/superpowers/specs/2026-10-28-editor-single-line-break-even-design.md`, goals 1–5
and 9, the json-layout half), fixes the two harness defects, and re-runs the comparison.

## Goals

### Harness

H1. **Lookup ids as the schema writes them.** `get_field_values` (and every lookup taking a
    dataset id) accepts `dataset:communes` as well as `communes`. An unknown id answers with the
    ids it knows.
H2. **Plain 404s name what exists.** A schema or document path that does not resolve answers
    with the deepest existing level and its keys (`/properties/theme/properties` has: …;
    `$defs` has: …).
H3. **Plain `readSchema` without a path is an outline on a large schema**: over a byte budget it
    answers top-level properties (key, type, title), required keys and the `$defs` names, and
    says to read by pointer for details. Same budget as the form's outline (F1), so neither arm
    gets a cheaper first read than the other.
H4. **Judges cannot see checks.** The judge agent's tools are restricted so it reads only the
    transcript copy it is given; its instructions forbid reading anything else.
H5. **The oversized flag matches what was cut.** Round 2 saw 95 KB responses cut under the
    100 KB flag; the threshold is set from Claude Code's MCP output cap in tokens with a
    conservative bytes-per-token ratio.

### Form tools (core)

F1. **`describeState` without a path on a large form is an outline.** Over a budget it shows the
    sections and their direct fields with paths, and lists lists by their item count and the
    variant chosen per item, not every option of every item. Within an array, the options of a
    union are listed once for the list, not per item (round 2: 91 KB for 11 blocks). A path
    request keeps today's full description of that node (`142c87a`: each option with its
    fields). Not a static overview (`3942850`): it is the live state, only shallower.
F2. **Paths that mix layout and data segments resolve**, e.g. `/$comp-2/elements/6/children/2/title`.
    A path that does not resolve answers with the deepest node it reached and that node's
    children paths, not the root tabs.
F3. **A key under a `$oneOf` without its variant index** resolves to the active variant's child
    when the active variant has that key; otherwise the error names the index path to use.
F4. **A variant switch drops the previous variant's keys** (`activateItem` already intends it;
    `centered` survived on the portal page). And "form is invalid" never comes without at least
    one located error path.
F5. **`editArray` gets a `move` action** (`from`, `to`), keeping the item's data and suggestions
    consistent.
F6. **Find fields without walking tabs**: `describeState` takes an optional `query`; the answer
    lists the fields whose key, title or description contain the query's words (accent- and
    case-insensitive), with their paths and current values. A parameter, not a new tool.
F7. **No `[object Object]` in suggestions** of object values: a title or a compact JSON value.
F8. **Tolerant input on JSON-spelling mismatches** (design goal 5): number → string for a string
    field, scalar → one-item array for an array field, separator split for an array field whose
    node declares a `separator`. In the tool layer, not ajv `coerceTypes`. The stored line says
    what landed.
F9. **A multi-valued field is shown as one**: `describeState` says it holds a list and shows
    its current value as an array.
F10. **Suggestions survive writes that do not touch them.** `setData` invalidates only memorized
    paths whose data it changed or whose `itemsCacheKey` changed; `editArray` only paths under
    the list from the first shifted index. The cumulative indexes stay (`adeccf7`).
F11. **"No close match"** (design goal 4): a suggestions answer whose items contain none of the
    query's words says so.
F12. **Picked, not invented** (design goal 3): a value written to a field whose options come
    from a remote list (`getItems` with a URL) that is not among the suggestions listed for
    that path in this instance, nor the value it had when loaded, is accepted with a warning
    naming the path and value. Picks are per data path, dropped when the path's `itemsCacheKey`
    changes. Core exposes whether unpicked values are present, for the session's hold.
F13. **One guide line** (design goal 9): referential values are picked from suggestions, never
    typed from memory.

### Sessions (agents)

S1. **`save` option** on the session's `setData`, `setFieldValue`, `editArray` (design goal 1).
    Valid form → saved, result reported; invalid → nothing saved, errors returned. Held while an
    unpicked referential value is in the form (F12); `saveForm` saves anyway and repeats the
    warning. `saveForm` and `reloadForm` stay.
S2. **Save modes** (design goal 1b): `SAVE_MODES = ['explicit', 'auto']` exported, `saveMode` in
    the session spec, default `explicit`. Auto persists after every write that leaves the form
    valid, exposes no `saveForm` and no `save` option; its guide says edits are saved as they
    go. Invalid writes stay local and say so.
S3. **A create session starts empty after a successful save** (design goal 2): a session with no
    loaded document resets to an empty form after its save. Edit sessions keep their behaviour.

### Measuring

M1. The eval's session arm runs on auto-save cases once S2 exists (it already feature-detects
    `SAVE_MODES`).
M2. Round 3 comparison: the eight round-2 cases, three arms where runnable, 3 runs, haiku, one
    judge per case × arm, plus the remaining form-only cases once each for regression. Baseline
    folder and README as in round 2, and the measured notes of `core/src/webmcp/README.md`.

## Non-goals

- The other repos' items of the tool-changes design (data-fair single search, openapi-mcp
  structured content and `x-agent.editor` save mode, data-fair/mcp bump): a follow-up, after
  this round's measure.
- A deeper patch for the plain arm: data-fair's APIs are single-level (user).
- Batches, code mode.

## Anti-goals (history, do not undo)

- Explicit save stays; `save` is a per-call request, never inferred from validity in explicit
  mode (`715eac0`).
- Suggestion indexes stay cumulative (`adeccf7`); `stored K key(s)` stays (`8247066`).
- No new describe tool, no static overview (`3942850`, `9bc31ed`). F1 and F6 change
  `describeState`'s answer, they add no tool.
- `setData` deep merge and `merge: false` naming dropped keys stay (`0c51e2f`, `715eac0`).
- Prompt rewording is not the lever; F13 is one line.
- Text-only tool results (`c5659c3`).

## Constraints

- json-layout AGENTS.md: changes to `core/src/webmcp/**`, tool descriptions, skill text, error
  projection are judged by the webmcp eval (M2).
- F4 touches `core/src/state` (shared with vjsf): the fix must keep the library's intended
  behaviour (drop the previous variant's properties) and its existing tests.
- Deterministic tests offline; no version bumps, publishes, PRs; never rebase, force-push or
  stash.
