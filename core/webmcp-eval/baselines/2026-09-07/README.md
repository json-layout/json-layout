# Baseline — 2026-09-07

Recorded from `json-layout` at commit `0474eae`, against `data-fair/portals` at `19f3a68c`
(branch `fix-page-webmcp`, which makes the page editor's nested element arrays navigable).

Runs live in `core/tmp/` and every run overwrites them, so a baseline worth comparing
against has to be copied out. Verdicts are kept; transcripts are not, because two of them
are 47-59 KB and the verdict already quotes the responses its findings rest on.

| case | calls | bytes | cost | verdict |
|---|---|---|---|---|
| contact | 4 | 524 | $0.081 | satisfactory |
| contact (no-schema) | 5 | 857 | $0.087 | satisfactory |
| calendar | 11 | 59341 | $0.573 | satisfactory |
| charts | 21 | 47350 | $0.574 | satisfactory |
| portal-page | 10 | 10780 | $0.221 | satisfactory |

All runs on `claude-opus-5`, guide injected into the runner's prompt, $1.54 total.

`contact` and `contact (no-schema)` are the same case under two tool configurations: the
second withholds the schema from WebMCP, as portals ships, so no getSchema tool exists and
the guide points at describeState. Reading them together is how this harness answers
whether shipping the schema earns its bundle size. On this form it cost one extra call and
333 bytes — a data point, not a measurement: one pair proves nothing about a difference
this small, and the charts case varied by 14 KB between two runs of identical code.

## What the judges flagged as high severity

All in the data-fair picker, all in `charts`:

- Every suggestion row prints 300 characters of raw dataset JSON that the tool description
  forbids copying. Five searches cost ~29 KB, 61% of that session.
- Querying a dataset by its **verbatim exact title** did not return it. The getItems URL
  ends `sort=createdAt:-1`, so results are the newest loose matches; with no total count
  and no relevance signal, "not there" and "12 of N by date" are indistinguishable.
- The suggestions store keeps one result per path, so a later search silently rebinds the
  indices of an earlier one. Applying a stale `suggestionIndex` would have set the wrong
  dataset with no error at all — the only correctness hazard in the set.
