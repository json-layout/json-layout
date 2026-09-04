---
name: webmcp-eval
description: Run the WebMCP eval - dispatch an isolated runner subagent per case to fill a real form, then judge each transcript. Use when asked to evaluate the webmcp form tools, run the eval, or check whether an agent can drive json-layout forms.
---

# Running the WebMCP eval

Measures whether an agent can find its way through the WebMCP form-filling protocol,
by having one actually try and then judging the transcript.

## Before you start

The MCP servers are declared in `.mcp.json` and load at session start. If you do not see
`mcp__page-form-*` tools available, the session began before they were generated: run
`npm run webmcp-eval:config -w core`, then restart the session.

Each case's server holds one form state for the life of the session, so **each case can
be run once per session**. A second run of the same case would start from the first run's
data. To re-run, start a fresh session.

## Steps

1. Read the case list from `core/webmcp-eval/cases/index.js`. Note each case's `name` and
   `goal`.

2. Delete the evidence left by any earlier session:

   ```bash
   rm -f core/tmp/webmcp-eval-*
   ```

   These files persist and are only overwritten when a case actually runs. If a case
   fails to dispatch in this session, the previous session's transcript and its verdict
   would be reported as this session's result. Deleting first turns that into a visible
   `not run`.

3. Dispatch one runner per case, **in parallel, in a single message**. Use the agent type
   `page-form-runner-<case>` and pass **only the goal string** as the prompt.

   Do not add context. Do not mention json-layout, the eval, the schema, or what you know
   about the tools. The runner has no filesystem access by design; anything you tell it is
   the only thing it knows, and every extra sentence makes the result less like a real
   page visit.

4. When a runner finishes, its transcript is at `core/tmp/webmcp-eval-<case>.json`. Read
   it.

5. Dispatch a `webmcp-eval-judge` subagent per case. Give it, in the prompt: the goal, the
   case's schema, the transcript's `calls` array, and its `metrics`, `data` and `valid`
   fields. Ask for the JSON verdict its definition describes.

6. Write each verdict to `core/tmp/webmcp-eval-<case>.verdict.json`.

7. Run `npm run webmcp-eval:report -w core` and relay the summary. A case reported as
   `not run` never executed — usually its MCP server was not loaded — and fails the
   report; do not read the cases that did run as the result of the suite.

## Reading the result

The friction list is the point. A verdict says a run went badly; a friction point says
which response misled the agent and what it concluded, which is what turns a run into a
change to a tool description or a tool's output.

Treat an unresolvable `getItems` list as a finding, not an environment problem. Without a
reachable data-fair those lists cannot resolve, and how the tools report that — and what
the runner does next — is one of the things worth measuring.
