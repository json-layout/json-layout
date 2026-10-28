# WebMCP eval: a plain-JSON arm, and cases that test what the form tools claim

Date: 2026-10-28. Status: design. Branch `feat-plain-json-arm` (from `main`).

## Intent

`core/src/webmcp/README.md` opens with "Why not just hand the model the schema and let it emit
JSON?" and answers with five reasons:

1. half the schema does not apply until something is chosen (`oneOf`, `x-if`, switches);
2. the accepted values are not in the schema (remote lists whose URL is built from other fields);
3. picked values can be far larger than the answer (a 12 KB dataset object);
4. the schema can be bigger than the whole conversation (`portal-page`, 286 KB);
5. the form is live: validation on every write, errors scoped to what changed.

None of these has been measured against plain tools: the eval only ever runs the form tools, and
judges a run from its transcript alone.

A data-fair experiment (an autonomous agent entering loosely written records into a 15-column
REST dataset, form tools vs plain JSON line tools) showed what this blind spot costs. The form
tools needed about 2.7x the calls and 3x the input tokens for the same quality, and two defects
there are of a kind this eval could not see:

- **A silently invented value.** The commune referential search never surfaced
  "Saint-Sébastien-sur-Loire"; the agent typed a code from memory (`44173`, the real one is
  44190), and the form answered `valid, no errors`. A judge reading the transcript cannot tell a
  wrong code from a right one.
- **Input spelling mismatches.** A phone or SIRET sent as a number to a text field, a multi-valued
  field sent as `"a, b"`: refused by the form, accepted by the API.

The user's aim: the eval should have been enough to reveal all that. It should **compare the form
tools with plain JSON tools on the same cases**, validate where the form tools bring value (the
coherence the suggestion system and expressions — `x-if`, switches, `getItems` URLs built from
data — provide; reading a large document to patch a small part), and cover this session's defects.
The form-tool changes that follow (a separate design,
`data-fair: docs/superpowers/specs/2026-10-28-editor-single-line-break-even-design.md`) are then
measured with it.

## Goals

1. **A plain-JSON arm**, selectable per run, on the same case: same goal, same starting document,
   same model, same isolation. Only the tools and the prompt differ. Its tools are what a well-made
   JSON API offers, honestly described, not sabotaged:
   - read the document, whole or at a path;
   - read the raw schema, whole or at a path (the schema as the case holds it, after the compat
     layer where a case applies one, vendor keywords included: `x-if`, `x-fromUrl` / `getItems`
     URL templates, switch layouts; the agent interprets them itself);
   - replace the whole document, or apply a JSON merge patch;
   - an HTTP GET for remote lists, to a URL the agent builds itself, against the same base the
     form arm's `getItems` uses.
   Every write is validated with ajv against the schema, as an API would, and refused with the
   errors as an API's 400 would be. Layout-level rules (`x-if` visibility, `getItems` lists) are
   not enforced, as an API would not enforce them. The arm's prompt is the goal and a short
   neutral description of the API, not the form guide.
2. **Both arms run on every case**, existing and new, with at least 3 runs per arm (the README
   records run-to-run variance reaching 3x on cost; n=1 is noise).
3. **Targeted checks on the final data** (user-approved). A case may carry a few assertions on the
   final document: a value at a path (`/commune` is `"44190"`), an unchanged subtree (every
   section but the edited one equals the starting document), a type. Not a full expected
   document: the README's reason against expected data (a hand-written blob is a guess about what
   the form accepts) still holds; a check pins only a fact the goal itself states. Checks are
   deterministic, reported per run, and run identically on both arms.
4. **New and extended cases:**
   - **line-form**: a record form shaped like a data-fair REST dataset line (about 15 columns):
     required fields, an enum, patterns, a date pair, two multi-valued columns with a separator, a
     text column the goal gives as digits (phone, SIRET), and a referential column whose options
     come from a remote list. The referential is served by the eval itself (a fixture, offline
     and deterministic, not koumoul.com) and must make the right value take some searching:
     several near-homonyms, and a hyphenated name a naive query does not surface first. The goal
     is loose text, like a forwarded email. Checks pin the referential code and the
     multi-valued and digit fields.
   - **coherence**: a case where the right document depends on expressions — a list whose URL is
     built from another field, an `x-if` section opened by a choice, a switch. `calendar` already
     has the dependent picker and the `x-if`; it is extended or a dedicated case is added
     (builder's choice). Checks pin the dependent value and the conditional section.
   - **large document, small patch**: the existing edit cases (`portal-config-edit`,
     `charts-edit`, `portal-page-edit`) with checks that everything outside the targeted part is
     unchanged.
5. **A comparison report**: per case, both arms side by side (calls, output bytes, tokens, cost,
   checks passed, verdict, friction), with ranges over the repeated runs. A difference is a
   finding only if repeated and large, per the README's note on measuring.
6. **The judge** gets the arm's tool set in its prompt, so it judges each arm against what that
   arm could do, and keeps writing friction points anchored to call numbers.
7. **Persisted outcome**: the README's "Why not just hand the model the schema" section gains what
   was measured, claim by claim: where the form tools win, tie or lose. A baseline folder records
   the first comparison run.

## Rulings after the builder check (my calls, for the user to check)

- **Case `context`** (`context.pages`, `context.datasetFilter`…): the plain arm reads it as a
  read-only resource behind its HTTP GET tool, named in its API description, the way an API
  would expose a list of pages. Without it the plain arm cannot succeed on those cases.
- **The plain arm's validator stands for the API, not for the form.** By default it is ajv on the
  case's schema. A case may declare the API's tolerance where the real API has one; line-form
  does, mirroring data-fair's line API: a string joined with the column separator is accepted for
  a multi-valued column, a number is accepted for a string column. Checks compare normalized
  values (a multi-valued field as its list of values whatever its spelling, a digit field as a
  string), so both arms are scored on the same facts and the "refused by the form, accepted by
  the API" mismatch shows in calls and friction.
- **"Unchanged outside the edited part"** compares each arm against its own unedited starting
  state as its tools present it: the form's state after loading the document with no edit (with
  its defaults and dropped hidden branches), the raw file for the plain arm. What the form
  normalizes on load is reported once per case as a fact about the library, not as an agent
  failure.
- **`x-agent-guide`**: the plain arm's prompt carries the schema's guide (its "About this …"
  domain text) verbatim, beside the neutral API description; the form-tool guide stays form-arm
  only. Domain knowledge is the schema author's, not the tools'.
- **Checks and verdicts stay separate.** The judge does not see check results and keeps reading
  the transcript blind. A failed check fails the case in the report and its exit code, whatever
  the verdict; a satisfactory verdict with a failed check (the invented-code case) is printed as
  such, since that combination is the finding this design exists for.
- **Live data**: a case with a check on a value that comes from a remote list runs on offline
  fixtures (line-form, the coherence case). Cases without such checks may stay on koumoul.com.

## Non-goals

- Changing the form tools. Their changes are the follow-up design and are measured afterwards
  with this eval; this branch only adds the arm, the cases and the checks.
- Multi-record or batch tasks, sessions with `saveForm` (data-fair's server sessions): this eval
  runs the page tools on one document.
- data-fair's own line-edition simulation: a one-off on the data-fair side, not persisted.
- The conversation eval (`feat-conversation-eval`, unmerged): untouched.

## Anti-goals

- A straw-man plain arm. If the plain arm loses a case because its tools are poorly described,
  that is a defect of the harness, fixed before the comparison counts.
- A plain arm that receives help the form arm does not (or the reverse): same goal text, same
  starting document, same remote data.
- Checks that grade style rather than facts (an exact title string the goal did not state, an
  item order the goal did not ask for).
- Re-adding tools or variants retired by measurement in the form arm (`getSchema`,
  `describeSchema`, the static overview, the complexity bands, the `fillFormSkill` tool). The plain
  arm's schema reader is the plain arm's, not the form arm's.

## Constraints

- json-layout's AGENTS.md: the eval governs `core/src/webmcp/**`, descriptions, the skill text and
  error projection; this branch touches only the eval harness and its cases, plus the README's
  rationale section.
- Isolation as today: neutral cwd, `--setting-sources=`, `--strict-mcp-config`, `--tools ""`,
  `--allowedTools` naming exactly the arm's tools. The plain arm is served by the same per-case
  MCP server process mechanism (`JL_WEBMCP_EVAL_CASE` plus an arm selector).
- The deterministic spec (`npm test -w core`) covers the new cases' shape, the plain arm's tools
  (ajv refusal, merge patch, path reads) and the checks, offline.
- Default model haiku, cheap enough to run the double suite often.
- No version bumps, no publishes, no PRs: the maintainer does those. Never rebase or force-push.

## Left to the builder

- How the arm is selected (the existing `--variant` machinery in `session.js`, or a separate
  `--arm` flag) and how evidence files are named, as long as both arms of a case never overwrite
  each other.
- The plain arm's exact tool names, descriptions and error format.
- The check syntax in a case, and how the report prints failures.
- The referential fixture's content and how it is served.
- Whether the coherence case extends `calendar` or is new.
