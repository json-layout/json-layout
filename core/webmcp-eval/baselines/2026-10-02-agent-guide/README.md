# Baseline — 2026-10-02, a schema's agent guide against the tools alone

The portal cases now carry the `x-agent-guide` their portals schemas declare (French, as the
cases compile in `fr`). Each case ran with it (default) and with the `no-guide` variant,
two haiku passes; `portal-page-edit` was judged on its first pass only.

| case | variant | turns (pass 1, 2) | cost (pass 1, 2) | verdict | frictions (medium) |
|---|---|---|---|---|---|
| portal-config-edit | guide | 10, 10 | $0.050, $0.048 | satisfactory ×2 | 4 (0), 5 (0) |
| portal-config-edit | no-guide | 17, 16 | $0.078, $0.082 | satisfactory ×2 | 7 (3), 4 (2) |
| portal-page | guide | 10, 9 | $0.045, $0.043 | satisfactory ×2 | 1 (0), 0 |
| portal-page | no-guide | 9, 9 | $0.039, $0.042 | satisfactory ×2 | 0, 0 |
| portal-page-edit | guide | 4, 4 | $0.031, $0.030 | satisfactory | 0 |
| portal-page-edit | no-guide | 4, 4 | $0.030, $0.030 | satisfactory | 0 |

**The guide pays where its content applies, and costs nothing measurable elsewhere.** On
the portal configuration it cut turns by ~40% and cost by ~40%, and removed every medium
friction: without it the agent read the raw data, found the hidden `/theme/colors/primary`,
wrote it, and only recovered by browsing; with it, it went straight to the assisted-mode
colour and the « Page libre » menu item. The page goals (title, two columns, delete a block,
rename) touch nothing the page guide speaks about, and the runs are indistinguishable.

So the eval measures a guide by its topics: a case whose goal exercises a convention the
guide states. The page guide's own claims (headings and table of contents, application vs
iframe blocks, dataset list vs catalogue, not inventing facts) have no case yet.
