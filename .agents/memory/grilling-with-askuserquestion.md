---
name: grilling-with-askuserquestion
description: The grilling / grill-me skill's numbered-prose question format does not exempt discrete choices from the AskUserQuestion rule
type: feedback
---

The `grilling` skill (invoked as `/grill-me`) documents a round format of
numbered `Q1`/`Q2` questions in prose with a `➡️ recommended answer` line. Do
**not** present rounds that way. The user reacted to a prose round with
"Rule violation!!! Use ask question tools!!!"

Every round of a grill goes through **AskUserQuestion**: batch up to 6 questions
per call (split a larger frontier across calls), recommended option first with
"(Recommended)" in the label, each option with a real trade-off in its
description. The skill's prose template is a description of intent, not the
output format.

This is the same principle as the global Absolute Rule ("ALWAYS use the
AskUserQuestion tool for discrete-choice questions, any time it's available —
not just inside skills") and [[authoring-personal-conventions]] ("expects multiple-choice
questions, not prose"), but it specifically catches the case where a skill's own
instructions appear to sanction plain text.

**Why:** AskUserQuestion is a structured stop-and-choose checkpoint; a prose
question bypasses it. The user enforces this hard.

**How to apply:** In any grill / interview / brainstorming clarification, reach
for AskUserQuestion for every discrete choice, regardless of what the running
skill's template shows. Related: [[authoring-personal-conventions]], [[design-idioms]],
[[minimal-over-clever]].
