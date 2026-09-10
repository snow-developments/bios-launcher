---
name: authoring-personal-conventions
description: When building a skill/config/template that encodes the user's personal conventions, mine their repos for patterns then interview with AskUserQuestion before writing
type: feedback
---

When the task is to author something that captures the user's own style or
conventions (a skill, a lint config, a template, a rules file):

1. **Mine the evidence first.** Enumerate `~/GitHub/*` repos whose `origin`
   remote points at GitHub user `chances` (or `chance`) and pull the real
   patterns from them — commit logs, config files, code style — before
   proposing anything. Note which repos are forks; their style follows upstream,
   not the user.
2. **Then grill.** Use `AskUserQuestion` in rounds to resolve everything the
   evidence can't disambiguate (edge cases, "smell vs allowed", exact
   vocabularies). The user asks for this explicitly ("/grill-me") and expects
   multiple-choice questions, not prose — see [[grilling-with-askuserquestion]].
3. **Mirror the output.** A personal skill goes in `~/.claude/skills/<name>/`
   and also gets a copy committed to the repo at `.agents/skills/<name>/`
   (agent-agnostic location, alongside `webgpu`).

Follow the `writing-skills` TDD loop for skills: baseline a fresh agent without
the skill, write to close the observed gaps, re-verify with the skill present.

**Why:** The user's conventions are consistent but unwritten; guessing wastes
their turns. Evidence + interview produces a skill they accept without rework.

**How to apply:** Do the repo scan and the question rounds up front, before the
first draft. Related: [[commit-conventions]], [[designs-as-artifacts]],
[[minimal-over-clever]], [[design-idioms]].
