# WebMCP eval harness

Unit tests in `core/test/webmcp.spec.js` prove each tool returns the right shape. They
cannot tell you whether a form is *fillable*: whether an agent can get from a plain-language
goal to valid data without an unreasonable number of round-trips or a flood of output
into its context. That is what this harness measures.

## What a case is

`cases/index.js` holds schema + goal + expected data + a budget:

| case      | shape                                              | what it guards |
|-----------|----------------------------------------------------|----------------|
| `contact` | small flat form                                    | the one-shot `setData` path stays viable |
| `team`    | array of objects                                   | `editArray` + per-field writes stay affordable |
| `dataset` | schema too large for `getSchema` to return whole   | navigating by path, and the context cost of doing so |

A run is scored on four things: the expected data was produced, the form reports valid,
the tool-call count stayed within budget, and the total output bytes stayed within budget.
**A run that produces correct data while blowing its budget is a failure** — that is the
regression the harness exists to catch.

## Deterministic runs (CI)

`core/test/webmcp-eval.spec.js` drives every case through a hand-written but realistic
tool sequence. No model involved, so it is reproducible and runs with `npm test`. It pins
that a competent path exists and stays in budget, and that the scorer itself correctly
fails truncated or over-budget runs.

## Agent-driven runs

`server.js` exposes one case's tools over stdio MCP — the same descriptors, descriptions
and skill text a browser page registers. `.mcp.json` at the repo root registers one server
per case, so a coding agent can drive a real form:

1. Start a session so the MCP servers load (they are read at startup).
2. Give the agent **only** the case goal — printed on stderr when the server starts, and
   available from `cases/index.js`. Do not tell it which tools to call; how it finds its
   way through the protocol is the thing being measured.
3. The server records every call to `core/tmp/webmcp-eval-<case>.json` as it goes.
4. Score it:

```bash
npm run webmcp-eval:score -w core            # every case with a transcript
npm run webmcp-eval:score -w core -- team    # one case
```

Exit code is non-zero if any scored run failed, so this can gate a change to the tools.

Transcripts land in `core/tmp/` (gitignored) and are overwritten per case, so re-running a
case discards its previous run.

## Reading a result

The interesting failure is rarely "wrong data" — it is a budget blown, which says the
protocol made the agent work harder than it should have. Compare the recorded call
sequence against what the skill in `src/webmcp/tools/fill-form-skill.js` told it to do:
a divergence there is usually a description that reads correctly to a human and
misleads a model.
