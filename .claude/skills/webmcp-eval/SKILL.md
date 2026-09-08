---
name: webmcp-eval
description: Run the WebMCP eval - launch an isolated subprocess runner per case to fill a real form, then dispatch a judge subagent to verdict each transcript. Use when asked to evaluate the webmcp form tools, run the eval, or check whether an agent can drive json-layout forms, and after changing any webmcp tool, its description, or the fill-form skill text.
---

# Running the WebMCP eval

Measures whether an agent can find its way through the WebMCP form-filling protocol, by
having one actually try and then judging the transcript. Unit tests answer "does this
tool return the right shape"; this answers "can a model use it".

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

   This also clears the `.run.json` provenance sidecars. These files persist and are
   only rewritten when a case actually runs. If a case fails to dispatch this time,
   an earlier transcript and verdict would be reported as this run's result. Deleting
   first turns that into a visible `not run`.

3. **Run every case.**

   ```bash
   npm run webmcp-eval:run -w core            # every case in the registry
   npm run webmcp-eval:run -w core -- charts calendar   # only the cases named
   npm run webmcp-eval:run -w core -- contact --no-schema  # the no-getSchema variant
   ```

   Each case launches as its own `claude` subprocess, and the subprocesses run
   concurrently. The case a subprocess serves is chosen by the `JL_WEBMCP_EVAL_CASE`
   environment variable, which its MCP server child inherits — the runner itself never
   sees a case identifier. The model is pinned by `JL_WEBMCP_EVAL_MODEL` (default
   `opus`) so verdicts from different models are never compared silently; it is recorded
   in the sidecar and printed by the report.

4. **Ignore the runner's own summary of its work.** The transcript at
   `core/tmp/webmcp-eval-<case>.json` is the evidence, and it is what the judge reads —
   not whatever the runner said in its final answer. A run that believes it succeeded is
   exactly the case worth judging.

   What `npm run webmcp-eval:run` itself prints is different: a `<case>: FAILED — <error>`
   line means the harness could not complete that run at all (a non-zero exit, a denied
   tool call, unparsable output). Do not dispatch a judge for that case — read its sidecar,
   `core/tmp/webmcp-eval-<case>.run.json`, instead. An invalid run must never be judged.

5. **Dispatch a `webmcp-eval-judge` subagent per case.** The judge has `Read`, so give it
   paths, not pasted content — the `charts` schema alone is 29 KB:

   - the case name and its goal
   - the transcript path, `core/tmp/webmcp-eval-<case>.json`
   - where the schema is: inline in `core/webmcp-eval/cases/index.js` for `contact`,
     or `core/webmcp-eval/cases/schemas/<file>.json` for a vendored case
   - ask for the JSON verdict its own definition specifies

6. **Write each verdict** to `core/tmp/webmcp-eval-<case>.verdict.json`, as raw JSON. If
   the judge fenced its answer in a code block, strip the fence. A verdict that fails
   validation is treated as no verdict at all, so the case will report as `not judged` and
   fail — that is deliberate, but check the file rather than being surprised by it.

7. **Report.**

   ```bash
   npm run webmcp-eval:report -w core            # every case
   npm run webmcp-eval:report -w core -- charts  # one case
   ```

   Relay the summary. Exit code is non-zero if any run was unsatisfactory, invalid, not
   judged, or never ran.

## If something goes wrong

**A case reports `invalid run`.** The subprocess exited non-zero, reported `is_error`, or
had a tool call denied — each of these happens only after a transcript already exists.
Check the sidecar `core/tmp/webmcp-eval-<case>.run.json` for the recorded error. A denial
means `TOOL_NAMES` in `run-case.js` and the tools a session actually registers have
drifted apart — `core/test/webmcp-eval.spec.js` asserts they match, so run the suite. An
invalid run must never be judged; treat its verdict, if one exists, as meaningless.

**`could not launch claude`.** The `claude` CLI must be on `PATH` and authenticated in
the environment running the eval.

**A case reports `not run`.** The subprocess never produced a transcript at all — either
it failed to launch (see above), or it exited cleanly but its stdout could not be parsed,
so the launcher never even learned whether it succeeded. Check the sidecar
`core/tmp/webmcp-eval-<case>.run.json` for the recorded error. Do not read the cases that
did run as the result of the suite.

**The report says `not judged`.** The transcript exists but its verdict is missing,
malformed, or names a different case. Re-dispatch the judge for that case.

## Reading the result

The friction list is the point. A verdict says a run went badly; a friction point says
which response misled the agent and what it concluded — that is what turns a run into a
concrete change to a tool description or a tool's output.

The vendored app schemas fetch their pickers from koumoul.com's public data-fair, so an
item list that does not resolve is a finding, not an environment problem, unless the
network itself was down. How the tools report an empty or failed list — and what the
runner does next — is among the most valuable things this eval measures. Set
`JL_WEBMCP_EVAL_DATA_FAIR` (a base URL ending in `/`) in the environment before running
to point at another instance.

Compare the recorded call sequence against what `core/src/webmcp/tools/fill-form-skill.js`
told the agent to do. A divergence there is usually a description that reads correctly to
a human and misleads a model.
