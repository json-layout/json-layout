# Baseline — 2026-09-08 (fifth run, the first one that measures what the agent read)

Recorded from `json-layout` at `d0f7dc0`, against `data-fair/portals` at `19f3a68c`.

**Every baseline before this one is void, not superseded.** Until `d0f7dc0` the tools
returned both a markdown `content` text and a `structuredContent` object, and the MCP client
substitutes the JSON for the text — so the agent never read the markdown, and every byte
figure recorded here for four earlier baselines described a surface it never received. Proved
by reading the runner's own transcript under `~/.claude/projects/-tmp-webmcp-eval-*/`, where
contact's agent can be seen receiving
`{"path":"/contactMethod","type":"select","getSuggestions":true}` — no values, ever.

| case | calls | bytes | cost | verdict |
|---|---|---|---|---|
| contact | 3 | 684 | $0.064 | satisfactory |
| calendar | 8 | 9749 | $0.151 | satisfactory |
| charts | 14 | 16566 | $0.236 | satisfactory |
| portal-page | 9 | 7400 | $0.134 | satisfactory |

34 calls, **$0.585**, every form valid, zero errored calls.

## What removing structuredContent did

Cost fell 36% against the previous run ($0.913), and five pieces of work that had been
inert started applying at once. Call counts: contact 5 → 3, calendar 9 → 8, charts 14 → 14,
portal-page 9 → 9. Byte figures are NOT comparable across this boundary — before, they
counted text nobody read.

Each of the judges confirmed a specific mechanism now visible in a transcript for the first
time:

- **contact** writes `contactMethod` straight into `setData` from the `values=[...]` line.
  Four earlier attempts to stop it fetching that enum had failed because it had never been
  shown the values. It needs neither `getFieldSuggestions` nor `getSchema`.
- **calendar**: the 12486-char dataset object is named rather than printed in both the write
  echo and the final tree, ~25 KB saved, and the agent made no `getData` call at all.
- **charts**: of three `getFieldSuggestions` calls, none duplicated a stated list — it read
  `metric`, `sortBy`, `sortOrder` and `legendPosition` straight off their field lines.
- **portal-page**: the 39-branch union is printed once and replaced twice by a ~150-byte
  pointer, ~2.4 KB saved; and the guide's new variant-selector paragraph was followed
  exactly — `variant 12: Deux colonnes` read from the list, the integer 12 written back.

## Open

- **MEDIUM, charts: `getData` with a `$allOf-N` path silently returns the whole document.**
  Those nodes are layout-only wrappers whose `node.data` IS the parent's data, and
  `get-data.js` returns it unqualified. Verified: `path: '/$allOf-1'` and no path return
  byte-identical payloads. The tool promises "pass path to read one part of it rather than
  the entire document", and 29% of charts' bytes went through this.
- **`getData` on an unset leaf answers `{"valid":true}` with no `data` key at all** — found
  while verifying the above. An agent cannot tell "this field is empty" from a malformed
  answer.
- **Writes say whether the form is valid but not what was stored.** contact's judge traces
  the closing `getData` to exactly this: `setData` answers "valid, no errors" with no echo of
  the values, so a read-back looks necessary. The pattern is in all four cases and has been
  filed as agent caution all day; it may just be that our acknowledgements are too terse.
- **`DISPLAYED_VALUE_MAX_LENGTH` is 1000, so calendar's 442-byte `labelField` object escapes
  the naming its sibling dataset gets** — printed in full twice, ~9% of that run, for a value
  that can only ever be applied by index.
- **A field whose `getItems` depends on another field is not marked as such.** calendar's
  `labelField` is listed as suggestion-bearing while the dataset it derives from is empty.
- **`children` / `children2` are not bound to left / right** anywhere in portal-page's output.
