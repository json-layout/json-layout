# Baseline — 2026-09-08 (second run of the day)

Recorded from `json-layout` at `7d3814e`, against `data-fair/portals` at `19f3a68c`.
Supersedes `../2026-09-08/`, which predates five fixes made after it: the guide now starts
at `describeState` instead of prescribing `getData`, each complexity branch owns its own
"where to start" line, writes report which fields they made available or took away,
`getData`'s description comes from its own module rather than a stale copy in `index.js`,
and the 10ms sleep in the fetch test is gone.

| case | calls | bytes | cost | verdict |
|---|---|---|---|---|
| contact | 3 | 499 | $0.061 | satisfactory |
| contact (no-schema) | 4 | 832 | $0.088 | satisfactory |
| calendar | 12 | 21216 | $0.565 | satisfactory |
| charts | 16 | 15934 | $0.328 | satisfactory |
| portal-page | 10 | 10797 | $0.227 | satisfactory |

All on `claude-opus-5`, guide injected into the runner's prompt, $1.27 total, zero errored
calls, every form valid.

## Against 2026-09-08

| case | calls | bytes |
|---|---|---|
| contact | 4 → **3** | 524 → 499 |
| contact (no-schema) | 5 → **4** | 857 → 832 |
| calendar | 12 → 12 | 34213 → **21216** |
| charts | 17 → **16** | 20635 → **15934** |
| portal-page | 10 → 10 | 10770 → 10797 |

Suite totals: 66999 → 49278 bytes (−26%), 48 → 45 calls.

Both contact variants lost a call to the same fix: `index.js` was overriding `getData`'s
description with a hardcoded "Call this first to see what data already exists", so the
prompt-level work to stop prescribing `getData` never reached the tool description. With
that copy gone the small-form agent opens with `getSchema` (or `describeState` in the
no-schema variant) and `getData` survives only as a closing verification.

Calendar's 38% byte drop is the value-abbreviation rule reaching the write echo and the
leaf rendering, not a change in what the agent did — same 12 calls, same three goals met.

Charts lost a call and 23% of its bytes for the same reason plus one fewer verification
re-read.

## What the judges flag

Nothing above medium except one, new to this run:

- **[high, calendar] Tuple items are always reported `required`.** `/$allOf-0/datasets/1`
  is printed as `required` and `undefined` in the same response that says the form is
  valid. `core/src/compile/skeleton-node.js:552` passes `required = true` unconditionally
  for every entry of a tuple `items` list, and `core/src/webmcp/project.js:376` prints
  that flag, so the tag is a compile artifact with no validation behind it. It cost the
  agent three of twelve calls hunting for a value the goal never mentioned. Blast radius:
  `required` also gates default application, so the fix is not local to the projection.

Still open, medium:

- **`editArray` re-emits the whole 39-branch union on every add** — three times in a
  ten-call run, ~4.45 KB of 10.8 KB (41%), for a closed list the agent read once and used
  once. Needs a design call: remember what was already emitted for a schema node this
  session (stateful, like the suggestions store), or stop expanding it in `editArray` and
  let `describeState` supply it on demand.
- **Static closed enums are not inlined in `describeState`.** `project.js:396` tags every
  select as `suggestions` without distinguishing a static `oneOf` of consts from a remote
  `getItems` list, so charts paid two round-trips reading four-option enums the form knew
  statically. Recurring, one call per enum.
- **"No suggestions available" is ambiguous.** The same string covers "your query matched
  nothing", "this field has no item source" and "its `x-fromUrl` prerequisite is
  unresolved", and the query is not echoed.
- **The "became available" report names bare paths.** Calendar's agent got four paths with
  no label or type and spent two `describeState` calls identifying them — two of which
  turned out to share one label at different data locations.

Low, and consistent across every case: agents close with a verification `getData` even
though the write already answered "form is valid". The guide's line saying that read-back
is rarely needed is emitted only on the large-complexity branch.
