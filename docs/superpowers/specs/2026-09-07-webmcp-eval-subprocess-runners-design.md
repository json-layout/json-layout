# Subprocess Runners for the WebMCP Eval

## Overview

Replace the eval's in-session subagent runners with headless `claude -p` subprocesses,
one per case, each launched from a neutral working directory against a single MCP server
selected by environment.

This is motivated by a workflow defect, not an architectural preference. The eval exists
to be re-run after changing a WebMCP tool, its description, or the fill-form skill text —
and today every one of those changes requires starting a new Claude Code session before
the eval can say anything about it. Chasing that defect also uncovered an isolation
breach that invalidates the guarantee the harness is built on.

### Why the current design forces a fresh session

`.mcp.json` registers one stdio server per case. Claude Code connects MCP servers once,
at session start, so each server process lives for the whole session and holds one
`EvalSession` — one form state — for its entire life. A second run of a case would
continue from the first run's data. Worse, that process imported `core/src/webmcp/**` at
startup, so it serves the code as it was when the session opened: the very edit that
motivates a re-run is the thing a long-lived server cannot see.

Two consequences follow that the harness's own README documents as costs to be borne:
each case runs at most once per session, and every contributor session in this repository
starts three idle node processes it will almost certainly never use.

### Why a reset tool was rejected

The obvious fix — a control tool that rebuilds the session — was designed and abandoned
after probing. It required a stdio parent supervising a forked worker so that a respawn
would re-import `core/src`, plus a ninth tool on a server whose fidelity claim is that it
exposes exactly what a browser page exposes. Even then it could not reload tool
*descriptions*, because the client caches `tools/list` at connect. A subprocess gets all
of that from the operating system, and gets it completely.

## Requirements

1. Any case can be re-run any number of times in one orchestrator session, always from
   clean form state.
2. A run reflects the current `core/src/**` and the current case registry, including tool
   descriptions.
3. A case can be added to the registry and run without restarting anything.
4. One MCP server definition, not one per case.
5. The runner learns nothing about json-layout, the eval, or the schema beyond what a
   browser page would give it. This is strengthened, not merely preserved.
6. Contributor sessions in this repository start no eval processes.

## Probe Results

Measured against Claude Code 2.1.263 before the design was accepted. Every claim below is
an observation, not an expectation.

| question | result |
|---|---|
| Nested `claude -p` from inside a Bash tool | Works. Exit 0, `subagent_stats.max_depth: 0`, no recursion guard |
| MCP tools called non-interactively | Yes, with `--permission-prompts none` and an `--allowedTools` allowlist; `permission_denials: []` |
| Does env reach the MCP server child | **Yes.** `JL_WEBMCP_EVAL_CASE=calendar` wrote `webmcp-eval-calendar.json`; the server's fallback is `contact`, so the filename is decisive |
| Re-run the same case in one session | Two runs, `startedAt` 12:09:44Z then 12:10:11Z, one call each, clean data both times |
| `--tools ""` | Removes every built-in tool; the MCP tool was still callable |
| `--bare` | Unusable here: forces `ANTHROPIC_API_KEY`, fails under OAuth with "Not logged in" |

Cost of the probes: $0.086 and $0.013 per trivial run.

## Runner Isolation

### The leak this fixes

A subprocess launched plainly from the repository root inherits 5 719 tokens of context
that no page visitor has. Asked to enumerate it, the runner reported the auto-memory
`MEMORY.md` index — including entries named `webmcp-eval-never-executed (eval baseline)`
and `webmcp-review-backlog` — and the entire `superpowers:using-superpowers` skill,
injected by a SessionStart hook.

**A runner can therefore read that it is participating in a WebMCP eval.** That is the
one thing the isolation guarantee exists to prevent. The spec that introduced this harness
reasoned carefully about server names and tool names carrying evaluation language, and
this channel defeats all of it.

`--setting-sources=` alone is not sufficient: it drops the hook and project settings
(4 452 tokens) but auto-memory survives, still naming the eval. Auto-memory is keyed to
the project directory, so the fix is to launch from a directory that is not the project:

| configuration | context | memory | hook/skill | AGENTS.md |
|---|---|---|---|---|
| repo cwd, no flags | 5 719 | **leaks the eval by name** | present | present |
| repo cwd, `--setting-sources=` | 4 452 | **leaks the eval by name** | gone | gone |
| neutral cwd, `--setting-sources=` | 3 553 | gone | gone | gone |

The neutral cwd is a `mkdtemp` directory under `os.tmpdir()`, created per run and not
reused. `server.js` resolves its own paths from `import.meta.url`, so it still writes to
`core/tmp/` regardless of the runner's cwd — verified end to end.

### Residual context

About 3 553 tokens of generic Claude Code session boilerplate remain (harness guidance
such as how `/code-review ultra` is invoked). This is deliberately left in place: it
carries no json-layout or eval knowledge, and removing it would require `--system-prompt`
to replace the whole system prompt, which would make the runner unlike the Claude Code
agent a real page actually meets. The eval's question is whether *that* agent can drive
the protocol.

### Enforcement moves from frontmatter to flags

The guarantee was previously "the runner agent definition lists only MCP tools." It
becomes `--tools ""` (no built-in tools exist at all) plus `--allowedTools` naming exactly
`TOOL_NAMES`, plus `--strict-mcp-config` so no other MCP server is reachable. This is
strictly stronger: the absence is enforced by the process, not by an allowlist the
harness's own fallback documentation invited contributors to omit.

Any `permission_denials` entry in a run's output means the allowlist and the tool set have
drifted apart. Such a run is invalid and must be reported as such rather than judged.

## Architecture

### The launch

`core/webmcp-eval/run-case.js` resolves the case from the registry, takes its `goal`
verbatim as the prompt, creates a throwaway cwd, and spawns:

```
env JL_WEBMCP_EVAL_CASE=<case> claude -p "<goal>"
  --strict-mcp-config
  --mcp-config '{"mcpServers":{"page-form":{"type":"stdio","command":"node",
                 "args":["<abs>/core/webmcp-eval/server.js"]}}}'
  --tools ""
  --allowedTools "<TOOL_NAMES, mcp__page-form__ prefixed>"
  --setting-sources=
  --append-system-prompt "<RUNNER_PROMPT>"
  --model "<resolved model>"
  --permission-prompts none
  --output-format json
```

The prompt is the goal and nothing else, exactly as the subagent contract required.

### What selects the case

One server definition, no `env` block in it, and `JL_WEBMCP_EVAL_CASE` set on the
`claude` process, which the server inherits as a child. The runner never sees a case
identifier: no setup tool, no case argument, nothing in its prompt. This satisfies the
single-server requirement without reintroducing evaluation language into the runner's
context.

### Concurrency

Each case gets its own subprocess, its own server process and its own temporary cwd, with
no shared state, so cases run concurrently again. Sequential execution was only ever
required by the single-long-lived-server design that this replaces.

## Model Pinning and Run Provenance

The probe silently inherited `claude-opus-5[1m]`; subagent runners silently inherit the
orchestrator's model. Verdicts have therefore never been comparable across time, and
nothing in the recorded evidence said which model produced a run.

`--model` is set from `JL_WEBMCP_EVAL_MODEL`, defaulting to `opus`. The launcher writes a
sidecar `core/tmp/webmcp-eval-<case>.run.json` recording the **resolved canonical model**
read back from the subprocess's `modelUsage` (not the requested alias), together with
cost, turn count, exit status and `permission_denials`. `report.js` prints the model and
cost per case, and reports a run with non-empty denials or a non-zero exit as invalid.

The server keeps sole ownership of the transcript; provenance is a separate file so the
two writers never race.

## Orchestration

The `/webmcp-eval` skill loses its two most awkward instructions — the session-start check
for `mcp__page-form-*` tools, and the rule that each case runs once per session. It
becomes: delete prior evidence, `npm run webmcp-eval:run -w core` (all cases, or named
ones), dispatch one `webmcp-eval-judge` per case, write verdicts, run the report.

Judging stays in-session: judges need `Read` on the repository, and no isolation claim
attaches to them.

## Testing

`generate-config.js` is deleted rather than renamed: it exists to write `.mcp.json` and
agent definitions, and neither survives. Its two exports that are still needed —
`TOOL_NAMES` and `RUNNER_PROMPT` — move into `run-case.js` alongside a pure
`buildLaunchArgs(evalCase, options)`, which is what the spec now asserts against.
`core/test/webmcp-eval.spec.js` updates its `TOOL_NAMES` import accordingly.

`webmcp-eval-config.spec.js` is renamed to `webmcp-eval-runner.spec.js` and keeps every
existing assertion, retargeted from generated markdown to launch arguments:

- the allowlist is exactly `TOOL_NAMES`, `mcp__page-form__`-prefixed, and non-empty, so
  an emptied `TOOL_NAMES` fails rather than passing vacuously
- no built-in tool is granted: `--tools` is present and empty, and no filesystem or
  network tool name appears anywhere in the arguments
- `--strict-mcp-config`, `--setting-sources=` and a cwd outside the repository are present
- the prompt equals the case's goal exactly, and no argument mentions the case name,
  json-layout, or evaluation language

The same spec covers the launcher's own logic against a stubbed spawn: unknown case names
fail with the available names, a non-zero exit is surfaced rather than swallowed, and the
sidecar records the resolved model and denials.

The existing case assertions, `verdict.js` parsing and `report.js` aggregation are
unchanged. No test invokes `claude`; a judged run remains a deliberate act.

## Files

| action | path |
|--------|------|
| add | `core/webmcp-eval/run-case.js` (CLI + `TOOL_NAMES`, `RUNNER_PROMPT`, `buildLaunchArgs`) |
| rename | `core/test/webmcp-eval-config.spec.js` → `webmcp-eval-runner.spec.js`, asserting launch args |
| rewrite | `.claude/skills/webmcp-eval/SKILL.md` |
| rewrite | `core/webmcp-eval/README.md` |
| update | `core/webmcp-eval/report.js` (model, cost, invalid runs) |
| update | `core/test/webmcp-eval.spec.js` (`TOOL_NAMES` import moves) |
| update | `core/package.json` (`webmcp-eval:run`; drop `webmcp-eval:config`) |
| delete | `core/webmcp-eval/generate-config.js` |
| delete | `.claude/agents/page-form-runner-{contact,calendar,charts}.md` |
| delete | `.mcp.json` entirely — the three page-form servers are its only contents |
| delete | `enabledMcpjsonServers` from `.claude/settings.local.json` |

`server.js`, `session.js`, `verdict.js` and `cases/**` are untouched.

## Risks

- **Every run is a billed session.** Trivial probes cost $0.013–$0.086; full cases cost
  more. Subagent runners were billed too, so this is a change in visibility, not in kind.
- **`claude` must be on `PATH` and authenticated.** The launcher must fail with that
  message rather than an opaque spawn error.
- **The flags are version-coupled.** `--tools`, `--setting-sources` and
  `--permission-prompts` are CLI surface, observed working on 2.1.263. A flag that
  silently stops being honoured would weaken isolation without failing a test, so the
  launcher asserts on what it can observe: a non-empty `permission_denials` list fails the
  run.
- **This morning's baseline is suspect.** The leak was verified on the subprocess path.
  Whether in-session subagents inherit the same memory index is unverified, and if they
  do, the three runs judged satisfactory on 2026-09-07 had access to a line naming the
  eval. That must be checked before those results are treated as a baseline.

## Out of Scope

- **Running the judge as a subprocess.** Would make the whole eval CI-able in one command.
  The judge has no isolation requirement, so this buys only uniformity; nothing here
  blocks it.
- **CI execution.** Now genuinely possible — with `ANTHROPIC_API_KEY` present, `--bare`
  becomes available and removes the residual boilerplate too. Deferred as a separate
  decision about spending money on every commit.
- **The API tool-loop runner** deferred by the previous spec, which wanted model pinning
  and CI. `claude -p` delivers both without adding an SDK dependency to a package that
  has almost none; that item can be closed rather than carried.
