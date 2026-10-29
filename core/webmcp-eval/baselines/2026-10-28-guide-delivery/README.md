# Baseline — 2026-10-28, how the fill-form guide reaches the agent

With sub-agents removed (`../2026-10-28-subagent-conversations/`), the guide has to reach the agent
some other way. Three variants of the same conversation eval, on haiku, two scenarios,
three runs each (18 conversations, 14–20 turns):

- **prompt** (control): the guide appended to the system prompt;
- **skill-index**: the guide listed as `skill://form/SKILL.md` in a Skills index, loaded with
  `read_skill`, worded as the agents harness presents MCP skills;
- **first-describe**: the guide prepended to the first `describeState` answer.

## Result

- **The listed skill is read, every time.** In all six `skill-index` conversations the agent's
  very first call was `read_skill` on the form's skill, before touching the form.
- **Quality is the same in all three variants**: 17 of 18 conversations satisfactory, checklists
  at 91–100% medians, no difference in lost-track, misreport or drowning friction.
- The one unsatisfactory conversation (`build--first-describe--haiku--r3`) and most of the unmet
  checklist items in every variant are the same miss: the search bar put *inside* the banner
  instead of after it. It is a form or guide issue (a banner's children), not a delivery one.
- On `build`, both other variants took more turns than the control (median 20 vs 15) and
  `skill-index` more context and cost (53k vs 40k, $0.038 vs $0.025). Not seen on `rework`,
  where nothing differs. Read as persona variance until repeated.

Decision: page skills, presented like MCP skills (a Skills index entry and `read_skill`), are
enough for the guide to be followed; the `first-describe` fallback is not needed.

## Open findings

Recurring in the verdicts, in every variant, and not a matter of delivery:

- **Markdown where it does not render**: asked for bold, the agent wrote `**…**` in a text block
  or a plain field (an alert title) in 6 of the 9 `rework` runs; the person saw the asterisks and
  spent one or two turns having them removed. Twice the agent said the field accepted markdown.
  Nothing tells it which fields render markdown.
- **The search bar inside the banner** (above): the portal-page schema lets a banner hold
  children, and nothing says what belongs in it and what after it.
- **Replies in form vocabulary** (the judge's "drowning", low severity, nearly every run):
  heading levels and HTML tags, settings left at their defaults listed one by one, the agent's own
  repairs of an invalid form told to a person who asked for none of it.
- **Reshaping a block left it invalid** (a text turned into a card kept keys of the old variant),
  then 20-30 calls to rebuild it; writes to a block's old path after another block moved it.

## Runs

| conversation | verdict | outcome | turns | checklist | read_skill at call | peak context | cost | wall | friction |
|---|---|---|---|---|---|---|---|---|---|
| build--first-describe--haiku--r1 | satisfactory | done | 20 | 11/11 | - | 69.1k | $0.053 | 163s | drowning 1, misreport 1, other 1 |
| build--first-describe--haiku--r2 | satisfactory | done | 17 | 11/11 | - | 37.0k | $0.023 | 96s | drowning 3 |
| build--first-describe--haiku--r3 | unsatisfactory | cap | 20 | 10/11 | - | 44.6k | $0.032 | 123s | drowning 1, other 2 |
| build--prompt--haiku--r1 | satisfactory | done | 14 | 10/11 | - | 39.7k | $0.024 | 105s | drowning 2, other 1 |
| build--prompt--haiku--r2 | satisfactory | done | 16 | 11/11 | - | 42.5k | $0.028 | 130s | drowning 2, misreport 1 |
| build--prompt--haiku--r3 | satisfactory | done | 15 | 10/11 | - | 39.7k | $0.025 | 60s | drowning 2, lost-track 1 |
| build--skill-index--haiku--r1 | satisfactory | done | 19 | 10/11 | 1 | 68.7k | $0.042 | 120s | drowning 2, other 1 |
| build--skill-index--haiku--r2 | satisfactory | cap | 20 | 11/11 | 1 | 44.8k | $0.031 | 109s | lost-track 1, misreport 1, other 1 |
| build--skill-index--haiku--r3 | satisfactory | cap | 20 | 10/11 | 1 | 53.3k | $0.038 | 113s | drowning 1, other 1 |
| rework--first-describe--haiku--r1 | satisfactory | done | 16 | 10/10 | - | 59.2k | $0.044 | 176s | drowning 2, other 2 |
| rework--first-describe--haiku--r2 | satisfactory | cap | 20 | 10/10 | - | 49.6k | $0.036 | 95s | drowning 1, other 3 |
| rework--first-describe--haiku--r3 | satisfactory | done | 18 | 10/10 | - | 59.0k | $0.041 | 130s | drowning 2 |
| rework--prompt--haiku--r1 | satisfactory | done | 14 | 10/10 | - | 54.9k | $0.034 | 103s | drowning 2, lost-track 1, misreport 1, other 1 |
| rework--prompt--haiku--r2 | satisfactory | done | 15 | 10/10 | - | 50.9k | $0.036 | 131s | drowning 2, other 2 |
| rework--prompt--haiku--r3 | satisfactory | done | 18 | 10/10 | - | 61.4k | $0.044 | 160s | drowning 1, other 3 |
| rework--skill-index--haiku--r1 | satisfactory | done | 14 | 10/10 | 1 | 93.3k | $0.059 | 140s | drowning 2, other 3 |
| rework--skill-index--haiku--r2 | satisfactory | done | 17 | 10/10 | 1 | 55.2k | $0.038 | 95s | drowning 1, other 1 |
| rework--skill-index--haiku--r3 | satisfactory | done | 16 | 10/10 | 1 | 62.1k | $0.045 | 96s | drowning 3, other 1 |
