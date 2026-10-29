---
name: webmcp-eval
description: Run the WebMCP eval - launch an isolated subprocess runner per case and arm (form tools, server session, plain JSON API), then dispatch a judge subagent to verdict each transcript. Use when asked to evaluate the webmcp form tools, run the eval, or check whether an agent can drive json-layout forms, and after changing any webmcp tool, its description, or the fill-form skill text.
---

# Running the WebMCP eval

Measures whether an agent can find its way through the WebMCP form-filling protocol, by
having one actually try and then judging the transcript. Unit tests answer "does this
tool return the right shape"; this answers "can a model use it".

A case can run under three arms: `form` (the page tools, the default), `session` (the same
tools served by `@json-layout/agents` `FormSession`, with an explicit save) and `plain` (a
JSON API: `readDocument`, `readSchema`, `writeDocument`, `patchDocument`, `httpGet`). The
point of running more than one is the comparison between them.

Each run is its own `claude -p` subprocess, launched from a directory outside this
repository with its own MCP server child. There is no session-level setup: a case can be
run any number of times and always reflects the current `core/src` and case registry.

## Steps

1. **Read the case list** from `core/webmcp-eval/cases/index.js`. Note each case's `name`
   and `goal`. To run a subset, use only those cases throughout — the report takes case
   names as arguments.

2. **Delete evidence from earlier runs.**

   ```bash
   rm -f core/tmp/webmcp-eval-*
   ```

   Do this before every comparison too: the report would otherwise average a fresh run
   with leftovers of an earlier one under the same names.

   This also clears the `.run.json` provenance sidecars. These files persist and are
   only rewritten when a case actually runs. If a case fails to dispatch this time,
   an earlier transcript and verdict would be reported as this run's result. Deleting
   first turns that into a visible `not run`.

3. **Run every case.**

   ```bash
   npm run webmcp-eval:run -w core            # every case in the registry
   npm run webmcp-eval:run -w core -- charts calendar   # only the cases named
   npm run webmcp-eval:run -w core -- portal-config-edit --variant no-guide  # without the schema's x-agent-guide
   npm run webmcp-eval:run -w core -- data-fair-line --arm plain             # one arm: form (default), session, plain
   npm run webmcp-eval:run -w core -- data-fair-line --arm all --runs 3      # every arm, three runs each
   ```

   `--arm all` and `--runs n` are what a comparison needs: one run per arm is noise (cost
   has varied up to 3x between runs of the same case). Evidence names follow
   `webmcp-eval-<case>[--<variant>][--<arm>][.r<n>]`: the `form` arm carries no arm suffix,
   `--runs` adds `.r1`, `.r2`, ... only when n is above 1. Each of these files, with its
   `.run.json` sidecar, is a separate run to judge.

   An arm that cannot take a case writes only a sidecar with `notRunnable` and the reason
   (today the `session` arm on `portal-config-edit`, which auto-saves, until `FormSession`
   has that mode). Nothing was launched, so there is nothing to judge: **do not dispatch a
   judge for it**. The report prints it as `not runnable` and does not fail on it.

   At most 6 subprocesses run at once; the rest queue.

   Each case launches as its own `claude` subprocess, and the subprocesses run
   concurrently. The case a subprocess serves is chosen by the `JL_WEBMCP_EVAL_CASE`
   environment variable, which its MCP server child inherits — the runner itself never
   sees a case identifier. The model is pinned by `JL_WEBMCP_EVAL_MODEL` (default
   `haiku`, see `DEFAULT_MODEL` in `run-case.js` for why: the smallest tier is what
   exposes an unstated dependency, and it is what keeps the suite cheap enough to run
   often) so verdicts from different models are never compared silently; it is recorded
   in the sidecar and printed by the report. Reach for a larger tier only to check a
   finding against one.

4. **Ignore the runner's own summary of its work.** The transcript at
   `core/tmp/webmcp-eval-<label>.json` is the evidence, and it is what the judge reads —
   not whatever the runner said in its final answer. A run that believes it succeeded is
   exactly the case worth judging.

   What `npm run webmcp-eval:run` itself prints is different: a `<case>: FAILED — <error>`
   line means the harness could not complete that run at all (a non-zero exit, a denied
   tool call, unparsable output). Do not dispatch a judge for that case — read its sidecar,
   `core/tmp/webmcp-eval-<label>.run.json`, instead. An invalid run must never be judged.

5. **Dispatch a `webmcp-eval-judge` subagent per run file** (case x variant x arm x repeat),
   skipping `FAILED` and `not runnable` ones. The judge has `Read`, so give it
   paths, not pasted content — the `charts` schema alone is 29 KB:

   - the case name and its goal
   - the arm the run used and that arm's tool list — the judge judges a run against what
     its arm could do. `plain`: `readDocument`, `readSchema`, `writeDocument`,
     `patchDocument`, `httpGet`. `form` (the lists depend on the case, so print them):
     `cd core && node --input-type=module -e "const {createArm}=await import('./webmcp-eval/arms.js');const {cases}=await import('./webmcp-eval/cases/index.js');console.log((await createArm(cases.find(c=>c.name==='<case>'),'<arm>')).toolNames.join(', '))"`
     — e.g. `getData, setData, describeState, openSection, setFieldValue,
     getFieldSuggestions, editArray` for `form`, and for `session` the same without
     `openSection` plus `saveForm` and `reloadForm`
   - the transcript path, `core/tmp/webmcp-eval-<label>.json`, where `<label>` is the run's
     evidence name
   - never the case's checks or whether they passed: verdicts stay blind to them
   - where the schema is: inline in `core/webmcp-eval/cases/index.js` for `contact`,
     or `core/webmcp-eval/cases/schemas/<file>.json` for a vendored case
   - ask for the JSON verdict its own definition specifies

6. **Write each verdict** to `core/tmp/webmcp-eval-<label>.verdict.json` (the same label as
   the transcript), as raw JSON. The `case` field must be the case name, not the label. If
   the judge fenced its answer in a code block, strip the fence. A verdict that fails
   validation is treated as no verdict at all, so the case will report as `not judged` and
   fail — that is deliberate, but check the file rather than being surprised by it.

7. **Report.**

   ```bash
   npm run webmcp-eval:report -w core            # every case
   npm run webmcp-eval:report -w core -- charts  # one case
   npm run webmcp-eval:report -w core -- data-fair-line --arm plain  # one arm
   ```

   Relay the summary, including the `<case> — comparison` block: one row per arm with the
   ranges over its runs (calls, bytes, input tokens, cost), checks passed, and verdict
   counts. It is context, not a verdict; a difference counts only if it repeats across
   runs and is large. Exit code is non-zero if any run was unsatisfactory, invalid, not
   judged, never ran, or failed a check. A `satisfactory` verdict printed with
   `CHECK FAILED` is the finding the checks exist for: a run that read well and ended with
   wrong data (an invented code, a value in the wrong spelling).

## If something goes wrong

**A case reports `invalid run`.** The subprocess exited non-zero, reported `is_error`, or
had a tool call denied — each of these happens only after a transcript already exists.
Check the sidecar `core/tmp/webmcp-eval-<label>.run.json` for the recorded error. A denial
means `TOOL_NAMES` in `run-case.js` and the tools a session actually registers have
drifted apart — `core/test/webmcp-eval.spec.js` asserts they match, so run the suite. An
invalid run must never be judged; treat its verdict, if one exists, as meaningless.

**`could not launch claude`.** The `claude` CLI must be on `PATH` and authenticated in
the environment running the eval.

**A case reports `not run`.** The subprocess never produced a transcript at all — either
it failed to launch (see above), or it exited cleanly but its stdout could not be parsed,
so the launcher never even learned whether it succeeded. Check the sidecar
`core/tmp/webmcp-eval-<label>.run.json` for the recorded error. Do not read the cases that
did run as the result of the suite.

**The report says `not runnable`.** The arm cannot take that case; the reason is printed.
Not a failure and not to be judged.

**The report says `not judged`.** The transcript exists but its verdict is missing,
malformed, or names a different case. Re-dispatch the judge for that case.

## Reading the result

The friction list is the point. A verdict says a run went badly; a friction point says
which response misled the agent and what it concluded — that is what turns a run into a
concrete change to a tool description or a tool's output.

`calendar` and `data-fair-line` answer their remote lists from offline fixtures, whichever
arm runs. The other vendored app schemas fetch their pickers from koumoul.com's public
data-fair, so an item list that does not resolve is a finding, not an environment problem,
unless the network itself was down. How the tools report an empty or failed list — and what the
runner does next — is among the most valuable things this eval measures. Set
`JL_WEBMCP_EVAL_DATA_FAIR` (a base URL ending in `/`) in the environment before running
to point at another instance.

Compare the recorded call sequence against what `core/src/webmcp/tools/fill-form-skill.js`
told the agent to do. A divergence there is usually a description that reads correctly to
a human and misleads a model.
