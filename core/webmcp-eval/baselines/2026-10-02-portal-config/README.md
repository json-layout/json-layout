# Baseline — 2026-10-02, portal-config-edit before and after the data-path and merge fixes

One case, `portal-config-edit` (data-fair's portal editor: 14 tabs, a goal in the person's
words), three haiku passes per configuration:

- **before**: `e1228c1` (the overview work, without the fixes below);
- **after**: `0c51e2f` + `de325e4` — data paths accepted by every tool, a not-found error that
  names where the form starts, and a setData merge that recurses into objects;
- **overview**: the same code with `--variant overview` (static structure map in the guide).

| run | turns | cost | verdict |
|---|---|---|---|
| before 1 | 24 | $0.161 | unsatisfactory |
| before 2 | 35 | $0.170 | unsatisfactory |
| before 3 | 21 | $0.132 | unsatisfactory |
| after 1 | 15 | $0.080 | satisfactory |
| after 2 | 14 | $0.064 | satisfactory |
| after 3 | 15 | $0.064 | satisfactory |
| overview 1 | 12 | $0.081 | satisfactory |
| overview 2 | 14 | $0.089 | satisfactory |
| overview 3 | 12 | $0.080 | satisfactory |

**0/3 → 3/3**, with half the turns and half the cost. The overview variant also passes 3/3,
with slightly fewer turns and slightly higher cost: on this case it neither helps nor hurts
measurably once the tools accept data paths.

## What failed before

Every "before" run guessed data paths (`/theme`, `/menu/children`, `/theme/colors/primary`),
got a bare "node not found", gave up on the field tools and fell back to whole-document
`setData`. There the shallow merge replaced the whole `theme` (fonts and every palette gone,
19 required-colour errors), and one run passed an unparsable JSON string that was written as
the whole form data. None of the three reached a valid form with both changes.

## What the judges still flag after the fixes

All recovered without misleading the agent, but each costs calls:

- the root describeState is ~83 KB: every `$slot-1` node (whole-config previews) re-lists the 39
  root fields as declared;
- a data path whose node is hidden in the current state (`/theme/colors/primary` in assisted
  colour mode) gets a plain not-found;
- paths listed as `declared` (`…/$slot-1/menu`, `…/children/0/$oneOf`) are refused by the tools;
- a getFieldSuggestions line renders its value as `[object Object]`;
- "form has N other error(s) elsewhere" counts the new array item's own errors.

`/menu/children/0` was refused while `/menu` resolved (summary-only list items); fixed in
`94ba2d8` after these runs. A non-object document in setData is refused since `bb0d79c`.
