---
name: webmcp-eval
description: Run the WebMCP eval - dispatch an isolated runner subagent per case to fill a real form, then judge each transcript. Use when asked to evaluate the webmcp form tools, run the eval, or check whether an agent can drive json-layout forms, and after changing any webmcp tool, its description, or the fill-form skill text.
---

# Running the WebMCP eval

Measures whether an agent can find its way through the WebMCP form-filling protocol, by
having one actually try and then judging the transcript. Unit tests answer "does this
tool return the right shape"; this answers "can a model use it".

## Before you start

**The MCP servers connect at session start.** If you do not see `mcp__page-form-*` tools
in this session, they are not available and no amount of retrying will summon them: run
`npm run webmcp-eval:config -w core`, then start a NEW session and come back.

Each case's server holds one form state for the life of the session, so **each case runs
once per session**. A second run would start from the first run's data. To re-run, start
a fresh session.

## Steps

1. **Read the case list** from `core/webmcp-eval/cases/index.js`. Note each case's `name`
   and `goal`. To run a subset, use only those cases throughout — the report takes case
   names as arguments.

2. **Delete evidence from earlier sessions.**

   ```bash
   rm -f core/tmp/webmcp-eval-*
   ```

   These files persist and are only rewritten when a case actually runs. If a case fails
   to dispatch this session, last session's transcript and verdict would be reported as
   this session's result. Deleting first turns that into a visible `not run`.

3. **Dispatch one runner per case, in parallel, in a single message.** Agent type
   `page-form-runner-<case>`; the prompt is **the goal string and nothing else**.

   Do not add context. Do not mention json-layout, the eval, the schema, or anything you
   know about the tools. The runner has no filesystem access by design, so whatever you
   put in that prompt is the entirety of what it knows, and every extra sentence makes the
   run less like a real page visit and the result less worth having.

4. **Ignore what the runner tells you.** Its summary is a claim; the transcript at
   `core/tmp/webmcp-eval-<case>.json` is the evidence, and it is what the judge reads. A
   runner that believes it succeeded is exactly the case worth judging.

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

   Relay the summary. Exit code is non-zero if any run was unsatisfactory, not judged, or
   never ran.

## If something goes wrong

**A runner says it has no tools.** This is the known open risk: it is unverified that an
agent definition's `tools:` frontmatter resolves MCP tool names. Check
`.claude/agents/page-form-runner-<case>.md` lists `mcp__page-form-<case>__*` entries and
that `.mcp.json` declares that server. If the frontmatter turns out not to accept MCP
names, the fallback is an agent definition with no `tools:` line at all — it then inherits
the session's tools, and the isolation guarantee still holds because the guarantee is the
absence of `Read`/`Grep`/`Bash`, not the presence of a particular list. Say so in your
report; this is a real finding about the harness.

**A case reports `not run`.** It never executed — usually its server was not loaded. Do
not read the cases that did run as the result of the suite.

**The report says `not judged`.** The transcript exists but its verdict is missing,
malformed, or names a different case. Re-dispatch the judge for that case.

## Reading the result

The friction list is the point. A verdict says a run went badly; a friction point says
which response misled the agent and what it concluded — that is what turns a run into a
concrete change to a tool description or a tool's output.

Treat an unresolvable `getItems` list as a finding, not an environment problem. Without a
reachable data-fair those lists cannot resolve, and how the tools report that — and what
the runner does next — is among the most valuable things this eval measures.

Compare the recorded call sequence against what `core/src/webmcp/tools/fill-form-skill.js`
told the agent to do. A divergence there is usually a description that reads correctly to
a human and misleads a model.
