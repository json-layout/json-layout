# Baseline — 2026-10-28, delegating form work to a sub-agent, over long conversations

The question: should a page hand form work to a sub-agent (WebMCP's `includeSubAgent`, a
`subagent_form` tool whose call runs a single-shot worker with the form tools and the guide),
or give the main agent the form tools and the guide itself? A long conversation on the large
portal-page form (285 KB schema) was the use case most likely to justify a sub-agent.

The conversation eval that produced this (goal-driven persona, judge, a lead process and a
single-shot worker, all as Claude Code processes) answered its question and was not kept; only
this record and `../2026-10-28-guide-delivery/` remain, without the per-run verdict files.

Setup: a persona (sonnet) iterates on the page until satisfied
(10–20 turns), on two scenarios (`build` from empty, `rework` of an existing page), two arms
(`direct`: lead has the tools and the guide; `delegated`: lead has only `subagent_form`), three
runs each, all on haiku (lead and worker alike). The same 12 again with `--window 32000 --compact`,
which sends `/compact` before a turn once the lead's context crossed 70% of 32k, the agents
harness's own policy. Every conversation was valid and judged.

## Result

Every one of the 24 conversations is **satisfactory**, with every checklist item met but one.
Per scenario and window, a metric is a finding only when the three runs of one arm all beat the
three of the other:

| | build 128k | rework 128k | build 32k compacting | rework 32k compacting |
|---|---|---|---|---|
| max context, direct / delegated (median) | 69.4k / 26.1k ✓ delegated | 76.7k / 25.6k ✓ delegated | 29.2k / 23.4k ✓ delegated | 45k / 22.7k ✓ delegated |
| projected compaction turn | never / never | never / never | 1 / 13 ✓ delegated | 3 / 13 ✓ delegated |
| reply chars (median) | 298 / 443 | 315 / 464 | 262 / 574 ✓ direct | 219 / 389 |
| cost | $0.041 / $0.108 ✓ direct | $0.049 / $0.079 | $0.033 / $0.130 ✓ direct | $0.047 / $0.099 ✓ direct |
| wall time | 66s / 276s ✓ direct | 139s / 260s ✓ direct | 164s / 348s ✓ direct | 218s / 351s |
| checklist, turns, lost-track, drowning | no clear difference | no clear difference | no clear difference | no clear difference |

- **Delegation keeps the lead's context about three times smaller**, and that buys nothing
  measurable here. With a 128k window neither arm reaches our compaction threshold in 20 turns
  (one direct run peaked at 110k). Forced at 32k, the direct arm compacted 2–4 times per
  conversation and the judges found **no request that lost precision afterwards** — reverts,
  references and earlier changes all came out right. The only post-compaction slip was in a
  delegated run (the lead sent its worker a stale block position, which the worker caught).
- **It does not keep the person from being drowned**: delegated replies are longer, because the
  lead relays the worker's report; drowning friction is the same.
- **It does not help the lead keep track**: no difference in lost-track friction, turns or
  checklist. The hand-off itself produced lost-track and misreport friction in delegated runs.
- **It costs 1.6–4× more and takes 2–4× longer.**

Decision: sub-agents are removed from the data-fair agents stack; form guides are delivered as
skills.

## Caveats

- haiku stood in for the production model (DeepSeek Flash 4.1 through GreenPT).
- Claude Code's `/compact` stood in for the agents harness's own summarizer; a summarizer that
  loses more would make the context saving matter more.
- The judge knows which arm it grades; it is told to grade both by the same criteria.
- n = 3 per cell.

## Runs

| conversation | outcome | turns | checklist | peak context | compactions | reply chars (median) | cost | wall | friction |
|---|---|---|---|---|---|---|---|---|---|
| build--delegated--haiku--r1 | done | 16 | 11/11 | 26.1k | 0 | 448 | $0.113 | 250s | drowning 3, other 3 |
| build--delegated--haiku--r2 | done | 19 | 11/11 | 35.1k | 0 | 451 | $0.101 | 355s | drowning 5, misreport 1, other 2 |
| build--delegated--haiku--r3 | done | 17 | 11/11 | 24.4k | 0 | 268 | $0.108 | 276s | drowning 2, other 1 |
| build--direct--haiku--r1 | done | 10 | 11/11 | 73.3k | 0 | 351 | $0.045 | 138s | drowning 1, other 1 |
| build--direct--haiku--r2 | done | 16 | 11/11 | 69.4k | 0 | 336 | $0.041 | 66s | drowning 3 |
| build--direct--haiku--r3 | done | 11 | 11/11 | 39.7k | 0 | 261 | $0.021 | 51s | drowning 2 |
| rework--delegated--haiku--r1 | done | 19 | 10/10 | 25.6k | 0 | 352 | $0.078 | 260s | drowning 3, other 1 |
| rework--delegated--haiku--r2 | cap | 20 | 10/10 | 28.8k | 0 | 475 | $0.129 | 349s | drowning 2, other 1 |
| rework--delegated--haiku--r3 | done | 13 | 10/10 | 21.0k | 0 | 531 | $0.079 | 231s | drowning 2, other 1 |
| rework--direct--haiku--r1 | done | 12 | 10/10 | 76.7k | 0 | 441 | $0.049 | 139s | drowning 3, other 1 |
| rework--direct--haiku--r2 | done | 14 | 10/10 | 43.9k | 0 | 240 | $0.027 | 61s | drowning 2 |
| rework--direct--haiku--r3 | done | 20 | 10/10 | 109.6k | 0 | 317 | $0.164 | 219s | drowning 2, other 3 |
| build--delegated--haiku--r1--compact32000 | cap | 20 | 11/11 | 22.6k | 1 | 749 | $0.135 | 428s | lost-track 1, other 3 |
| build--delegated--haiku--r2--compact32000 | done | 18 | 11/11 | 23.4k | 1 | 387 | $0.111 | 249s | drowning 2, misreport 2, other 1 |
| build--delegated--haiku--r3--compact32000 | done | 20 | 11/11 | 23.6k | 1 | 579 | $0.130 | 348s | drowning 3, lost-track 1, other 2 |
| build--direct--haiku--r1--compact32000 | done | 14 | 11/11 | 29.2k | 3 | 232 | $0.033 | 164s | drowning 1, other 1 |
| build--direct--haiku--r2--compact32000 | done | 18 | 11/11 | 26.9k | 3 | 286 | $0.033 | 110s | drowning 2, other 1 |
| build--direct--haiku--r3--compact32000 | done | 12 | 10/11 | 41.5k | 4 | 284 | $0.052 | 229s | drowning 1, other 2 |
| rework--delegated--haiku--r1--compact32000 | done | 15 | 10/10 | 22.7k | 1 | 389 | $0.099 | 351s | drowning 3, other 2 |
| rework--delegated--haiku--r2--compact32000 | done | 17 | 10/10 | 23.5k | 1 | 399 | $0.111 | 392s | drowning 3, lost-track 1, other 2 |
| rework--delegated--haiku--r3--compact32000 | done | 13 | 10/10 | 18.7k | 0 | 242 | $0.062 | 209s | drowning 2, lost-track 1, misreport 1, other 1 |
| rework--direct--haiku--r1--compact32000 | cap | 20 | 10/10 | 45.0k | 3 | 193 | $0.047 | 218s | drowning 1, other 1 |
| rework--direct--haiku--r2--compact32000 | done | 17 | 10/10 | 58.3k | 3 | 219 | $0.055 | 235s | drowning 3, other 1 |
| rework--direct--haiku--r3--compact32000 | done | 17 | 10/10 | 40.6k | 2 | 276 | $0.034 | 101s | drowning 3 |

A pilot before the persona was tuned (one run per arm on `build`) ended after 4–5 turns: the
persona was satisfied too early to be the long conversation this eval is about, which is why it
was made to go over the page block by block before saying DONE.
