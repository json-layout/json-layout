# Standalone Form Sessions — Design

## Overview

Open json-layout edition to a stateful MCP surface outside the context of a page.
Not by building a server: by shipping a library a consumer embeds into its own,
larger MCP server. That server covers an entire API; resources too complex or too
heavy for raw JSON manipulation are edited through json-layout instead, while
everything else stays raw CRUD.

The pattern is load → edit → persist, over functions the consumer supplies:

1. `load()` brings the resource document into memory (an HTTP GET for the first
   consumer, but the library never knows or cares).
2. Let the agent iterate through the existing json-layout tools over that data.
3. `save()` persists the result (an HTTP POST for the first consumer).

New workspace: `agents/` (`@json-layout/agents`), plain JavaScript with JSDoc,
same conventions as `core/` and `vocabulary/`.

## Goals and non-goals

Goals:

- A **wrapper** around `WebMCP.getTools()` (core/src/webmcp/index.js:129): compose
  the existing tools, never rework them.
- No transport, no MCP SDK, no bin. Tool descriptors and executors in, MCP-shaped
  results out, so the consumer registers them in whatever server it already has.
- Session lifecycle over two consumer functions: open (load + compile), edit,
  save, reload, discard, expire.
- TTL-scoped sessions, recoverable by reload — an evicted session is not lost work.
- Dirty tracking out of the box: the session passes the loaded document as
  `savedData`, so describeState already marks the fields that changed
  (core/src/webmcp/project.js:399, pinned by core/test/webmcp.spec.js:101) —
  no projection change, no extra tool.

Non-goals:

- Any change to the page tools' implementations or descriptions. They are pinned
  by `core/test/webmcp.spec.js` and the eval harness; a protocol change is a
  separate, eval-gated concern.
- Agent-facing `compile` / `createState` / `destroy` tools. Those are plumbing the
  removed `agents` package made the agent babysit; here the session owns them.
- Multi-tenancy and auth policy. Those belong to the consumer.
- Any I/O of its own, schema loading included: `load`, `save` and `schema` are
  functions the consumer passes, so HTTP, GraphQL, files or a database are all
  equally supported and equally invisible to the library.

## Prior art

- `@json-layout/agents` (removed in 592d547) — a standalone stdio MCP server using
  `@modelcontextprotocol/sdk` and `ai`, TypeScript, exposing `compile`/`createState`/
  `describeState`/`setData`/`setFieldValue`/`getFieldSuggestions`/`validateState`/
  `getData`/`destroy`. It established the TTL store and the
  `getSchema(path, cachedUpdateDate)` compile-cache pattern; both are kept. Its
  transport, SDK, TS and agent-managed ids are dropped.
- `core/webmcp-eval/session.js:133` already wraps `getTools()` for a non-page
  consumer and drives it over stdio. The library is that pattern generalized,
  minus eval bookkeeping.

## Architecture

```
consumer's MCP server (transport, auth, API)
  └── @json-layout/agents
       ├── LayoutCache    schema via core compile, shared across sessions
       ├── SessionStore   TTL map keyed by a consumer-supplied id
       └── FormSession    compiled layout + StatefulLayout + WebMCP + load/save
```

### Load and save functions

The only consumer-facing contract, passed to the session factory:

```js
{
  load:   async () => document,                       // required; or { data, version }
  save:   async (document, { version, base }) => ({ version? }),  // optional; absent = read-only
  schema: async () => schema,                         // or { schema, version }; optional
  fetch:  (url, opts) => ...                          // optional, for remote `items` sources
}
```

No endpoint, verb or header appears in the API. A `load()` that carries a version
gets optimistic concurrency; a bare document gets last-write-wins. The consumer
decides, and may swap HTTP for anything else without the library noticing.

### LayoutCache

Compiles schemas at runtime through core's `compile` and caches by schema path
plus version (`updateDate`, ETag/version equivalent from `schema()`). Compiled
layouts are immutable, so one cache entry serves every session of that resource.
A consumer holding build-time serialized layouts may pass one in directly and
skip compilation entirely.

### FormSession

Constructed from `{ load, save, schema, layout, title, options }` — `layout` when
a compiled or serialized layout is already in hand, `schema` otherwise. Holds:

- the shared `CompiledLayout` and its main skeleton tree,
- a `StatefulLayout(compiled, tree, stateOptions, data, savedData)` where
  `savedData` is the data as loaded from the server,
- a `WebMCP` instance (for the suggestion store and variant memo) over that layout.

That baseline is also what makes the agent's view self-describing: `savedData`
already drives the `modified` marker in describeState output, so "what changed
since load" costs no new projection and no new tool.

`options` is forwarded to `StatefulLayout`. The one entry that matters beyond the
page defaults is `fetch`, used to resolve remote `items` sources: the Node default
is global `fetch` against `/` (core/src/state/options.js:31-33), so an
authenticated API must pass an auth-aware fetch and a `fetchBaseURL`. This is the
one remote concern the load/save functions cannot cover — the request is built by
the state layer from a schema expression, not by a function the consumer passed.

Methods: `open()` (idempotent, dedupes concurrent loads), `reload()` (re-runs
`load`, discards local changes), `discard()` (same as reload but leaves the session
closed), `save()`, `close()`. Accessors: `valid`, `status`
(`ready|stale|saving|error`).

`save()` runs the validity gate (`session.valid`, unless the consumer opts into
`allowInvalid`), calls `save(document, { version, base })`, and on success advances
the baseline (`savedData = document`, core/src/state/index.js:412) so the
`modified` markers clear without rebuilding the layout. A save that throws with
`err.code === 'conflict'` (or `err.status === 409`) marks the session `stale` and
tells the agent to reload rather than overwriting the server's copy.

### SessionStore

Sliding TTL map, keyed by whatever the consumer uses to name a form edit
(typically `${userId}:${resourcePath}:${recordId}`). Eviction is safe: the next
`open()` re-loads. Restarting the consumer's server loses sessions the same way.

### Tools

The six tools from `WebMCP.getTools()` pass through unchanged — same descriptors,
same descriptions, same guide text. The library adds server-only wrappers:

| tool | purpose |
|---|---|
| `saveForm` | call `save` with the current document; reports validity, version, conflict |
| `reloadForm` | re-load, discarding local changes (conflict resolution) |

Executors stay id-less, exactly like the page tools. The consumer decides
identity and namespacing:

1. **Direct** — one `WebMCP` per session with `prefixName`/`dataTitle`, all tools
   registered under distinct names.
2. **Delegation** — one `edit<Resource>` entry tool opens the session and returns
   `{ prompt, tools }`, the shape `includeSubAgent` already generates, for hosts
   that can spawn a scoped sub-agent. This keeps a large server's tool namespace
   small.

No `compile`/`createState`/`destroy` reach the agent.

## Persistence semantics

- **Explicit save only.** Mid-edit documents are often invalid and every save is
  a round trip; there is no write-through and no save-on-close.
- **Optimistic concurrency when the consumer wants it.** If `load()` returns a
  version, the library passes it to `save()`; a consumer throw with
  `code: 'conflict'` / `status: 409` marks the session stale and surfaces a reload
  instruction. A bare document gets last-write-wins.
- **Full document first.** Sparse patching is a later option: `save` already
  receives `base` (the pre-edit snapshot), so a consumer can diff and send a patch
  without the library committing to a patch format.

## TODO / suggestions

- Sparse patch format: whether the library ever calls `save` with a partial
  document, or leaves diffing to the consumer using `base`.
- Session identity/naming conventions for the first consumer.
- Whether `saveForm` is shipped by the library or left to the consumer to define
  (the library would still expose `session.save()`).

## Testing strategy

Node's built-in test runner in `agents/test/`, per repo convention. In-memory,
deterministic load/save functions cover:

- open: load once, concurrent opens deduped
- save: happy path advances the baseline; invalid document refused; a conflict
  throw marks stale
- dirty view: after a write, describeState through the session marks the changed
  fields `modified` against the loaded document
- reload/discard: local changes dropped, version refreshed
- TTL: expired session re-loads on next open
- LayoutCache: unchanged version reuses what is compiled, changed version
  recompiles
- tool pass-through: `getTools()` returns the same six tools and text as core

The page tools' own protocol remains covered by core's existing suite and
`core/webmcp-eval/`; this workspace adds no second copy.

## Workspace wiring

- `agents/package.json`: `@json-layout/agents`, dependency on `@json-layout/core`
  and peer on `@json-layout/vocabulary`, mirroring the existing workspace graph.
- Root `package.json` workspaces and the AGENTS.md project overview gain the new
  workspace; build order stays vocabulary → core → agents → examples.
